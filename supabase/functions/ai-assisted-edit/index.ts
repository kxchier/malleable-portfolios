const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = Deno.env.get('ANTHROPIC_TEXT_MODEL') || 'claude-sonnet-4-6';

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const text = (value: unknown, max: number) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

function extractJson(value: string): Record<string, any> {
  const raw = value.trim();
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Anthropic returned invalid JSON.');
  }
}

async function callAnthropic(apiKey: string, system: string, user: unknown, maxTokens = 2400) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: 'user', content: JSON.stringify(user) }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Anthropic request failed (${response.status}).`);
  const content = Array.isArray(data?.content) ? data.content.map((part: any) => part?.text || '').join('\n') : '';
  return extractJson(content);
}

const cursorSystem = `Convert a situated art-portfolio editing request into one safe JSON operation. Return only {"message":"brief proposal","operation":{...}}.
Allowed operations:
- stylePatch for text: {"type":"stylePatch","target":TARGET,"scope":"this|role|all-headings","patch":{"fontFamily":"...","fontSize":"32px","fontWeight":"700","fontStyle":"italic","textAlign":"left|center|right","letterSpacing":"0.04em","lineHeight":"1.2","textDecoration":"underline","transform":"rotate(-4deg)","opacity":"0.8"}}
- elementStylePatch for images/tiles/sections: {"type":"elementStylePatch","target":TARGET,"scope":"this|all-images|all-sections","patch":{"borderRadius":"24px","overflow":"hidden","border":"2px solid var(--color-accent)","boxShadow":"0 8px 24px rgba(0,0,0,.2)","filter":"grayscale(100%)","marginLeft":"24px","marginRight":"24px","padding":"12px","gap":"24px","transform":"rotate(-4deg)","opacity":"0.8"},"imagePatch":{"borderRadius":"24px","objectFit":"cover","objectPosition":"center"}}
- collectionVisibility: {"type":"collectionVisibility","target":TARGET,"visible":false}
- spacing: {"type":"spacing","target":TARGET,"gridGap":"32px","artSize":"220px","imagePadding":"12px"}
- noop.
Reuse the provided target. Use only the listed CSS properties and simple CSS values. Never return HTML, selectors, JavaScript, URLs, or arbitrary CSS.`;

const portfolioSystem = `Convert a whole art-portfolio editing request into safe JSON: {"message":"brief proposal","operations":[...]}.
Allowed operations:
- colorPatch {"type":"colorPatch","colors":{"background":"#ffffff","primary":"#111111","secondary":"#eeeeee","accent":"#ff6699","paper":"#ffffff","panel":"#f6f6f6"}}
- typographyPatch {"type":"typographyPatch","typography":{"heading1":{"fontFamily":"'Playfair Display', serif","fontSize":"3rem","fontWeight":"700"},"heading2":{},"body":{}}}
- spacing {"type":"spacing","gridGap":"32px","artSize":"220px","imagePadding":"12px"}
- layoutOverride {"type":"layoutOverride","collectionDisplay":"grid|horizontal|vertical","materialTexture":"textured|wood|paper|fabric|metal|glass","metadataDisplay":"none|below|side|overlay","socialPrototype":"none|likes|comments|likes-comments|notes|all"}
- elementStylePatch {"type":"elementStylePatch","scope":"all-images|all-sections","patch":{"borderRadius":"24px","boxShadow":"0 8px 24px rgba(0,0,0,.2)","marginLeft":"32px","marginRight":"32px","padding":"16px","gap":"24px"},"imagePatch":{"objectFit":"cover"}}
- decorativeAssets {"type":"decorativeAssets","prompt":"what to draw"}
- noop.
Return multiple operations for broad mood/style changes. Use decorativeAssets only when visible objects, doodles, motifs, stickers, icons, ornaments, or background art are explicitly requested. Use only hex colors and simple safe CSS values. Never return HTML, JavaScript, selectors, files, or URLs.`;

const assetSystem = `Generate decorative SVG interface art. Return only JSON: {"message":"summary","assets":[{"name":"file-safe name","alt":"label","svg":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>...</svg>","placement":{"x":12,"y":18,"size":90,"rotate":-8,"opacity":0.72}}]}.
Return 3 compact assets. SVG only, each under 2400 characters. No raster images, external URLs, scripts, foreignObject, embedded fonts, animation elements, or event handlers. Use currentColor and var(--color-accent), var(--color-primary), var(--color-paper), or var(--color-secondary). placement x/y are 0-100 percent, size 36-180px, rotate -28..28, opacity .25-.95.`;

function safeSvg(value: unknown) {
  const svg = String(value || '').trim().slice(0, 3000);
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) return '';
  if (/<script|<foreignObject|<animate|<set|\son\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(svg)) return '';
  return svg;
}

function normalizeAssets(parsed: Record<string, any>) {
  const assets = (Array.isArray(parsed.assets) ? parsed.assets : []).slice(0, 4).flatMap((asset: any, index: number) => {
    const svg = safeSvg(asset?.svg); if (!svg) return [];
    const placement = asset?.placement || {};
    return [{
      name: text(asset.name || `decoration-${index + 1}`, 50).replace(/[^a-z0-9_-]/gi, '-'),
      alt: text(asset.alt || asset.name || 'decoration', 80), svg,
      x: clamp(placement.x, 0, 100, 12 + index * 20), y: clamp(placement.y, 0, 100, 14 + index * 16),
      size: clamp(placement.size, 36, 180, 76), rotate: clamp(placement.rotate, -28, 28, 0),
      opacity: clamp(placement.opacity, 0.25, 0.95, 0.72),
    }];
  });
  if (!assets.length) throw new Error('Anthropic did not return valid safe SVG assets.');
  return { message: text(parsed.message || `Added ${assets.length} decorations.`, 160), assets };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json(500, { error: 'ANTHROPIC_API_KEY is not configured in Supabase.' });
    const body = await request.json();
    const mode = body?.mode;
    if (mode === 'cursor') {
      const parsed = await callAnthropic(apiKey, cursorSystem, {
        target: body.target, request: text(body.prompt, 1200), scope: body.scope,
        presentationId: text(body.presentationId, 80), context: body.context || null,
      }, 1400);
      const allowed = ['stylePatch', 'elementStylePatch', 'collectionVisibility', 'spacing', 'noop'];
      if (!allowed.includes(parsed?.operation?.type)) throw new Error('Anthropic returned an unsupported cursor operation.');
      return json(200, { model: MODEL, message: text(parsed.message, 240), operation: parsed.operation });
    }
    if (mode === 'portfolio') {
      const parsed = await callAnthropic(apiKey, portfolioSystem, {
        request: text(body.prompt, 1600), layout: body.layout || null, presentation: body.presentation || null,
        theme: body.theme || null, spacing: body.spacing || null, contentSummary: body.contentSummary || null,
      }, 2800);
      const source = Array.isArray(parsed.operations) ? parsed.operations : parsed.operation ? [parsed.operation] : [];
      const allowed = ['colorPatch', 'typographyPatch', 'spacing', 'layoutOverride', 'elementStylePatch', 'decorativeAssets', 'noop'];
      const operations = source.filter((operation: any) => allowed.includes(operation?.type)).slice(0, 8);
      if (!operations.length) throw new Error('Anthropic returned no supported portfolio operations.');
      return json(200, { model: MODEL, message: text(parsed.message, 240), operations });
    }
    if (mode === 'assets') {
      const parsed = await callAnthropic(apiKey, assetSystem, {
        request: text(body.prompt, 800), layout: body.layout || null, presentation: body.presentation || null,
        existingDecorations: clamp(body.existingDecorationCount, 0, 100, 0),
      }, 5200);
      return json(200, { model: MODEL, ...normalizeAssets(parsed) });
    }
    return json(400, { error: 'Unknown editing mode.' });
  } catch (error) {
    console.error('[ai-assisted-edit]', error);
    return json(400, { error: error instanceof Error ? error.message : 'Could not apply AI-assisted edit.' });
  }
});
