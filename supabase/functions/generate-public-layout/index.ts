const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = Deno.env.get('ANTHROPIC_TEXT_MODEL') || 'claude-sonnet-4-6';
const GENERATE_MAX_TOKENS = Math.max(
  12_000,
  Math.min(32_000, Number(Deno.env.get('GENERATE_MAX_TOKENS')) || 20_000),
);

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const cleanText = (value: unknown, max: number) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (
  allowed.includes(value as T) ? value as T : fallback
);
const hex = (value: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

function extractJson(value: string): Record<string, any> {
  const text = value.trim();
  try { return JSON.parse(text); } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = text.slice(start, end + 1);
      try { return JSON.parse(candidate); } catch { return JSON.parse(repairJsonStringLiterals(candidate)); }
    }
    throw new Error('Anthropic returned invalid JSON.');
  }
}

function repairJsonStringLiterals(value: string) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (const char of value) {
    if (!inString) {
      output += char;
      if (char === '"') inString = true;
    } else if (escaped) {
      output += char;
      escaped = false;
    } else if (char === '\\') {
      output += char;
      escaped = true;
    } else if (char === '"') {
      output += char;
      inString = false;
    } else if (char === '\n') output += '\\n';
    else if (char === '\r') output += '\\r';
    else if (char === '\t') output += '\\t';
    else output += char;
  }
  return output;
}

