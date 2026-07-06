/** Built-in + AI-generated layout registry (Node). */
const fs = require('fs');
const path = require('path');
const { detectColorKeysFromCss } = require('./color-keys.js');

const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'generated', 'registry.json');
const BUILTIN_LAYOUTS_PATH = path.join(ROOT, 'models', 'builtin-layouts.json');

function readBuiltinLayouts() {
  return JSON.parse(fs.readFileSync(BUILTIN_LAYOUTS_PATH, 'utf8'));
}

function ensureGeneratedDir() {
  const dir = path.join(ROOT, 'generated');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readGeneratedRegistry() {
  ensureGeneratedDir();
  try {
    const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return Array.isArray(raw.layouts) ? raw.layouts : [];
  } catch {
    return [];
  }
}

function writeGeneratedRegistry(layouts) {
  ensureGeneratedDir();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify({ layouts }, null, 2));
}

function presentationMetaphorHints(presentation) {
  if (!presentation) return [];
  return [
    presentation.id,
    presentation.metaphor,
    presentation.layout_family,
    ...(presentation.components || []),
    ...(presentation.visual_language?.materials || []),
    ...Object.values(presentation.layout_engine || {}).flatMap((value) => {
      if (!value || typeof value !== 'object') return [value];
      return Object.values(value);
    }),
  ].filter(Boolean).map(String);
}

function enrichGeneratedLayout(layout) {
  if (!layout.generated) return layout;
  let enriched = layout;
  let presentation = null;
  try {
    const assetsDir = path.join(ROOT, 'generated', layout.key, 'assets');
    const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
    const referenceFile = files.find((file) => /^reference(?:[-_0]*)(?:image|collage)\.(png|jpe?g|webp)$/i.test(file));
    if (referenceFile && !enriched.referenceImage) {
      enriched = {
        ...enriched,
        referenceImage: `generated/${layout.key}/assets/${referenceFile}`,
      };
    }
  } catch {
    // reference images are optional
  }
  try {
    presentation = JSON.parse(fs.readFileSync(path.join(ROOT, 'presentations', `${layout.key}.json`), 'utf8'));
  } catch {
    // no presentation to infer from
  }
  try {
    if (!enriched.colorKeys?.length) {
      const css = fs.readFileSync(path.join(ROOT, 'generated', layout.key, 'style.css'), 'utf8');
      enriched = { ...enriched, colorKeys: detectColorKeysFromCss(css) };
    }
  } catch {
    // keep existing registry metadata
  }
  if (!enriched.designSpace) {
    if (presentation) {
      if (!enriched.metaphor && presentation?.metaphor) {
        enriched = { ...enriched, metaphor: presentation.metaphor };
      }
      const y = Number(presentation?.visual_language?.abstract_to_skeuomorphic);
      const hiddenness = { low: 0.16, medium: 0.55, high: 0.86 }[presentation?.encounter?.hiddenness] ?? 0.35;
      const progressive = presentation?.encounter?.progressive_disclosure ? 0.16 : 0;
      const x = Math.max(0, Math.min(1, hiddenness + progressive));
      enriched = {
        ...enriched,
        designSpace: {
          x,
          y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.35,
        },
      };
    }
  }
  if (presentation) {
    if (!enriched.metaphor && presentation.metaphor) enriched = { ...enriched, metaphor: presentation.metaphor };
    enriched = {
      ...enriched,
      metaphorHints: [...new Set([...(enriched.metaphorHints || []), ...presentationMetaphorHints(presentation)])],
    };
  }
  return enriched;
}

function listAllLayouts() {
  const builtins = readBuiltinLayouts();
  const generated = readGeneratedRegistry().map(enrichGeneratedLayout);
  const byId = new Map();
  builtins.forEach((l) => byId.set(l.id, l));
  generated.forEach((l) => byId.set(l.id, l));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function getLayoutById(id) {
  return listAllLayouts().find((l) => l.id === id) || null;
}

function getLayoutByKey(key) {
  return listAllLayouts().find((l) => l.key === key) || null;
}

function nextLayoutId() {
  const all = listAllLayouts();
  return all.length ? Math.max(...all.map((l) => l.id)) + 1 : 1;
}

function nextVersionFile() {
  const id = nextLayoutId();
  return `ver${id}.html`;
}

function slugifyKey(name, fallback = 'generated_layout') {
  const slug = String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function uniqueKey(baseKey) {
  const layouts = listAllLayouts();
  if (!layouts.some((l) => l.key === baseKey)) return baseKey;
  let n = 2;
  while (layouts.some((l) => l.key === `${baseKey}_${n}`)) n += 1;
  return `${baseKey}_${n}`;
}

function deleteGeneratedLayout(layoutKey) {
  const layout = getLayoutByKey(layoutKey);
  if (!layout) throw new Error(`layout not found: ${layoutKey}`);
  if (!layout.generated) throw new Error('only generated layouts can be deleted');

  const generatedDir = path.join(ROOT, 'generated', layoutKey);
  if (fs.existsSync(generatedDir)) {
    fs.rmSync(generatedDir, { recursive: true, force: true });
  }

  const presentationPath = path.join(ROOT, 'presentations', `${layoutKey}.json`);
  if (fs.existsSync(presentationPath)) fs.unlinkSync(presentationPath);

  const shellPath = path.join(ROOT, layout.file);
  if (fs.existsSync(shellPath)) fs.unlinkSync(shellPath);

  const registry = readGeneratedRegistry().filter((l) => l.key !== layoutKey);
  writeGeneratedRegistry(registry);

  const themePath = path.join(ROOT, 'theme.json');
  try {
    const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    if (theme.versions?.[layoutKey]) {
      delete theme.versions[layoutKey];
      if (Object.keys(theme.versions).length === 0) delete theme.versions;
      fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
    }
  } catch {
    // no theme file
  }

  console.log(`[layouts] deleted generated layout ${layoutKey} (${layout.file})`);
  return { deleted: layoutKey, layouts: listAllLayouts() };
}

module.exports = {
  ROOT,
  REGISTRY_PATH,
  BUILTIN_LAYOUTS_PATH,
  readBuiltinLayouts,
  readGeneratedRegistry,
  writeGeneratedRegistry,
  listAllLayouts,
  getLayoutById,
  getLayoutByKey,
  nextLayoutId,
  nextVersionFile,
  slugifyKey,
  uniqueKey,
  deleteGeneratedLayout,
};
