/** Extract structured portfolio design tokens from an uploaded reference image. */
const { apiKeyFor } = require('./ai-config.js');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-4.1-mini';
const DEFAULT_IMAGE_DETAIL = process.env.OPENAI_IMAGE_DETAIL || 'high';

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty model response');
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (innerErr) {
        throw new Error(`could not parse JSON from image analysis: ${innerErr.message}`);
      }
    }
    throw new Error(`could not parse JSON from image analysis: ${err.message}`);
  }
}

function normalizeList(value, max = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, max);
}

function normalizeColor(item) {
  if (!item || typeof item !== 'object') return null;
  const hex = String(item.hex || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    name: String(item.name || '').trim().slice(0, 40),
    hex,
    role: String(item.role || '').trim().slice(0, 60),
  };
}

function normalizeScale(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeLayoutContract(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    background: String(source.background || '').trim().slice(0, 180),
    density: String(source.density || '').trim().slice(0, 120),
    composition: String(source.composition || '').trim().slice(0, 180),
    interaction: String(source.interaction || '').trim().slice(0, 140),
  };
}

function normalizeTokens(parsed) {
  const palette = Array.isArray(parsed.palette)
    ? parsed.palette.map(normalizeColor).filter(Boolean).slice(0, 8)
    : [];
  const typography = parsed.typography && typeof parsed.typography === 'object' ? parsed.typography : {};
  const layout = parsed.layout && typeof parsed.layout === 'object' ? parsed.layout : {};
  const interaction = parsed.interaction && typeof parsed.interaction === 'object' ? parsed.interaction : {};

  return {
    summary: String(parsed.summary || '').trim().slice(0, 140),
    keywords: normalizeList(parsed.keywords, 3),
    setting: normalizeList(parsed.setting, 4),
    subjects: normalizeList(parsed.subjects, 4),
    mood: normalizeList(parsed.mood, 8),
    visualStyle: normalizeList(parsed.visualStyle || parsed.visual_style, 10),
    materialSystem: normalizeList(parsed.materialSystem || parsed.material_system, 8),
    layoutContract: normalizeLayoutContract(parsed.layoutContract || parsed.layout_contract),
    requiredMotifs: normalizeList(parsed.requiredMotifs || parsed.required_motifs || parsed.motifVocabulary || parsed.motif_vocabulary, 12),
    requiredMaterials: normalizeList(parsed.requiredMaterials || parsed.required_materials || parsed.materialSystem || parsed.material_system, 10),
    forbiddenSimplifications: normalizeList(parsed.forbiddenSimplifications || parsed.forbidden_simplifications, 8),
    palette,
    typography: {
      personality: normalizeList(typography.personality, 5),
      recommendedFonts: normalizeList(typography.recommendedFonts || typography.recommended_fonts, 5),
      weight: String(typography.weight || '').trim().slice(0, 50),
      casing: String(typography.casing || '').trim().slice(0, 50),
    },
    layout: {
      composition: String(layout.composition || '').trim().slice(0, 140),
      density: String(layout.density || '').trim().slice(0, 60),
      depth: String(layout.depth || '').trim().slice(0, 60),
      edges: String(layout.edges || '').trim().slice(0, 80),
      texture: String(layout.texture || '').trim().slice(0, 100),
      mustPreserve: normalizeList(layout.mustPreserve || layout.must_preserve, 8),
    },
    components: normalizeList(parsed.components, 10),
    motifVocabulary: normalizeList(parsed.motifVocabulary || parsed.motif_vocabulary, 12),
    interfaceTranslation: {
      metaphor: String(parsed.interfaceTranslation?.metaphor || parsed.interface_translation?.metaphor || '').trim().slice(0, 90),
      navigation: String(parsed.interfaceTranslation?.navigation || parsed.interface_translation?.navigation || '').trim().slice(0, 140),
      components: normalizeList(parsed.interfaceTranslation?.components || parsed.interface_translation?.components, 10),
    },
    interaction: {
      pace: String(interaction.pace || '').trim().slice(0, 80),
      motion: String(interaction.motion || '').trim().slice(0, 100),
      affordances: normalizeList(interaction.affordances, 8),
    },
    designAxes: {
      skeuomorphic: normalizeScale(parsed.designAxes?.skeuomorphic ?? parsed.design_axes?.skeuomorphic, 0.7),
      friction: normalizeScale(parsed.designAxes?.friction ?? parsed.design_axes?.friction, 0.45),
      softness: normalizeScale(parsed.designAxes?.softness ?? parsed.design_axes?.softness, 0.65),
    },
    generationPrompt: String(parsed.generationPrompt || parsed.generation_prompt || '').trim().slice(0, 640),
  };
}

