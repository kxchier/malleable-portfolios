/** Call the selected AI provider, validate bundle, write generated template files. */
const fs = require('fs');
const path = require('path');
const { callTextModel, normalizeProvider, providerLabel } = require('./ai-client.js');
const { buildSystemPrompt, buildUserPrompt } = require('./generate-prompt.js');
const {
  ROOT,
  nextLayoutId,
  nextVersionFile,
  listAllLayouts,
  readGeneratedRegistry,
  writeGeneratedRegistry,
  slugifyKey,
  uniqueKey,
} = require('./layout-registry.js');

const {
  detectColorKeysFromCss,
  shortDisplayName,
  pickThemeColorsForKeys,
  THEME_COLOR_KEYS,
} = require('./color-keys.js');

const GENERATE_MAX_TOKENS = Number(process.env.GENERATE_MAX_TOKENS || 12000);

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty model response');

  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }

    try {
      return JSON.parse(repairJsonStringLiterals(candidate));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`could not parse JSON from model response: ${lastError?.message || 'unknown parse error'}`);
}

function repairJsonStringLiterals(jsonText) {
  let repaired = '';
  let inString = false;
  let escaped = false;

  for (const char of String(jsonText || '').replace(/^\uFEFF/, '')) {
    if (!inString) {
      repaired += char;
      if (char === '"') inString = true;
      continue;
    }

    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      repaired += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      repaired += char;
      inString = false;
      continue;
    }

    if (char === '\n') {
      repaired += '\\n';
    } else if (char === '\r') {
      repaired += '\\r';
    } else if (char === '\t') {
      repaired += '\\t';
    } else if (char < ' ') {
      repaired += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    } else {
      repaired += char;
    }
  }

  return repaired;
}

function validateBundle(bundle) {
  const errors = [];
  if (!bundle.name) errors.push('missing name');
  if (!bundle.key && !bundle.name) errors.push('missing key');
  if (!bundle.presentation || typeof bundle.presentation !== 'object') errors.push('missing presentation');
  if (!bundle.css || typeof bundle.css !== 'string') errors.push('missing css');
  if (!bundle.renderScript || typeof bundle.renderScript !== 'string') errors.push('missing renderScript');
  if (bundle.assets != null && typeof bundle.assets !== 'object') errors.push('assets must be an object');
  if (bundle.renderScript && !bundle.renderScript.includes('GeneratedLayouts')) {
    errors.push('renderScript must register window.GeneratedLayouts');
  }
  if (!bundle.themeColors || typeof bundle.themeColors !== 'object') {
    errors.push('missing themeColors (must match editor swatches for this layout)');
  }
  const colorKeys = detectColorKeysFromCss(bundle.css || '');
  const requiredColorKeys = [...new Set(['background', 'primary', 'accent', 'paper', ...colorKeys])];
  if (bundle.themeColors) {
    requiredColorKeys.forEach((key) => {
      if (!bundle.themeColors[key]) errors.push(`themeColors missing ${key}`);
    });
  }
  if (bundle.css && !bundle.css.includes('var(--color-background)')) {
    errors.push('css must use var(--color-background) not custom color variable names');
  }
  if (errors.length) throw new Error('invalid generation: ' + errors.join(', '));
  bundle.colorKeys = colorKeys.length ? colorKeys : ['background', 'primary', 'accent', 'paper'];
  return bundle;
}

function isHighFidelityReferencePrompt(prompt) {
  return /REFERENCE_FIDELITY:\s*high/i.test(String(prompt || ''));
}

function normalizeReferenceImage(referenceImage) {
  if (!referenceImage || typeof referenceImage !== 'object') return null;
  const image = String(referenceImage.image || referenceImage.dataUrl || '').trim();
  const match = image.match(/^data:image\/(png|jpe?g|webp);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return null;
  const ext = match[1].toLowerCase().replace('jpeg', 'jpg');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 4_500_000) return null;
  return {
    filename: `reference-image.${ext}`,
    bytes,
  };
}

