/** Which theme color swatches a layout actually uses (shared Node + browser). */
const THEME_COLOR_KEYS = ['background', 'primary', 'accent', 'paper', 'panel', 'secondary'];

const BUILTIN_COLOR_KEYS = {
  grid: ['background', 'primary', 'accent', 'paper'],
  clothesline: ['background', 'primary', 'accent', 'paper', 'panel'],
  desk: ['background', 'primary', 'accent', 'paper', 'secondary'],
};

function detectColorKeysFromCss(css) {
  if (!css) return [];
  return THEME_COLOR_KEYS.filter((key) => {
    const re = new RegExp(`var\\(\\s*--color-${key}\\b`);
    return re.test(css);
  });
}

function normalizeThemeColorCss(css, themeColors) {
  let normalized = String(css || '');
  // The editor owns the standard tokens. Generated body-scoped declarations
  // otherwise override :root and make postMessage updates appear to do nothing.
  normalized = normalized.replace(
    /--color-(?:background|primary|accent|paper|panel|secondary)\s*:\s*[^;}{]+;?/gi,
    ''
  );
  Object.entries(themeColors || {}).forEach(([key, value]) => {
    if (!THEME_COLOR_KEYS.includes(key)) return;
    const color = String(value || '').trim();
    if (!/^#[0-9a-f]{3,8}$/i.test(color)) return;
    const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(
      new RegExp(`${escaped}(?![0-9a-f])`, 'gi'),
      `var(--color-${key})`
    );
  });
  return normalized;
}

function colorKeysForLayout(layout) {
  if (layout?.colorKeys?.length) return layout.colorKeys;
  if (layout?.key && BUILTIN_COLOR_KEYS[layout.key]) return BUILTIN_COLOR_KEYS[layout.key];
  return ['background', 'primary', 'accent', 'paper'];
}

function shortDisplayName(name, maxWords = 2) {
  const words = String(name || '')
    .trim()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  if (!words.length) return 'Layout';
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function pickThemeColorsForKeys(themeColors, colorKeys) {
  const out = {};
  (colorKeys || THEME_COLOR_KEYS).forEach((key) => {
    if (themeColors?.[key]) out[key] = themeColors[key];
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    THEME_COLOR_KEYS,
    BUILTIN_COLOR_KEYS,
    detectColorKeysFromCss,
    normalizeThemeColorCss,
    colorKeysForLayout,
    shortDisplayName,
    pickThemeColorsForKeys,
  };
}

if (typeof window !== 'undefined') {
  window.PortfolioColorKeys = {
    THEME_COLOR_KEYS,
    BUILTIN_COLOR_KEYS,
    detectColorKeysFromCss,
    normalizeThemeColorCss,
    colorKeysForLayout,
    shortDisplayName,
    pickThemeColorsForKeys,
  };
}
