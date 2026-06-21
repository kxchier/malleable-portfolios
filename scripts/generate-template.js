/** Call Cerebras, validate bundle, write generated template files. */
const fs = require('fs');
const path = require('path');
const { buildSystemPrompt, buildUserPrompt } = require('./generate-prompt.js');
const {
  ROOT,
  nextLayoutId,
  nextVersionFile,
  readGeneratedRegistry,
  writeGeneratedRegistry,
  slugifyKey,
  uniqueKey,
} = require('./layout-registry.js');

const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';
const DEFAULT_MODEL = process.env.CEREBRAS_MODEL || 'zai-glm-4.7';
const {
  detectColorKeysFromCss,
  shortDisplayName,
  pickThemeColorsForKeys,
  THEME_COLOR_KEYS,
} = require('./color-keys.js');

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty model response');

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('could not parse JSON from model response');
  }
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

function seedLayoutThemeColors(layoutKey, themeColors, colorKeys) {
  const picked = pickThemeColors(themeColors, colorKeys);
  if (!Object.keys(picked).length) return null;

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
  theme.versions[layoutKey].colors = picked;
  fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
  return picked;
}

async function callCerebras(apiKey, userPrompt, context = {}) {
  const body = {
    model: DEFAULT_MODEL,
    temperature: 0.7,
    max_tokens: 12000,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(userPrompt, context) },
    ],
  };

  const res = await fetch(CEREBRAS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new Error(`Cerebras API error (${res.status}): ${msg}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras returned no content');
  return extractJson(text);
}

function buildShellHtml(key, name) {
  const title = name.replace(/</g, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Art Portfolio — ${title}</title>
  <link rel="stylesheet" href="./styles.css">
  <link rel="stylesheet" href="./generated/${key}/style.css">
  <script src="./scripts/content.js"></script>
  <script src="./scripts/loader.js"></script>
  <script src="./scripts/model-loader.js"></script>
  <script src="./scripts/generated-runtime.js"></script>
  <script src="./generated/${key}/render.js"></script>
</head>
<body>
  <header>
    <h1 data-text-id="portfolio.title" data-text-role="portfolio.title" data-text-fallback="My Art Portfolio">My Art Portfolio</h1>
    <p><a href="./edit.html">Edit</a></p>
  </header>

  <main class="container">
    <div id="content"></div>
  </main>

  <script>
    window.appData.then(async (data) => {
      const models = await PortfolioModels.load('${key}', {
        theme: data.theme,
        contentOverrides: data.content,
        contentModel: data.contentModel,
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

function writeGeneratedTemplate(bundle, userPrompt) {
  const validated = validateBundle(bundle);
  const baseKey = slugifyKey(validated.key || validated.name);
  const key = uniqueKey(baseKey);
  validated.presentation.id = key;
  validated.presentation.metaphor = validated.metaphor || validated.presentation.metaphor || key;
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

  fs.writeFileSync(path.join(ROOT, 'presentations', `${key}.json`), JSON.stringify(validated.presentation, null, 2));
  fs.writeFileSync(path.join(ROOT, file), buildShellHtml(key, name));

  const layoutEntry = {
    id,
    key,
    presentationId: key,
    name,
    file,
    generated: true,
    prompt: userPrompt,
    examplePrompt: userPrompt,
    colorKeys,
    createdAt: new Date().toISOString(),
  };

  const registry = readGeneratedRegistry();
  registry.push(layoutEntry);
  writeGeneratedRegistry(registry);

  const versionColors = seedLayoutThemeColors(key, validated.themeColors, colorKeys);

  return { layoutEntry, versionColors };
}

async function generateTemplate({ apiKey, prompt, context = {} }) {
  if (!apiKey) throw new Error('missing Cerebras API key');
  if (!prompt?.trim()) throw new Error('missing prompt');

  const raw = await callCerebras(apiKey, prompt.trim(), context);
  const { layoutEntry, versionColors } = writeGeneratedTemplate(raw, prompt.trim());
  console.log(`[generate] created ${layoutEntry.file} (${layoutEntry.key}) — ${layoutEntry.name}`);
  return { layout: layoutEntry, versionColors };
}

module.exports = {
  generateTemplate,
  callCerebras,
  validateBundle,
  extractJson,
};