function extractPromptList(prompt, labels, limit = 12) {
  const text = String(prompt || '');
  const items = [];
  labels.forEach((label) => {
    const re = new RegExp(`^${label}:\\s*(.+)$`, 'gim');
    let match;
    while ((match = re.exec(text))) {
      match[1]
        .split(/[,;]+|\s+\|\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => items.push(item));
    }
  });
  return [...new Set(items)].slice(0, limit);
}

function motifNeedles(motif) {
  const stop = new Set(['large', 'small', 'soft', 'rough', 'left', 'right', 'upper', 'lower', 'center', 'visible', 'translucent', 'floating', 'hand', 'drawn', 'style', 'motif', 'motifs']);
  return String(motif || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stop.has(word))
    .flatMap((word) => {
      const forms = new Set([word]);
      if (word.endsWith('ies')) forms.add(`${word.slice(0, -3)}y`);
      if (word.endsWith('s')) forms.add(word.slice(0, -1));
      return [...forms];
    });
}

function validateReferenceFidelityBundle(bundle, prompt, context = {}) {
  if (!isHighFidelityReferencePrompt(prompt)) return;
  const errors = [];
  const reference = context.referenceImageAssetName;
  const searchable = [
    bundle.css,
    bundle.renderScript,
    JSON.stringify(bundle.presentation || {}),
    Object.keys(bundle.assets || {}).join(' '),
    Object.values(bundle.assets || {}).join(' '),
  ].join('\n').toLowerCase();

  if (reference && !searchable.includes(reference.toLowerCase()) && !searchable.includes('reference-image')) {
    errors.push(`must use uploaded reference asset via assets/${reference} as a visible underlay or texture`);
  }

  const motifs = extractPromptList(prompt, ['Required motifs', 'Motif vocabulary'], 14);
  if (motifs.length) {
    const matched = motifs.filter((motif) => motifNeedles(motif).some((needle) => searchable.includes(needle)));
    if (matched.length < Math.min(3, motifs.length)) {
      errors.push(`must visibly implement at least 3 required motifs (${motifs.slice(0, 6).join(', ')})`);
    }
  }

  const materials = extractPromptList(prompt, ['Required materials', 'Material system', 'Must preserve'], 14);
  if (materials.length) {
    const materialMatches = materials.filter((material) => motifNeedles(material).some((needle) => searchable.includes(needle)));
    if (materialMatches.length < Math.min(2, materials.length)) {
      errors.push(`must implement required material techniques (${materials.slice(0, 5).join(', ')})`);
    }
  }

  if (errors.length) throw new Error(`invalid high-fidelity image generation: ${errors.join('; ')}`);
}

function pickThemeColors(themeColors, colorKeys) {
  return pickThemeColorsForKeys(themeColors, colorKeys);
}

const TYPOGRAPHY_TOKENS = ['heading1', 'heading2', 'body'];
const TYPOGRAPHY_PROPS = {
  fontFamily: /^[a-zA-Z0-9 ,'"-]{1,120}$/,
  fontSize: /^clamp\([^)]+\)$|^[0-9.]+(rem|em|px|%)$/,
  fontWeight: /^(normal|bold|[1-9]00)$/,
};
const SPACING_PROPS = {
  gridGap: /^[0-9.]+(rem|em|px|vw|%)$/,
  artSize: /^[0-9.]+(rem|em|px|vw|%)$/,
  imagePadding: /^[0-9.]+(rem|em|px|%)$/,
};

function sanitizeThemeTypography(typography) {
  if (!typography || typeof typography !== 'object') return null;
  const out = {};
  TYPOGRAPHY_TOKENS.forEach((token) => {
    const source = typography[token];
    if (!source || typeof source !== 'object') return;
    const entry = {};
    Object.entries(TYPOGRAPHY_PROPS).forEach(([prop, re]) => {
      const value = String(source[prop] || '').trim();
      if (value && re.test(value)) entry[prop] = value;
    });
    if (Object.keys(entry).length) out[token] = entry;
  });
  return Object.keys(out).length ? out : null;
}

