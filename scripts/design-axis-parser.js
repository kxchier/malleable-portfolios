/** Score existing portfolio layouts along a user-defined design concept axis. */
const fs = require('fs');
const path = require('path');
const { callTextModel, normalizeProvider, providerLabel } = require('./ai-client.js');
const { ROOT } = require('./layout-registry.js');

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty model response');
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('could not parse JSON from model response');
  }
}

function truncate(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function hexToRgb(hex) {
  const raw = String(hex || '').trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  const int = parseInt(raw, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbMetrics(hexColors) {
  const colors = hexColors.map(hexToRgb).filter(Boolean);
  if (!colors.length) return null;
  const channels = colors.flatMap((c) => [c.r, c.g, c.b]);
  const hueBuckets = new Set();
  let warmth = 0;
  const avgBrightness = colors.reduce((sum, c) => sum + ((c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255), 0) / colors.length;
  const avgSaturation = colors.reduce((sum, c) => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === c.r) hue = 60 * (((c.g - c.b) / delta) % 6);
      else if (max === c.g) hue = 60 * ((c.b - c.r) / delta + 2);
      else hue = 60 * ((c.r - c.g) / delta + 4);
      if (hue < 0) hue += 360;
      hueBuckets.add(Math.floor(hue / 30));
    }
    warmth += (c.r - c.b) / 255;
    return sum + (max === 0 ? 0 : (max - min) / max);
  }, 0) / colors.length;
  return {
    count: colors.length,
    brightness: Number(avgBrightness.toFixed(2)),
    saturation: Number(avgSaturation.toFixed(2)),
    hueVariety: hueBuckets.size,
    warmth: Number((warmth / colors.length).toFixed(2)),
    channelSpread: Number(((Math.max(...channels) - Math.min(...channels)) / 255).toFixed(2)),
  };
}

function countMatches(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

function numericCssValues(css, prop) {
  const values = [];
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'gi');
  let match;
  while ((match = re.exec(css))) {
    const value = match[1];
    const nums = value.match(/[0-9.]+/g) || [];
    nums.forEach((num) => values.push(Number(num)));
  }
  return values.filter(Number.isFinite);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cssStyleSummary(layout) {
  if (!layout.generated) {
    return {
      source: 'builtin',
      classHints: [layout.key, layout.metaphor].filter(Boolean),
    };
  }
  const css = readText(path.join(ROOT, 'generated', layout.key, 'style.css'));
  const borderRadii = numericCssValues(css, 'border-radius');
  return {
    source: 'generated_css',
    cssLength: css.length,
    borderRadiusAvg: Number(average(borderRadii).toFixed(1)),
    borderRadiusMax: Number((borderRadii.length ? Math.max(...borderRadii) : 0).toFixed(1)),
    hardEdges: countMatches(css, /border-radius\s*:\s*(0|1px|2px|3px)\b/gi),
    roundedEdges: countMatches(css, /border-radius\s*:\s*([8-9]px|[1-9][0-9]+px|[0-9.]+rem|50%|999px)/gi),
    shadows: countMatches(css, /box-shadow|drop-shadow|text-shadow/gi),
    gradients: countMatches(css, /gradient\(/gi),
    transforms: countMatches(css, /transform\s*:|rotate\(|skew\(|translate\(/gi),
    outlinesBorders: countMatches(css, /\bborder\b|outline/gi),
    blurFilters: countMatches(css, /blur\(|filter\s*:/gi),
    scrollSurfaces: countMatches(css, /overflow-[xy]\s*:\s*auto|overflow\s*:\s*auto|scroll/gi),
    textureWords: (css.match(/\b(grain|noise|paper|shadow|glow|clip|frame|rack|zine|desk|file|folder|market|neon|soft|rounded|sharp)\b/gi) || [])
      .slice(0, 12)
      .map((word) => word.toLowerCase()),
  };
}

function versionThemeForLayout(layout) {
  const theme = readJson(path.join(ROOT, 'theme.json'), {});
  const colors = {
    ...(theme.colors || {}),
    ...(theme.versions?.[layout.key]?.colors || {}),
  };
  const typography = {
    ...(theme.typography || {}),
    ...(theme.versions?.[layout.key]?.typography || {}),
  };
  const spacing = {
    ...(theme.spacing || {}),
    ...(theme.versions?.[layout.key]?.spacing || {}),
  };
  const usedColorKeys = layout.colorKeys?.length ? layout.colorKeys : Object.keys(colors);
  const usedColors = Object.fromEntries(usedColorKeys.map((key) => [key, colors[key]]).filter(([, value]) => value));
  return {
    colors: usedColors,
    colorMetrics: rgbMetrics(Object.values(usedColors)),
    typography: {
      heading1: typography.heading1?.fontFamily || null,
      heading2: typography.heading2?.fontFamily || null,
      body: typography.body?.fontFamily || null,
    },
    spacing,
  };
}

function compactLayout(layout) {
  const theme = versionThemeForLayout(layout);
  return {
    key: layout.key,
    name: truncate(layout.name, 60),
    metaphor: truncate(layout.metaphor, 80),
    description: truncate(layout.prompt || layout.examplePrompt || '', 260),
    generated: !!layout.generated,
    designSpace: layout.designSpace
      ? { x: clamp01(layout.designSpace.x), y: clamp01(layout.designSpace.y) }
      : null,
    visualStyle: {
      colorKeys: Object.keys(theme.colors || {}),
      colors: theme.colors,
      colorMetrics: theme.colorMetrics,
      typography: theme.typography,
      spacing: theme.spacing,
      css: cssStyleSummary(layout),
    },
  };
}

function buildAxisSystemPrompt() {
  return `You rank art portfolio interface concepts on a custom design axis.

Output ONLY valid JSON:
{
  "terms": [
    { "value": 0.0, "label": "left endpoint phrase", "description": "brief meaning" }
  ],
  "scores": {
    "layout_key": { "value": 0.0, "rationale": "brief phrase" }
  }
}

The axis runs from leftLabel at 0 to rightLabel at 1.
Also create 6-8 short semantic terms that populate the axis between the endpoints. These are artist-facing concept words, not numbers.
Use the layout metaphor, short description, design-space metadata, and compact visualStyle summary.
For visual axes such as colorful/monotone, edgy/soft, dense/spacious, dark/light, warm/cool, tactile/flat, use visualStyle evidence over metaphor guesses.
Return one score for every provided layout key.
Term labels should be 1-4 words; descriptions under 12 words.
Keep rationales under 8 words.`;
}

function buildAxisUserPrompt({ axis, layouts }) {
  return JSON.stringify({
    axis: {
      name: axis.name || `${axis.leftLabel} to ${axis.rightLabel}`,
      leftLabel: axis.leftLabel,
      rightLabel: axis.rightLabel,
    },
    layouts: layouts.map(compactLayout),
  }, null, 2);
}

async function scoreDesignAxis({ apiKey, provider, axis, layouts }) {
  const normalizedProvider = normalizeProvider(provider);
  if (!axis?.leftLabel || !axis?.rightLabel) throw new Error('axis needs left and right labels');

  const result = await callTextModel({
    provider: normalizedProvider,
    apiKey,
    system: buildAxisSystemPrompt(),
    user: buildAxisUserPrompt({ axis, layouts }),
    maxTokens: 4000,
    temperature: 0.1,
    responseFormat: normalizedProvider === 'cerebras' ? { type: 'json_object' } : null,
  });

  const text = result.text;
  if (!text.trim()) {
    throw new Error(`${providerLabel(normalizedProvider)} returned an empty ranking response (finish reason: ${result.stopReason})`);
  }

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (error) {
    throw new Error(`Could not parse ranking JSON: ${error.message}`);
  }
  const scoreEntries = Array.isArray(parsed.scores)
    ? parsed.scores.map((score) => [score.key, score])
    : Object.entries(parsed.scores || {});
  const byKey = new Map(scoreEntries.map(([key, score]) => [
    key,
    {
      key,
      value: clamp01(score.value),
      rationale: String(score.rationale || '').slice(0, 100),
    },
  ]));

  return {
    terms: Array.isArray(parsed.terms)
      ? parsed.terms.map((term) => ({
        value: clamp01(term.value),
        label: String(term.label || '').slice(0, 48),
        description: String(term.description || '').slice(0, 100),
      })).filter((term) => term.label).sort((a, b) => a.value - b.value)
      : [],
    scores: layouts.map((layout) => byKey.get(layout.key) || {
      key: layout.key,
      value: 0.5,
      rationale: 'unranked',
    }),
  };
}

module.exports = { scoreDesignAxis };
