const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_TEXT_MODEL') || 'claude-sonnet-4-6';
const MAX_LAYOUTS = 80;

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const text = (value: unknown, max: number) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const clamp01 = (value: unknown, fallback = 0.5) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};

function extractJson(value: string): Record<string, any> {
  const trimmed = value.trim();
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('OpenAI returned an invalid ranking.');
  }
}

function normalizeLayouts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LAYOUTS).flatMap((layout: any) => {
    const key = text(layout?.key, 80);
    if (!key) return [];
    return [{
      key,
      name: text(layout?.name, 80),
      metaphor: text(layout?.metaphor, 100),
      description: text(layout?.description, 500),
      generated: Boolean(layout?.generated),
      designSpace: layout?.designSpace && typeof layout.designSpace === 'object'
        ? { x: clamp01(layout.designSpace.x), y: clamp01(layout.designSpace.y) }
        : null,
      colorKeys: Array.isArray(layout?.colorKeys) ? layout.colorKeys.map((item: unknown) => text(item, 40)).slice(0, 20) : [],
    }];
  });
}

function normalizeResult(parsed: Record<string, any>, layouts: Array<{ key: string }>) {
  const scoreEntries = Array.isArray(parsed.scores)
    ? parsed.scores.map((score: any) => [score?.key, score])
    : Object.entries(parsed.scores || {});
  const byKey = new Map(scoreEntries.map((entry: any[]) => [String(entry[0]), entry[1]]));
  return {
    terms: Array.isArray(parsed.terms) ? parsed.terms.map((term: any) => ({
      value: clamp01(term?.value),
      label: text(term?.label, 48),
      description: text(term?.description, 100),
    })).filter((term: any) => term.label).sort((a: any, b: any) => a.value - b.value).slice(0, 8) : [],
    scores: layouts.map((layout) => {
      const score: any = byKey.get(layout.key) || {};
      return { key: layout.key, value: clamp01(score.value), rationale: text(score.rationale || 'unranked', 100) };
    }),
  };
}

const systemPrompt = `You rank art portfolio interface concepts on a custom design axis.
Return ONLY valid JSON shaped as {"terms":[{"value":0.0,"label":"phrase","description":"brief meaning"}],"scores":{"layout_key":{"value":0.0,"rationale":"brief phrase"}}}.
The axis runs from leftLabel at 0 to rightLabel at 1. Create 6-8 short semantic terms across it. Use layout metaphor, description, design-space metadata, and color keys as evidence. Return one score for every layout key. Term labels must be 1-4 words, descriptions under 12 words, and rationales under 8 words.`;

async function rankWithAnthropic(apiKey: string, userPrompt: string) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Anthropic request failed (${response.status}).`);
  const content = Array.isArray(data?.content)
    ? data.content.map((part: any) => part?.text || '').join('\n')
    : '';
  return { model: ANTHROPIC_MODEL, content };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return json(500, { error: 'ANTHROPIC_API_KEY is not configured in Supabase.' });
    const body = await request.json();
    const axis = {
      name: text(body?.axis?.name, 120),
      leftLabel: text(body?.axis?.leftLabel, 300),
      rightLabel: text(body?.axis?.rightLabel, 300),
    };
    if (!axis.leftLabel || !axis.rightLabel) return json(400, { error: 'The axis needs both endpoints.' });
    const layouts = normalizeLayouts(body?.layouts);
    if (!layouts.length) return json(400, { error: 'No layouts were provided.' });

    const userPrompt = JSON.stringify({ axis, layouts });
    const ranking = await rankWithAnthropic(anthropicKey, userPrompt);
    const parsed = extractJson(ranking.content);
    return json(200, { model: ranking.model, ...normalizeResult(parsed, layouts) });
  } catch (error) {
    console.error('[design-axis]', error);
    return json(400, { error: error instanceof Error ? error.message : 'Could not rank layouts.' });
  }
});
