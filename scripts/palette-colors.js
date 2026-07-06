/** Palette helpers — 2D pad + HSL for precise color editing. */
window.PaletteColors = (() => {
  const SWATCHES = [
    { key: 'background', label: 'Background', hint: 'Page behind your art' },
    { key: 'primary', label: 'Primary', hint: 'Headings, text, borders' },
    { key: 'accent', label: 'Hover', hint: 'Edit outlines & nav link hover' },
    { key: 'paper', label: 'Border', hint: 'Artwork mat / frame color' },
    { key: 'panel', label: 'Line panel', hint: 'Clothesline background behind hung art', layout: 'clothesline' },
    { key: 'secondary', label: 'Desk', hint: 'Desk surface color', layout: 'desk' },
  ];

  const GENERIC_SWATCHES = {
    background: { label: 'Background', hint: 'Page or scene background' },
    primary: { label: 'Primary', hint: 'Main text and structural lines' },
    accent: { label: 'Accent', hint: 'Interactive highlights and emphasis' },
    paper: { label: 'Surface', hint: 'Artwork mats, cards, glass, or object surfaces' },
    panel: { label: 'Panel', hint: 'Large interface panels, scenery, or containers' },
    secondary: { label: 'Secondary', hint: 'Secondary material, glow, texture, or detail color' },
  };

  const LAYOUT_SWATCH_OVERRIDES = {
    signal_tower: {
      accent: { label: 'Warning', hint: 'Warning lights and active controls' },
      paper: { label: 'Glass', hint: 'CRT glass / resolved transmission panels' },
      panel: { label: 'Console', hint: 'Broadcast console and dark hardware panels' },
      secondary: { label: 'Signal', hint: 'Phosphor signal glow and tuned indicators' },
    },
  };

  const BUILTIN_LAYOUTS = new Set(['grid', 'clothesline', 'desk', 'directory']);

  function swatchForGenerated(key, layoutKey) {
    const base = SWATCHES.find((swatch) => swatch.key === key) || { key, label: key, hint: '' };
    return {
      ...base,
      ...(GENERIC_SWATCHES[key] || {}),
      ...(LAYOUT_SWATCH_OVERRIDES[layoutKey]?.[key] || {}),
      layout: undefined,
    };
  }

  function forLayout(layoutKey, options = {}) {
    const keys = options.colorKeys;
    if (keys?.length) {
      const allowed = new Set(keys);
      if (!BUILTIN_LAYOUTS.has(layoutKey)) {
        return keys.map((key) => swatchForGenerated(key, layoutKey));
      }
      return SWATCHES.filter((swatch) => allowed.has(swatch.key));
    }
    return SWATCHES.filter((swatch) => !swatch.layout || swatch.layout === layoutKey);
  }

  function parseHex(hex) {
    const h = String(hex || '#888888').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function toHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function hexToHsl(hex) {
    const { r, g, b } = parseHex(hex);
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
        case gn: h = ((bn - rn) / d + 2) / 6; break;
        default: h = ((rn - gn) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s, l };
  }

  function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = Math.max(0, Math.min(1, s));
    const lit = Math.max(0, Math.min(1, l));
    if (sat === 0) {
      const v = Math.round(lit * 255);
      return toHex(v, v, v);
    }
    const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat;
    const p = 2 * lit - q;
    const hk = hue / 360;
    const f = (t) => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return toHex(f(hk + 1 / 3) * 255, f(hk) * 255, f(hk - 1 / 3) * 255);
  }

  function fromPad(x, y, width, height, saturation) {
    const h = Math.max(0, Math.min(360, (x / width) * 360));
    const l = Math.max(0.05, Math.min(0.95, 1 - (y / height)));
    return hslToHex(h, saturation, l);
  }

  function padPosition(hex, width, height) {
    const { h, s, l } = hexToHsl(hex);
    return {
      x: (h / 360) * width,
      y: (1 - l) * height,
      s,
    };
  }

  return { SWATCHES, forLayout, hexToHsl, hslToHex, fromPad, padPosition, toHex, parseHex };
})();
