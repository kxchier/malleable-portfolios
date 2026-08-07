/** Source-aware structural revisions for generated portfolio bundles. */
const { callTextModel, providerLabel } = require('./ai-client.js');

function extractJson(value) {
  const raw = String(value || '').trim();
  try { return JSON.parse(raw); } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Could not parse a bundle revision from the model.');
  }
}

async function reviseGeneratedBundle({ prompt, layoutKey, bundle, contentSummary }) {
  if (!layoutKey || !bundle?.css || !bundle?.renderScript) throw new Error('A generated layout bundle is required.');
  const system = `Revise an existing generated art-portfolio bundle to satisfy a structural editing request. Preserve its distinctive metaphor and visual character. Return ONLY JSON:
{"message":"brief summary","css":"complete revised CSS","renderScript":"complete revised JavaScript"}

The render script must continue to register window.GeneratedLayouts['${layoutKey}'] with mount(root, ctx), use the provided helpers, render every collection and artwork exactly once, and preserve collectionIndex/workIndex metadata. You may change pagination, grouping, page capacity, and layout structure. CSS must remain scoped under body.view-${layoutKey} and use the existing --color-*, --font-*, and --space-* variables. Do not use fetch, XMLHttpRequest, WebSocket, eval, Function, dynamic import, external URLs, cookies, storage, parent, top, opener, or navigation APIs. Do not add script tags or CSS @import/url().`;
  const result = await callTextModel({
    provider: 'anthropic',
    system,
    user: JSON.stringify({
      request: String(prompt || '').slice(0, 1600), layoutKey,
      presentation: bundle.presentation || null,
      editableSettings: bundle.editableSettings || null,
      css: String(bundle.css).slice(0, 30000),
      renderScript: String(bundle.renderScript).slice(0, 24000),
      contentSummary: contentSummary || null,
    }),
    maxTokens: 20000,
    temperature: 0.15,
  });
  if (!result.text) throw new Error(`${providerLabel('anthropic')} returned no bundle revision.`);
  return extractJson(result.text);
}

module.exports = { reviseGeneratedBundle };
