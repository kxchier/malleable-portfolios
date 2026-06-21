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
    colorKeysForLayout,
    shortDisplayName,
    pickThemeColorsForKeys,
  };
}
