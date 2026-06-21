/** Built-in + AI-generated layout registry (Node). */
const fs = require('fs');
const path = require('path');
const { detectColorKeysFromCss } = require('./color-keys.js');

const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'generated', 'registry.json');

const BUILTIN_LAYOUTS = [
  {
    id: 1,
    key: 'grid',
    presentationId: 'grid',
    name: 'Grid',
    file: 'ver1.html',
    generated: false,
    colorKeys: ['background', 'primary', 'accent', 'paper'],
    examplePrompt:
      'A clean responsive grid of square thumbnails, grouped by collection, with even spacing and chunky borders.',
  },
  {
    id: 2,
    key: 'clothesline',
    presentationId: 'clothesline',
    name: 'Clothesline',
    file: 'ver2.html',
    generated: false,
    colorKeys: ['background', 'primary', 'accent', 'paper', 'panel'],
    examplePrompt:
      'Horizontal scroll strips per collection, like prints clipped on a clothesline — peek and swipe sideways.',
  },
  {
    id: 3,
    key: 'desk',
    presentationId: 'desk',
    name: 'Desk',
    file: 'ver3.html',
    generated: false,
    colorKeys: ['background', 'primary', 'accent', 'paper', 'secondary'],
    examplePrompt:
      'A scattered desk layout — prints loosely piled on a flat surface with slight tilts and soft overlaps.',
  },
];

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

function enrichGeneratedLayout(layout) {
  if (!layout.generated || layout.colorKeys?.length) return layout;
  try {
    const css = fs.readFileSync(path.join(ROOT, 'generated', layout.key, 'style.css'), 'utf8');
    return { ...layout, colorKeys: detectColorKeysFromCss(css) };
  } catch {
    return layout;
  }
}

function listAllLayouts() {
  const generated = readGeneratedRegistry().map(enrichGeneratedLayout);
  const byId = new Map();
  BUILTIN_LAYOUTS.forEach((l) => byId.set(l.id, l));
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
  BUILTIN_LAYOUTS,
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