async function callAnthropic(apiKey: string, system: string, user: unknown, maxTokens: number) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: JSON.stringify(user) }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Anthropic request failed (${response.status}).`);
  const content = Array.isArray(data?.content) ? data.content.map((part: any) => part?.text || '').join('\n') : '';
  if (data?.stop_reason === 'max_tokens') {
    throw new Error(
      `The generated interface was too large and was cut off before it finished. ` +
      `Please try generating again with a slightly simpler design request.`,
    );
  }
  return extractJson(content);
}

const questionSystem = `You help an artist clarify a portfolio-interface request. Return only JSON:
{"done":false,"question":{"id":"short_id","category":"metaphor_place_world","question":"...","options":[{"label":"...","description":"..."}]}}
Ask exactly one useful question with exactly 3 distinct options. Questions must be under 140 characters; option labels under 48 characters. Ask at most 3 questions total. Use prior answers. If three answers already exist, return {"done":true}.`;

const generationSystem = `You generate a complete custom art-portfolio interface bundle. Return only valid JSON with this exact shape:
{
 "name":"1-2 word name", "key":"snake_case_id", "metaphor":"short_metaphor_id",
 "themeColors":{"background":"#ffffff","primary":"#111111","accent":"#ff6699","paper":"#ffffff","panel":"#eeeeee","secondary":"#cccccc"},
 "themeTypography":{"heading1":{"fontFamily":"font stack","fontSize":"3rem","fontWeight":"700"},"heading2":{"fontFamily":"font stack","fontSize":"1.4rem","fontWeight":"600"},"body":{"fontFamily":"font stack","fontSize":"1rem","fontWeight":"400"}},
 "themeSpacing":{"gridGap":"24px","artSize":"210px","imagePadding":"12px"},
 "presentation":{"id":"snake_case_id","layout_family":"...","metaphor":"...","visual_language":{},"encounter":{},"intent":{},"components":[],"ui_spec":{},"layout_engine":{}},
 "css":"complete CSS string",
 "renderScript":"complete JavaScript string",
 "assets":{"name.svg":"<svg>...</svg>"}
}
The renderScript must register window.GeneratedLayouts[key] with mount(root, ctx). ctx contains collections, helpers, assets, presentation, and theme. Loop through every collection and every image. Each col.images item is an IMAGE PATH STRING, not an object: never read img.src, img.path, or img.url. Create collection wrappers with helpers.collectionFrame(col, col.originalIndex ?? ci, {className:'...'}). Create artwork with helpers.workTile(img,{className:'...',collectionIndex:col.originalIndex ?? ci,workIndex:wi}). Keep the img element created by helpers.workTile; do not clear the tile with innerHTML or replace its image. Add decorative wrappers around the returned tile if needed. If the input says hasReferenceImage is true, its data URL will be available as ctx.assets['reference-image']; use it visibly as a translucent underlay, texture image, or collage layer without obscuring the artist's work.
CSS must be scoped under body.view-{key}, use only --color-background, --color-primary, --color-secondary, --color-accent, --color-paper, --color-panel, --space-gridGap, --space-artSize, and --space-imagePadding variables. Show full artwork with object-fit:contain unless cropped thumbnails are explicitly requested. Do not use @import, external URLs, network APIs, browser storage, cookies, parent/top/opener, postMessage, eval, Function, dynamic import, or script injection. Interactions may use DOM events, timers, requestAnimationFrame, observers, and CSS animation. Assets must be self-contained SVG using currentColor or theme variables. Make the composition and interaction genuinely custom to the requested metaphor rather than a generic card grid.
Keep the bundle concise enough to finish reliably: CSS under 12,000 characters, renderScript under 12,000 characters, presentation metadata under 4,000 characters, no more than 4 SVG assets, and each SVG under 3,000 characters. Do not sacrifice rendering every collection and artwork.`;

function normalizeQuestion(parsed: Record<string, any>, answerCount: number) {
  if (parsed.done === true || answerCount >= 3) return { done: true };
  const source = parsed.question || parsed;
  const options = Array.isArray(source?.options) ? source.options.slice(0, 3).map((option: any) => ({
    label: cleanText(option?.label, 48),
    description: cleanText(option?.description, 160),
  })).filter((option: any) => option.label) : [];
  if (!source?.question || options.length !== 3) throw new Error('Anthropic did not return a usable design question.');
  return { done: false, question: {
    id: cleanText(source.id || `q${answerCount + 1}`, 40).replace(/[^a-z0-9_-]/gi, '_'),
    category: cleanText(source.category || 'design_direction', 40),
    question: cleanText(source.question, 140),
    options,
  } };
}

function normalizeTypography(value: any) {
  const out: Record<string, any> = {};
  for (const token of ['heading1', 'heading2', 'body']) {
    const source = value?.[token] || {};
    const fontFamily = cleanText(source.fontFamily, 120);
    const fontSize = cleanText(source.fontSize, 40);
    const fontWeight = cleanText(source.fontWeight, 10);
    out[token] = {
      fontFamily: /^[a-z0-9 ,'"-]+$/i.test(fontFamily) ? fontFamily : 'system-ui, sans-serif',
      fontSize: /^(clamp\([^)]+\)|[0-9.]+(px|rem|em|%))$/.test(fontSize) ? fontSize : token === 'heading1' ? '3rem' : token === 'heading2' ? '1.4rem' : '1rem',
      fontWeight: /^(normal|bold|[1-9]00)$/.test(fontWeight) ? fontWeight : token === 'body' ? '400' : '700',
    };
  }
  return out;
}

function safeSvg(value: unknown) {
  const svg = String(value || '').trim().slice(0, 60_000);
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) return '';
  if (/<script|<foreignObject|\son\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(svg)) return '';
  return svg;
}

function normalizeLayout(parsed: Record<string, any>) {
  const key = cleanText(parsed.key || parsed.name || 'generated_study', 50)
    .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'generated_study';
  const css = String(parsed.css || '').slice(0, 120_000);
  const renderScript = String(parsed.renderScript || '').slice(0, 120_000);
  if (!css || !renderScript || !parsed.presentation || typeof parsed.presentation !== 'object') {
    throw new Error('Anthropic did not return a complete interface bundle.');
  }
  if (/@import|expression\s*\(|url\s*\(\s*["']?(?:https?:|javascript:|data:text\/html)/i.test(css)) {
    throw new Error('Generated CSS requested a disallowed external capability.');
  }
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|eval|postMessage)\b|document\s*\.\s*cookie|window\s*\.\s*(?:parent|top|opener)|\bimport\s*\(/i.test(renderScript)) {
    throw new Error('Generated renderer requested a disallowed browser capability. Please generate again.');
  }
  if (!renderScript.includes('GeneratedLayouts')) throw new Error('Generated renderer did not register a layout.');
  const assets: Record<string, string> = {};
  Object.entries(parsed.assets || {}).slice(0, 8).forEach(([filename, value]) => {
    const safeName = cleanText(filename, 80).replace(/[^a-z0-9._-]/gi, '_');
    const svg = safeSvg(value);
    if (safeName.endsWith('.svg') && svg) assets[safeName] = svg;
  });
  const spacingValue = (value: unknown, fallback: string) => {
    const result = cleanText(value, 30);
    return /^[0-9.]+(px|rem|em|vw|%)$/.test(result) ? result : fallback;
  };
  const colors = parsed.themeColors || {};
  return {
    name: cleanText(parsed.name || 'Generated Study', 40),
    key,
    metaphor: cleanText(parsed.metaphor || 'custom portfolio', 80),
    bundle: {
      presentation: { ...parsed.presentation, id: key, metaphor: cleanText(parsed.metaphor || parsed.presentation.metaphor || key, 80) },
      css,
      renderScript,
      assets,
      themeColors: {
        background: hex(colors.background, '#f7f4ee'), primary: hex(colors.primary, '#211d1a'),
        accent: hex(colors.accent, '#b45c47'), paper: hex(colors.paper, '#ffffff'),
        panel: hex(colors.panel, '#ebe5dc'), secondary: hex(colors.secondary, '#9a8875'),
      },
      themeTypography: normalizeTypography(parsed.themeTypography),
      themeSpacing: {
        gridGap: spacingValue(parsed.themeSpacing?.gridGap, '24px'),
        artSize: spacingValue(parsed.themeSpacing?.artSize, '210px'),
        imagePadding: spacingValue(parsed.themeSpacing?.imagePadding, '12px'),
      },
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json(500, { error: 'ANTHROPIC_API_KEY is not configured in Supabase.' });
    const body = await request.json();
    const prompt = cleanText(body?.prompt, 8000);
    if (!prompt) return json(400, { error: 'A generation prompt is required.' });
    const answers = Array.isArray(body?.answers) ? body.answers.slice(0, 3) : [];
    if (body?.mode === 'question') {
      const parsed = await callAnthropic(apiKey, questionSystem, { prompt, answers, designSpace: body?.designSpace || null }, 1000);
      return json(200, { model: MODEL, ...normalizeQuestion(parsed, answers.length) });
    }
    const parsed = await callAnthropic(apiKey, generationSystem, {
      prompt, answers, designSpace: body?.designSpace || null,
      hasReferenceImage: body?.hasReferenceImage === true,
      collections: Array.isArray(body?.collections) ? body.collections.slice(0, 40) : [],
      existingLayouts: Array.isArray(body?.layouts) ? body.layouts.slice(0, 30) : [],
    }, GENERATE_MAX_TOKENS);
    return json(200, { model: MODEL, ...normalizeLayout(parsed) });
  } catch (error) {
    console.error('[generate-public-layout]', error);
    return json(400, { error: error instanceof Error ? error.message : 'Could not generate layout.' });
  }
});