function buildSystemPrompt() {
  return `You analyze reference images for a malleable artist portfolio generator.

Return ONLY valid JSON. Do not include markdown.
Extract the image's interface vibe as structured design tokens, not loose tags.

Use this exact shape:
{
  "summary": "one short sentence about the reusable vibe",
  "keywords": ["loud", "maximalist", "oceanic"],
  "setting": ["broad spatial motifs, not every visible object"],
  "subjects": ["only reusable interface motifs, not exact labels or one-off content"],
  "mood": ["quiet", "gentle"],
  "visualStyle": ["watercolor", "hand-drawn linework"],
  "materialSystem": ["translucent vellum layers", "glowing sticker collage", "pencil doodles over washes"],
  "layoutContract": {
    "background": "how the page background must be built",
    "density": "how busy/open the first viewport should feel",
    "composition": "how UI and motifs should overlap or arrange",
    "interaction": "how interaction should preserve the image language"
  },
  "requiredMotifs": ["large translucent butterfly top right", "pink sketch stars left side"],
  "requiredMaterials": ["watercolor wash", "pencil sketch lines", "vellum opacity"],
  "forbiddenSimplifications": ["plain diary page", "clean scrapbook cards"],
  "palette": [
    { "name": "cream", "hex": "#f7f1e7", "role": "background" }
  ],
  "typography": {
    "personality": ["handmade", "soft"],
    "recommendedFonts": ["Georgia", "Trebuchet MS"],
    "weight": "light/regular/bold feel",
    "casing": "title case/lowercase/mixed"
  },
  "layout": {
    "composition": "spatial arrangement",
    "density": "airy/dense/etc",
    "depth": "flat/layered/etc",
    "edges": "rounded/hand-drawn/etc",
    "texture": "paper/grain/etc",
    "mustPreserve": ["specific composition/material traits the generated website must visibly keep"]
  },
  "components": ["reusable portfolio UI component patterns implied by the image"],
  "motifVocabulary": ["specific visible motifs to reuse as interface chrome"],
  "interfaceTranslation": {
    "metaphor": "short interface metaphor",
    "navigation": "how visitors move through it",
    "components": ["general UI components to generate"]
  },
  "interaction": {
    "pace": "quick/slow/lingering",
    "motion": "suggested motion behavior",
    "affordances": ["clickable windows", "poster links"]
  },
  "designAxes": {
    "skeuomorphic": 0.0,
    "friction": 0.0,
    "softness": 0.0
  },
  "generationPrompt": "a concise 3-4 sentence implementation brief for generating a portfolio interface from these tokens"
}

Extraction rules:
- Keep the output compact and reusable.
- Do not transcribe exact visible text from the image unless it is a brand name or the user explicitly needs it.
- Do not require exact object positions, exact labels, or exact scene contents. Generalize them into reusable patterns.
- Be literal about the reference's visible material system: layering, opacity, glow, line quality, background treatment, density, and repeated motifs.
- If the image is a collage, do not reduce it to "diary", "scrapbook", or "paper" alone. Name the actual collage mechanics: translucent overlaps, sticker-like motifs, doodle marks, washes, soft bloom, etc.
- motifVocabulary must list concrete motifs a generator can draw in CSS/SVG/DOM, such as butterflies, flowers, stars, bows, mushrooms, little windows, clouds, vines, sparkles, lace, stickers, or sketch marks when present.
- requiredMotifs must be an implementation checklist, not aesthetic tags. Include concrete drawable things with rough scale or placement when visible.
- requiredMaterials must name concrete rendering techniques: image underlay, translucent overlays, watercolor wash, paper grain, pencil lines, soft glow, sticker edges, etc.
- forbiddenSimplifications must name generic metaphors that would lose the image.
- layoutContract must say how the website should be constructed, not how it should "feel".
- layout.mustPreserve must list non-negotiable visual traits that should be apparent in the first viewport.
- Prefer "section poster links" over "a poster labeled Research on the right".
- Prefer "floating translucent profile card" over exact card copy or exact placement.
- keywords must contain 2-3 short, artist-facing semantic tags. Use words like loud, maximalist, minimalist, oceanic, industrial, playful, delicate, chaotic, archival, glossy, soft, brutalist. Avoid plain color names unless the color is the central concept.
- The generationPrompt must be 3-4 sentences, under 130 words, and should describe style, material system, required motifs, component language, and mood.
- The generationPrompt must say what NOT to collapse into when a generic metaphor would lose the image, for example "not a plain diary page" or "not a generic gallery".`;
}

async function analyzeImageDesignTokens({ image, mimeType, fileName, apiKey }) {
  if (!image || typeof image !== 'string') throw new Error('missing image');
  const resolvedKey = apiKey || apiKeyFor('openai');
  if (!resolvedKey) throw new Error('missing OpenAI API key in .env or environment');

  const dataUrl = image.startsWith('data:')
    ? image
    : `data:${mimeType || 'image/png'};base64,${image}`;

  const buildBody = (maxTokens) => ({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    temperature: 0.25,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this reference image${fileName ? ` (${fileName})` : ''} for a portfolio website generator. Produce structured design tokens and a high-fidelity generation prompt that keeps the generated website visibly inspired by the reference image.`,
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: DEFAULT_IMAGE_DETAIL },
          },
        ],
      },
    ],
  });

  async function requestTokens(maxTokens) {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBody(maxTokens)),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || res.statusText;
      throw new Error(`OpenAI API error (${res.status}): ${msg}`);
    }

    const text = data?.choices?.[0]?.message?.content || '';
    return normalizeTokens(extractJson(text));
  }

  let tokens;
  try {
    tokens = await requestTokens(1000);
  } catch (err) {
    if (!/JSON|parse|Unexpected end|incomplete/i.test(err.message)) throw err;
    tokens = await requestTokens(1700);
  }

  return {
    model: DEFAULT_MODEL,
    tokens,
  };
}

module.exports = { analyzeImageDesignTokens };
