/** Generate decorative SVG assets for an existing portfolio layout. */
const fs = require('fs');
const path = require('path');
const { callTextModel, normalizeProvider, providerLabel } = require('./ai-client.js');
const { ROOT, listAllLayouts } = require('./layout-registry.js');

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty model response');
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch (innerErr) {
        throw new Error(`decoration generator returned incomplete JSON: ${innerErr.message}`);
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (innerErr) {
        throw new Error(`decoration generator returned incomplete JSON: ${innerErr.message}`);
      }
    }
    throw new Error(`could not parse JSON from decoration generator: ${err.message}`);
  }
}

function safeLayoutKey(key) {
  return String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function slugifyName(name) {
  return String(name || 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'asset';
}

function sanitizeSvg(svg) {
  const text = String(svg || '').trim();
  if (!/^<svg[\s>]/i.test(text)) return '';
  if (/<script|<foreignObject|on\w+=|javascript:/i.test(text)) return '';
  return text;
}

function clampPercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function buildAssetSystemPrompt() {
  return `You generate small decorative SVG assets for an existing art portfolio interface.

Output ONLY valid JSON:
{
  "message": "short user-facing summary",
  "assets": [
    {
      "name": "short file-safe object name",
      "alt": "short object label",
      "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>...</svg>",
      "placement": { "x": 12, "y": 18, "size": 90, "rotate": -8, "opacity": 0.72 }
    }
  ]
}

Rules:
- Create 3 to 4 assets that satisfy the artist request.
- SVG only. No raster images, external URLs, script, foreignObject, embedded fonts, or event handlers.
- Keep each SVG compact (at most 1800 characters). Prefer a few expressive paths and shapes over intricate path data.
- Use currentColor, var(--color-accent), var(--color-primary), var(--color-paper), var(--color-secondary), and opacity so assets inherit the interface theme.
- Match the current layout's visual language and material system.
- Assets should be decorative interface art, not replacement portfolio work.
- placement.x and placement.y are percentages of the current interface surface.
- placement.size is pixels between 36 and 180.
- placement.rotate is degrees between -28 and 28.
- placement.opacity is between 0.25 and 0.95.`;
}

function buildAssetRetrySystemPrompt() {
  return `${buildAssetSystemPrompt()}

Your previous answer was cut off or was not valid JSON. Return a smaller response:
- Return exactly 3 compact assets.
- Keep each SVG under 1200 characters.
- Use simple geometric shapes and short path data.
- Do not include markdown fences, commentary, or any text outside the JSON object.`;
}

function buildAssetUserPrompt({ layout, presentation, prompt, existingAssets }) {
  return JSON.stringify({
    artistRequest: prompt,
    currentLayout: {
      key: layout.key,
      name: layout.name,
      metaphor: layout.metaphor,
      prompt: layout.prompt,
    },
    presentation: {
      visual_language: presentation?.visual_language,
      metaphor: presentation?.metaphor,
      encounter: presentation?.encounter,
      intent: presentation?.intent,
      components: presentation?.components,
      layout_engine: presentation?.layout_engine,
    },
    existingAssets,
  }, null, 2);
}

function uniqueAssetFile(assetsDir, base) {
  let filename = `${base}.svg`;
  let i = 2;
  while (fs.existsSync(path.join(assetsDir, filename))) {
    filename = `${base}-${i}.svg`;
    i += 1;
  }
  return filename;
}

async function generateDecorativeAssets({ apiKey, provider, layoutKey, prompt }) {
  const key = safeLayoutKey(layoutKey);
  if (!key) throw new Error('missing layout key');
  if (!prompt?.trim()) throw new Error('Tell the sparkle what object or asset to add.');

  const layout = listAllLayouts().find((item) => item.key === key);
  if (!layout) throw new Error('Unknown layout.');

  const dir = layout.generated
    ? path.join(ROOT, 'generated', key)
    : path.join(ROOT, 'layout-assets', key);
  const assetsDir = path.join(dir, 'assets');
  const presentation = layout.generated
    ? readJson(path.join(dir, 'presentation.json'), {})
    : readJson(path.join(ROOT, 'presentations', `${key}.json`), {});
  const indexPath = path.join(assetsDir, 'index.json');
  const decorationsPath = path.join(assetsDir, 'decorations.json');
  const existingIndex = readJson(indexPath, []);
  const existingAssets = Array.isArray(existingIndex) ? existingIndex : existingIndex.files || [];

  const normalizedProvider = normalizeProvider(provider);
  const requestAssets = (system, maxTokens, temperature) => callTextModel({
    provider: normalizedProvider,
    apiKey,
    system,
    user: buildAssetUserPrompt({ layout, presentation, prompt: prompt.trim(), existingAssets }),
    maxTokens,
    temperature,
    responseFormat: normalizedProvider === 'cerebras' ? { type: 'json_object' } : null,
  });

  let result = await requestAssets(buildAssetSystemPrompt(), 6000, 0.5);
  if (!result.text) throw new Error(`${providerLabel(normalizedProvider)} returned no assets`);

  let parsed;
  try {
    parsed = extractJson(result.text);
  } catch (firstError) {
    console.warn(
      `[assets/generate] Retrying compact response after ${result.stopReason || 'unknown stop reason'}: ${firstError.message}`
    );
    result = await requestAssets(buildAssetRetrySystemPrompt(), 6000, 0.25);
    if (!result.text) throw new Error(`${providerLabel(normalizedProvider)} returned no assets on retry`);
    try {
      parsed = extractJson(result.text);
    } catch (retryError) {
      throw new Error(`The decoration response was incomplete twice. Please try again with a more specific request. (${retryError.message})`);
    }
  }
  const rawAssets = Array.isArray(parsed.assets) ? parsed.assets : [];
  if (!rawAssets.length) throw new Error('No SVG assets were returned.');

  fs.mkdirSync(assetsDir, { recursive: true });
  const decorations = readJson(decorationsPath, []);
  const written = [];
  rawAssets.slice(0, 6).forEach((asset, index) => {
    const svg = sanitizeSvg(asset.svg);
    if (!svg) return;
    const base = slugifyName(asset.name || asset.alt || `${key}-asset-${Date.now()}-${index}`);
    const file = uniqueAssetFile(assetsDir, base);
    fs.writeFileSync(path.join(assetsDir, file), svg);
    const placement = asset.placement || {};
    const decoration = {
      file,
      src: layout.generated ? `generated/${key}/assets/${file}` : `layout-assets/${key}/assets/${file}`,
      alt: String(asset.alt || asset.name || file.replace(/\.svg$/, '')).slice(0, 80),
      x: clampPercent(placement.x, (12 + index * 17) % 88),
      y: clampPercent(placement.y, 12 + index * 13),
      size: clampNumber(placement.size, 36, 180, 76),
      rotate: clampNumber(placement.rotate, -28, 28, 0),
      opacity: clampNumber(placement.opacity, 0.25, 0.95, 0.72),
    };
    decorations.push(decoration);
    written.push(decoration);
  });

  if (!written.length) throw new Error('The generated assets were not valid safe SVG.');

  const nextIndex = [...new Set([...existingAssets, ...written.map((item) => item.file)])].sort();
  fs.writeFileSync(indexPath, JSON.stringify(nextIndex, null, 2));
  fs.writeFileSync(decorationsPath, JSON.stringify(decorations, null, 2));

  return {
    message: parsed.message || `Added ${written.length} new asset${written.length === 1 ? '' : 's'} to ${layout.name}.`,
    assets: written,
  };
}

module.exports = { generateDecorativeAssets };
