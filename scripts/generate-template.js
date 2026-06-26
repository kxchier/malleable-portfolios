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

const GENERATE_MAX_TOKENS = Number(process.env.GENERATE_MAX_TOKENS || 7000);

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
    normalized.customAxes = point.customAxes
      .filter((axis) => axis && axis.leftLabel && axis.rightLabel)
      .map((axis) => ({
        id: String(axis.id || `${axis.leftLabel}-${axis.rightLabel}`).slice(0, 80),
        name: String(axis.name || `${axis.leftLabel} to ${axis.rightLabel}`).slice(0, 80),
        leftLabel: String(axis.leftLabel).slice(0, 48),
        rightLabel: String(axis.rightLabel).slice(0, 48),
        value: clamp01(axis.value, 0.5),
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
  });

  const text = result.text;
  if (!text) throw new Error(`${providerLabel(provider)} returned no content`);
  return extractJson(text);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildVersionNav(activeKey, layouts = []) {
  const links = [
    { label: 'Home', file: 'index.html' },
    ...layouts.map((layout) => ({ label: layout.name, file: layout.file, key: layout.key })),
    { label: 'Edit', file: 'edit.html' },
  ];
  const items = links.map((link) => {
    if (link.key && link.key === activeKey) {
      return `<span class="active-view">${escapeHtml(link.label)}</span>`;
    }
    return `<a href="./${escapeHtml(link.file)}">${escapeHtml(link.label)}</a>`;
  }).join('');
  return `<p>${items}</p>`;
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
    body.view-${key} #content {
      min-height: 100vh;
      position: relative;
    }
    body.view-${key} #content > * {
      min-height: 100vh;
    }
  </style>
  <script src="./scripts/content.js"></script>
  <script src="./scripts/loader.js"></script>
  <script src="./scripts/model-loader.js"></script>
  <script src="./scripts/generated-runtime.js"></script>
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
  Object.entries(assets).forEach(([filename, content]) => {
    const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safe.endsWith('.svg')) return;
    fs.writeFileSync(path.join(assetsDir, safe), content);
  });

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

  const generationContext = { ...context, provider: normalizedProvider };
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