function sanitizeThemeSpacing(spacing) {
  if (!spacing || typeof spacing !== 'object') return null;
  const out = {};
  Object.entries(SPACING_PROPS).forEach(([prop, re]) => {
    const value = String(spacing[prop] || '').trim();
    if (value && re.test(value)) out[prop] = value;
  });
  return Object.keys(out).length ? out : null;
}

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeDesignSpace(point, presentation) {
  const visual = presentation?.visual_language || {};
  const encounter = presentation?.encounter || {};
  const hiddenness = { low: 0.16, medium: 0.55, high: 0.86 }[encounter.hiddenness] ?? 0.35;
  const progressive = encounter.progressive_disclosure ? 0.16 : 0;
  const deepEncounter = Number(encounter.fast_discovery_to_deep_encounter);
  const inferredX = Number.isFinite(deepEncounter)
    ? (1 - clamp01(deepEncounter)) * 0.45 + hiddenness * 0.4 + progressive
    : hiddenness + progressive;
  const normalized = {
    x: clamp01(point?.x, clamp01(inferredX)),
    y: clamp01(point?.y, clamp01(visual.abstract_to_skeuomorphic ?? 0.35)),
  };
  if (Array.isArray(point?.customAxes)) {
    const endpointLabel = (axis, side) => {
      const label = String(side === 'right' ? axis?.rightLabel || '' : axis?.leftLabel || '').trim();
      if (label) return label;
      const image = side === 'right' ? axis?.rightImage : axis?.leftImage;
      if (image && typeof image === 'object') return String(image.fileName || `${side} image reference`).slice(0, 48);
      return '';
    };
    normalized.customAxes = point.customAxes
      .filter((axis) => axis && endpointLabel(axis, 'left') && endpointLabel(axis, 'right'))
      .map((axis) => ({
        id: String(axis.id || `${axis.leftLabel}-${axis.rightLabel}`).slice(0, 80),
        name: String(axis.name || `${endpointLabel(axis, 'left')} to ${endpointLabel(axis, 'right')}`).slice(0, 80),
        leftLabel: endpointLabel(axis, 'left'),
        rightLabel: endpointLabel(axis, 'right'),
        value: clamp01(axis.value, 0.5),
        leftImage: axis.leftImage && typeof axis.leftImage === 'object' ? {
          fileName: String(axis.leftImage.fileName || '').slice(0, 80),
          summary: String(axis.leftImage.summary || '').slice(0, 240),
          keywords: Array.isArray(axis.leftImage.keywords) ? axis.leftImage.keywords.map((keyword) => String(keyword).slice(0, 32)).slice(0, 3) : [],
          palette: Array.isArray(axis.leftImage.palette) ? axis.leftImage.palette.map((color) => String(color).slice(0, 24)).slice(0, 6) : [],
        } : null,
        rightImage: axis.rightImage && typeof axis.rightImage === 'object' ? {
          fileName: String(axis.rightImage.fileName || '').slice(0, 80),
          summary: String(axis.rightImage.summary || '').slice(0, 240),
          keywords: Array.isArray(axis.rightImage.keywords) ? axis.rightImage.keywords.map((keyword) => String(keyword).slice(0, 32)).slice(0, 3) : [],
          palette: Array.isArray(axis.rightImage.palette) ? axis.rightImage.palette.map((color) => String(color).slice(0, 24)).slice(0, 6) : [],
        } : null,
      }));
  }
  return normalized;
}

function seedLayoutTheme(layoutKey, themeColors, colorKeys, typography, spacing) {
  const picked = pickThemeColors(themeColors, colorKeys);
  const pickedTypography = sanitizeThemeTypography(typography);
  const pickedSpacing = sanitizeThemeSpacing(spacing);
  if (!Object.keys(picked).length && !pickedTypography && !pickedSpacing) return null;

  const themePath = path.join(ROOT, 'theme.json');
  let theme = {};
  try {
    theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
  } catch {
    // start fresh
  }
  if (!theme.colors) theme.colors = {};
  if (!theme.versions) theme.versions = {};
  if (!theme.versions[layoutKey]) theme.versions[layoutKey] = {};
  if (Object.keys(picked).length) theme.versions[layoutKey].colors = picked;
  if (pickedTypography) theme.versions[layoutKey].typography = pickedTypography;
  if (pickedSpacing) theme.versions[layoutKey].spacing = pickedSpacing;
  fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
  return {
    colors: Object.keys(picked).length ? picked : null,
    typography: pickedTypography,
    spacing: pickedSpacing,
  };
}

