/** Parse cursor-assistant requests into validated local edit operations. */
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';
const DEFAULT_MODEL = process.env.CEREBRAS_MODEL || 'zai-glm-4.7';

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

function buildOperationSystemPrompt() {
  return `You convert situated portfolio-editing requests into small JSON operations.

Output ONLY valid JSON:
{
  "message": "brief user-facing proposal",
  "operation": { ... }
}

The user is editing an art portfolio. They clicked a visible object, so words like "this" and "here" refer to target.

Allowed operation types:
1. stylePatch
   Use for local style edits to the selected text. Do NOT create a new interface for text styling.
   Shape:
   {
     "type": "stylePatch",
     "target": target,
     "scope": "this" | "presentation" | "all",
     "patch": {
       "fontFamily": "Georgia",
       "fontSize": "32px",
       "fontWeight": "700",
       "fontStyle": "italic",
       "textAlign": "left|center|right",
       "letterSpacing": "0.04em",
       "lineHeight": "1.2",
       "textDecoration": "underline",
       "transform": "rotate(-4deg)",
       "transformOrigin": "left center",
       "opacity": "0.8"
     }
   }

2. collectionVisibility
   Use when the user wants a collection hidden/shown in the current presentation.
   { "type": "collectionVisibility", "target": target, "visible": false }

3. spacing
   Use for making the current presentation less/more crowded.
   { "type": "spacing", "target": target, "gridGap": "40px", "artSize": "180px" }

4. newRepresentation
   Use ONLY when the user asks for a substantially new layout/view/representation.
   { "type": "newRepresentation", "target": target, "prompt": "..." }

Rules:
- Prefer stylePatch for text requests such as rotate, tilt, align, make italic, space letters, underline, fade, enlarge.
- Keep CSS values simple and safe. Use px, em, numeric line-height, opacity 0-1, and transform rotate/scale/translate only.
- If the target is not text and the request is visual styling that cannot be represented by spacing or visibility, return newRepresentation.
- Reuse the provided target object exactly.`;
}

function buildOperationUserPrompt({ target, prompt, scope, presentationId, context }) {
  return JSON.stringify({
    target,
    request: prompt,
    scope,
    currentPresentation: presentationId,
    contentSummary: context?.contentSummary || null,
    currentTheme: context?.theme || null,
  }, null, 2);
}

async function parseCursorOperation({ apiKey, target, prompt, scope, presentationId, context }) {
  if (!apiKey) throw new Error('missing Cerebras API key');

  const body = {
    model: DEFAULT_MODEL,
    temperature: 0.15,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: buildOperationSystemPrompt() },
      { role: 'user', content: buildOperationUserPrompt({ target, prompt, scope, presentationId, context }) },
    ],
  };

  const res = await fetch(CEREBRAS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new Error(`Cerebras API error (${res.status}): ${msg}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras returned no operation');
  return extractJson(text);
}

module.exports = { parseCursorOperation };
