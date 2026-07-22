const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-4.1-mini';
const IMAGE_DETAIL = Deno.env.get('OPENAI_IMAGE_DETAIL') || 'high';
const MAX_IMAGE_LENGTH = 1_800_000;

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const asText = (value: unknown, max: number) => String(value || '').trim().slice(0, max);
const asList = (value: unknown, max = 8): string[] => Array.isArray(value)
  ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, max)
  : [];
const asScale = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};

function normalizeTokens(parsed: Record<string, any>) {
  const typography = parsed.typography && typeof parsed.typography === 'object' ? parsed.typography : {};
  const layout = parsed.layout && typeof parsed.layout === 'object' ? parsed.layout : {};
  const interaction = parsed.interaction && typeof parsed.interaction === 'object' ? parsed.interaction : {};
  const contract = parsed.layoutContract || parsed.layout_contract || {};
  const translation = parsed.interfaceTranslation || parsed.interface_translation || {};
  const axes = parsed.designAxes || parsed.design_axes || {};
  const palette = Array.isArray(parsed.palette) ? parsed.palette.flatMap((color: any) => {
    const hex = asText(color?.hex, 20);
    return /^#[0-9a-fA-F]{6}$/.test(hex)
      ? [{ name: asText(color?.name, 40), hex, role: asText(color?.role, 60) }]
      : [];
  }).slice(0, 8) : [];

  return {
    summary: asText(parsed.summary, 140),
    keywords: asList(parsed.keywords, 3),
    setting: asList(parsed.setting, 4),
    subjects: asList(parsed.subjects, 4),
    mood: asList(parsed.mood),
    visualStyle: asList(parsed.visualStyle || parsed.visual_style, 10),
    materialSystem: asList(parsed.materialSystem || parsed.material_system),
    layoutContract: {
      background: asText(contract.background, 180), density: asText(contract.density, 120),
      composition: asText(contract.composition, 180), interaction: asText(contract.interaction, 140),
    },
    requiredMotifs: asList(parsed.requiredMotifs || parsed.required_motifs || parsed.motifVocabulary || parsed.motif_vocabulary, 12),
    requiredMaterials: asList(parsed.requiredMaterials || parsed.required_materials || parsed.materialSystem || parsed.material_system, 10),
    forbiddenSimplifications: asList(parsed.forbiddenSimplifications || parsed.forbidden_simplifications),
    palette,
    typography: {
      personality: asList(typography.personality, 5),
      recommendedFonts: asList(typography.recommendedFonts || typography.recommended_fonts, 5),
      weight: asText(typography.weight, 50), casing: asText(typography.casing, 50),
    },
    layout: {
      composition: asText(layout.composition, 140), density: asText(layout.density, 60),
      depth: asText(layout.depth, 60), edges: asText(layout.edges, 80), texture: asText(layout.texture, 100),
      mustPreserve: asList(layout.mustPreserve || layout.must_preserve),
    },
    components: asList(parsed.components, 10),
    motifVocabulary: asList(parsed.motifVocabulary || parsed.motif_vocabulary, 12),
    interfaceTranslation: {
      metaphor: asText(translation.metaphor, 90), navigation: asText(translation.navigation, 140),
      components: asList(translation.components, 10),
    },
    interaction: {
      pace: asText(interaction.pace, 80), motion: asText(interaction.motion, 100),
      affordances: asList(interaction.affordances),
    },
    designAxes: {
      skeuomorphic: asScale(axes.skeuomorphic, 0.7), friction: asScale(axes.friction, 0.45),
      softness: asScale(axes.softness, 0.65),
    },
    generationPrompt: asText(parsed.generationPrompt || parsed.generation_prompt, 640),
  };
}

function extractJson(value: string): Record<string, any> {
  const trimmed = value.trim();
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('OpenAI returned an invalid image analysis.');
  }
}

const systemPrompt = `You analyze reference images for a malleable artist portfolio generator.
Return ONLY valid JSON, with no markdown. Extract a reusable interface vibe as structured design tokens.
Use this shape:
{"summary":"short reusable vibe","keywords":["2-3 semantic tags"],"setting":[],"subjects":[],"mood":[],"visualStyle":[],"materialSystem":[],"layoutContract":{"background":"","density":"","composition":"","interaction":""},"requiredMotifs":[],"requiredMaterials":[],"forbiddenSimplifications":[],"palette":[{"name":"","hex":"#ffffff","role":""}],"typography":{"personality":[],"recommendedFonts":[],"weight":"","casing":""},"layout":{"composition":"","density":"","depth":"","edges":"","texture":"","mustPreserve":[]},"components":[],"motifVocabulary":[],"interfaceTranslation":{"metaphor":"","navigation":"","components":[]},"interaction":{"pace":"","motion":"","affordances":[]},"designAxes":{"skeuomorphic":0.5,"friction":0.5,"softness":0.5},"generationPrompt":"3-4 sentence implementation brief under 130 words"}
Be literal about layering, opacity, glow, line quality, background, density, motifs, and material techniques. Generalize exact objects and text into reusable portfolio components. requiredMotifs and requiredMaterials must be concrete implementation checklists. forbiddenSimplifications must name generic treatments that would lose the reference. The first viewport must remain visibly inspired by the reference.`;

async function requestTokens(apiKey: string, image: string, fileName: string, maxTokens: number) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'text', text: `Analyze this reference image${fileName ? ` (${fileName})` : ''} for a portfolio website generator.` },
          { type: 'image_url', image_url: { url: image, detail: IMAGE_DETAIL } },
        ] },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed (${response.status}).`);
  return normalizeTokens(extractJson(data?.choices?.[0]?.message?.content || ''));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json(500, { error: 'OPENAI_API_KEY is not configured in Supabase.' });
    const body = await request.json();
    const image = asText(body?.image, MAX_IMAGE_LENGTH + 1);
    const mimeType = asText(body?.mimeType, 80).toLowerCase();
    const fileName = asText(body?.fileName, 160);
    if (!image || image.length > MAX_IMAGE_LENGTH) return json(413, { error: 'The reference image is too large.' });
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) {
      return json(415, { error: 'Use a PNG, JPEG, WebP, or GIF image.' });
    }
    if (!image.startsWith('data:image/')) return json(400, { error: 'The image payload is invalid.' });

    let tokens;
    try { tokens = await requestTokens(apiKey, image, fileName, 1000); }
    catch (error) {
      if (!/JSON|parse|Unexpected end|invalid image analysis/i.test(String(error))) throw error;
      tokens = await requestTokens(apiKey, image, fileName, 1700);
    }
    return json(200, { model: MODEL, tokens });
  } catch (error) {
    console.error('[image-design-tokens]', error);
    return json(400, { error: error instanceof Error ? error.message : 'Could not analyze image.' });
  }
});