async function callProvider(apiKey, userPrompt, context = {}) {
  const provider = normalizeProvider(context.provider);
  const result = await callTextModel({
    provider,
    apiKey,
    system: buildSystemPrompt(),
    user: buildUserPrompt(userPrompt, context),
    maxTokens: GENERATE_MAX_TOKENS,
    temperature: 0.7,
    responseFormat: provider === 'cerebras' ? { type: 'json_object' } : null,
  });

  const text = result.text;
  if (!text) throw new Error(`${providerLabel(provider)} returned no content`);
  try {
    return extractJson(text);
  } catch (error) {
    const stoppedForLength = ['max_tokens', 'length'].includes(String(result.stopReason || '').toLowerCase());
    if (stoppedForLength) {
      throw new Error(
        `${providerLabel(provider)} response was cut off before the JSON finished. ` +
        `Try generating again, or set GENERATE_MAX_TOKENS higher than ${GENERATE_MAX_TOKENS} in .env.`
      );
    }
    throw error;
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildVersionNav(activeKey, layouts = []) {
  return '';
}

function refreshStaticVersionNavs(layouts = []) {
  layouts.forEach((layout) => {
    if (!layout.file) return;
    const filePath = path.join(ROOT, layout.file);
    if (!fs.existsSync(filePath)) return;
    const html = fs.readFileSync(filePath, 'utf8');
    const nav = buildVersionNav(layout.key, layouts);
    const updated = html.replace(
      /(<header>\s*<h1[\s\S]*?<\/h1>\s*)<p>[\s\S]*?<\/p>/,
      `$1${nav}`
    );
    if (updated !== html) fs.writeFileSync(filePath, updated);
  });
}

function buildShellHtml(key, name, layouts = []) {
  const title = name.replace(/</g, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Art Portfolio — ${title}</title>
  <link rel="stylesheet" href="./styles.css">
  <link rel="stylesheet" href="./generated/${key}/style.css">
  <style>
    body.view-${key} .generated-layout-container {
      max-width: none;
      width: 100%;
      min-height: 100vh;
      padding: 0;
    }
    body.view-${key} > header {
      position: relative;
      z-index: 1000;
      isolation: isolate;
    }
    body.view-${key} #content {
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }
  </style>
  <script src="./scripts/content.js"></script>
  <script src="./scripts/loader.js"></script>
  <script src="./scripts/model-loader.js"></script>
  <script src="./scripts/generated-runtime.js"></script>
  <script src="./scripts/decorations-runtime.js"></script>
  <script src="./generated/${key}/render.js"></script>
</head>
<body class="view-${key}">
  <header>
    <h1 data-text-id="portfolio.title" data-text-role="portfolio.title" data-text-fallback="My Art Portfolio">My Art Portfolio</h1>
    ${buildVersionNav(key, layouts)}
  </header>

  <main class="container generated-layout-container">
    <div id="content"></div>
  </main>

  <script>
    window.appData.then(async (data) => {
      const models = await PortfolioModels.load('${key}', {
        theme: data.theme,
        contentOverrides: data.content,
        contentModel: data.contentModel,
      });
      if (window.PortfolioContent) {
        PortfolioContent.applyColorVars(data.theme, '${key}');
        PortfolioContent.applyTypographyVars(data.theme, '${key}');
      }
      const versionSpacing = data.theme?.versions?.['${key}']?.spacing || {};
      Object.entries(versionSpacing).forEach(([spacingKey, value]) => {
        document.documentElement.style.setProperty(\`--space-\${spacingKey}\`, value);
      });
      await GeneratedRuntime.mount({
        root: document.getElementById('content'),
        layoutKey: '${key}',
        models,
      });
    });
  </script>
</body>
</html>
`;
}

function writeGeneratedTemplate(bundle, userPrompt, context = {}) {
  const validated = validateBundle(bundle);
  validateReferenceFidelityBundle(validated, userPrompt, context);
  const baseKey = slugifyKey(validated.key || validated.name);
  const key = uniqueKey(baseKey);
  validated.presentation.id = key;
  validated.presentation.metaphor = validated.metaphor || validated.presentation.metaphor || key;
  validated.metaphor = validated.metaphor || validated.presentation.metaphor;
  const colorKeys = validated.colorKeys || detectColorKeysFromCss(validated.css);
  const name = shortDisplayName(validated.name, 2);
  const id = nextLayoutId();
  const file = nextVersionFile();
  const dir = path.join(ROOT, 'generated', key);
  const assetsDir = path.join(dir, 'assets');

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'presentations'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'presentation.json'), JSON.stringify(validated.presentation, null, 2));
  fs.writeFileSync(path.join(dir, 'style.css'), validated.css);
  fs.writeFileSync(path.join(dir, 'render.js'), validated.renderScript);

  const assets = validated.assets || {};
  const assetFiles = [];
  Object.entries(assets).forEach(([filename, content]) => {
    const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safe.endsWith('.svg')) return;
    fs.writeFileSync(path.join(assetsDir, safe), content);
    assetFiles.push(safe);
  });
  if (context.referenceImage?.bytes && context.referenceImageAssetName) {
    fs.writeFileSync(path.join(assetsDir, context.referenceImageAssetName), context.referenceImage.bytes);
    assetFiles.push(context.referenceImageAssetName);
  }
  fs.writeFileSync(path.join(assetsDir, 'index.json'), JSON.stringify([...new Set(assetFiles)].sort(), null, 2));

  const layoutEntry = {
    id,
    key,
    presentationId: key,
    name,
    metaphor: validated.presentation.metaphor,
    file,
    generated: true,
    prompt: userPrompt,
    examplePrompt: userPrompt,
    colorKeys,
    designSpace: normalizeDesignSpace(context.designSpace, validated.presentation),
    referenceImage: context.referenceImageAssetName ? `generated/${key}/assets/${context.referenceImageAssetName}` : undefined,
    createdAt: new Date().toISOString(),
  };

  const registry = readGeneratedRegistry();
  registry.push(layoutEntry);
  writeGeneratedRegistry(registry);
  const allLayouts = listAllLayouts();

  fs.writeFileSync(path.join(ROOT, 'presentations', `${key}.json`), JSON.stringify(validated.presentation, null, 2));
  fs.writeFileSync(path.join(ROOT, file), buildShellHtml(key, name, allLayouts));
  refreshStaticVersionNavs(allLayouts);

  const versionTheme = seedLayoutTheme(
    key,
    validated.themeColors,
    colorKeys,
    validated.themeTypography,
    validated.themeSpacing
  );

  return { layoutEntry, versionTheme };
}

async function generateTemplate({ apiKey, provider, prompt, context = {} }) {
  const normalizedProvider = normalizeProvider(provider);
  if (!prompt?.trim()) throw new Error('missing prompt');

  const referenceImage = normalizeReferenceImage(context.referenceImage);
  const generationContext = {
    ...context,
    referenceImage,
    referenceImageAssetName: referenceImage?.filename || '',
    provider: normalizedProvider,
  };
  const raw = await callProvider(apiKey, prompt.trim(), generationContext);
  const { layoutEntry, versionTheme } = writeGeneratedTemplate(raw, prompt.trim(), generationContext);
  console.log(`[generate] created ${layoutEntry.file} (${layoutEntry.key}) — ${layoutEntry.name}`);
  return {
    layout: layoutEntry,
    versionTheme,
    versionColors: versionTheme?.colors || null,
    versionTypography: versionTheme?.typography || null,
    versionSpacing: versionTheme?.spacing || null,
  };
}

module.exports = {
  generateTemplate,
  callProvider,
  validateBundle,
  extractJson,
};
