/** Parse page-level sparkle requests into safe portfolio edit operations. */
const { callTextModel, providerLabel } = require('./ai-client.js');

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

function buildPortfolioOperationSystemPrompt() {
  return `You convert broad art-portfolio editing requests into small JSON operations.

Output ONLY valid JSON:
{
  "message": "brief user-facing proposal",
  "operations": [ ... ]
}

The user is editing the whole current portfolio interface, not one clicked element. Words like "this website", "the page", "everything", "background", and "scrolling" refer to the current presentation only.

Allowed operation types:
1. colorPatch
   Use for palette/theme changes in the current presentation.
   { "type": "colorPatch", "colors": { "background": "#ffffff", "primary": "#111111", "secondary": "#eeeeee", "accent": "#ff6699", "paper": "#ffffff", "panel": "#f6f6f6" } }

2. typographyPatch
   Use for broad title/body typography changes.
   { "type": "typographyPatch", "typography": {
     "heading1": { "fontFamily": "Georgia, serif", "fontSize": "3rem", "fontWeight": "700" },
     "heading2": { "fontFamily": "DM Sans, system-ui, sans-serif", "fontSize": "1.1rem", "fontWeight": "600" },
     "body": { "fontFamily": "DM Sans, system-ui, sans-serif", "fontSize": "1rem", "fontWeight": "400" }
   } }

3. spacing
   Use only for the editor's global density sliders. gridGap changes the gap between artworks/items; artSize changes artwork size; imagePadding changes mats/padding inside artwork tiles.
   { "type": "spacing", "gridGap": "32px", "artSize": "220px", "imagePadding": "12px" }

4. layoutOverride
   Use for changing how works scroll or arrange inside the current presentation.
   { "type": "layoutOverride", "collectionDisplay": "grid" | "horizontal" | "vertical", "materialTexture": "textured" | "wood" | "paper" | "fabric" | "metal" | "glass" }

5. elementStylePatch
   Use for broad safe CSS style changes to all artworks/work tiles or all collection sections.
   { "type": "elementStylePatch", "scope": "all-images" | "all-sections", "patch": { "borderRadius": "24px", "boxShadow": "0 10px 30px rgba(0,0,0,0.2)", "overflow": "hidden", "marginLeft": "48px", "marginRight": "48px" }, "imagePatch": { "filter": "saturate(1.3)", "objectFit": "cover" } }

6. decorativeAssets
   Use when the user asks to add visible background/interface art, motifs, doodles, stickers, icons, ornaments, or decorative objects.
   { "type": "decorativeAssets", "prompt": "add colorful hand-drawn flowers, stars, and ribbon doodles around the background" }

7. noop
   Use only when nothing can be represented safely.
   { "type": "noop", "message": "..." }

Rules:
- Return multiple operations when the request asks for a mood, style, or website-wide change.
- Prefer colorPatch for "more colorful", "brighter", "darker", "pastel", "neon", "warmer", "cooler".
- For requests that are only about colors, palette, mood, style, aesthetic, vibe, or art-direction words like "Wes Anderson" or "vintage colors", return colorPatch and optionally typographyPatch. Do NOT return decorativeAssets unless the user explicitly asks for visible objects, motifs, drawings, stickers, icons, ornaments, doodles, or background art.
- Prefer decorativeAssets for background art/motifs. Do not invent SVG yourself here; summarize what the asset generator should draw.
- Prefer layoutOverride for scrolling/layout requests. Horizontal means side-scrolling/carousel/row. Vertical means stacked/list. Grid means tile/masonry/quilt-like overview.
- Prefer spacing for "larger art", "smaller thumbnails", or explicitly changing the gap/space between images/items/works.
- Do NOT use spacing.gridGap for collection/section side margins, outside spacing, or breathing room around collection containers; gridGap is the top interface gap slider between images/items.
- For requests about collection/section side margins, outside spacing, or breathing room around each collection container, return elementStylePatch with scope "all-sections" and marginLeft/marginRight. This changes the visible section's outside spacing.
- For requests about moving collection contents inward inside the same section surface, return elementStylePatch with scope "all-sections" and paddingLeft/paddingRight.
- Use marginTop/marginBottom for vertical spacing between section containers. Do not describe the change only in the message.
- For requests about spacing between images/items, use spacing gridGap or elementStylePatch gap/rowGap/columnGap with scope "all-images" only when that is explicitly about works/items.
- Use only hex colors in colorPatch.
- Keep CSS values simple and safe. Use px/rem/em sizes, font weights normal/bold/100-900, and supported style values.
- Do not return arbitrary HTML, CSS selectors, JavaScript, files, or template generation requests.
- Scope every change to the current presentation.`;
}

function buildPortfolioOperationRepairPrompt() {
  return `${buildPortfolioOperationSystemPrompt()}

The previous response may have mapped a section/container request to the global spacing sliders. Repair the operation if needed:
- If the request is about collection/section side margins, outside spacing, or breathing room around collection containers, return elementStylePatch with scope "all-sections" using marginLeft/marginRight.
- If the request is about moving collection contents inward, use paddingLeft/paddingRight.
- Use spacing.gridGap only when the request is explicitly about the gap/space between images/items/works.
- Return only JSON in the same shape.`;
}

function buildPortfolioOperationUserPrompt({ prompt, layout, presentation, context }) {
  return JSON.stringify({
    artistRequest: prompt,
    currentLayout: {
      key: layout?.key,
      name: layout?.name,
      metaphor: layout?.metaphor,
      prompt: layout?.prompt,
    },
    presentation: {
      visual_language: presentation?.visual_language,
      metaphor: presentation?.metaphor,
      encounter: presentation?.encounter,
      intent: presentation?.intent,
      components: presentation?.components,
      layout_engine: presentation?.layout_engine,
    },
    currentTheme: context?.theme || null,
    currentSpacing: context?.spacing || null,
    contentSummary: context?.contentSummary || null,
  }, null, 2);
}

async function parsePortfolioOperation({ apiKey, provider = 'anthropic', prompt, layout, presentation, context }) {
  if (!prompt?.trim()) throw new Error('Tell the sparkle what to change.');
  const user = buildPortfolioOperationUserPrompt({ prompt: prompt.trim(), layout, presentation, context });

  const result = await callTextModel({
    provider,
    apiKey,
    system: buildPortfolioOperationSystemPrompt(),
    user,
    maxTokens: 2400,
    temperature: 0.25,
  });

  if (!result.text) throw new Error(`${providerLabel(provider)} returned no portfolio operation`);
  const parsed = extractJson(result.text);
  if (!portfolioOperationNeedsRepair(prompt, parsed)) {
    return normalizePortfolioOperationForRequest(prompt, parsed);
  }

  const repair = await callTextModel({
    provider,
    apiKey,
    system: buildPortfolioOperationRepairPrompt(),
    user: JSON.stringify({
      artistRequest: prompt.trim(),
      previousResponse: parsed,
      currentLayout: {
        key: layout?.key,
        name: layout?.name,
        metaphor: layout?.metaphor,
      },
      currentSpacing: context?.spacing || null,
      contentSummary: context?.contentSummary || null,
    }, null, 2),
    maxTokens: 2400,
    temperature: 0.1,
  });

  if (!repair.text) return parsed;
  const repaired = extractJson(repair.text);
  return normalizePortfolioOperationForRequest(
    prompt,
    repaired?.operations || repaired?.operation ? repaired : parsed
  );
}

function requestAsksForPalette(prompt) {
  return /\b(color|colors|colour|colours|palette|pastel|vintage|retro|warm|cool|brighter|darker|muted|saturated|wes\s+anderson|anderson|budapest)\b/i
    .test(String(prompt || ''));
}

function requestExplicitlyAsksForAssets(prompt) {
  return /\b(add|draw|create|place|put|sprinkle|scatter)\b.*\b(asset|assets|decoration|decorations|motif|motifs|doodle|doodles|sticker|stickers|icon|icons|ornament|ornaments|object|objects|background art|illustration|illustrations)\b/i
    .test(String(prompt || ''));
}

function wesAndersonVintageColorPatch() {
  return {
    type: 'colorPatch',
    colors: {
      background: '#f0e6d2',
      primary: '#2f251f',
      accent: '#b45f4d',
      paper: '#f4c6d0',
      panel: '#d4af37',
      secondary: '#8fa78f',
    },
  };
}

function normalizePortfolioOperationForRequest(prompt, parsed) {
  const operations = Array.isArray(parsed?.operations)
    ? parsed.operations.slice()
    : parsed?.operation ? [parsed.operation] : [];
  if (!operations.length) return parsed;

  const asksForPalette = requestAsksForPalette(prompt);
  const asksForAssets = requestExplicitlyAsksForAssets(prompt);
  if (!asksForPalette || asksForAssets) return parsed;

  const nonAssetOperations = operations.filter((operation) => operation?.type !== 'decorativeAssets');
  const hasColorPatch = nonAssetOperations.some((operation) => operation?.type === 'colorPatch');
  const nextOperations = hasColorPatch
    ? nonAssetOperations
    : [wesAndersonVintageColorPatch(), ...nonAssetOperations];

  return {
    ...parsed,
    message: parsed?.message || 'Applied a vintage cinematic color palette.',
    operations: nextOperations,
  };
}

function portfolioOperationNeedsRepair(prompt, parsed) {
  const text = String(prompt || '').toLowerCase();
  const asksForCollectionContainer = /\b(collection|collections|section|sections|container|containers|panel|panels|frame|frames|quilt|patch)\b/.test(text);
  const asksForOutsideSpacing = /\b(outside|outer|margin|margins|side|sides|left|right|horizontal|breathing room|inward|edge|edges)\b/.test(text);
  const explicitlyBetweenItems = /\bbetween (the )?(images|items|works|artworks)|image gap|item gap|work gap|grid gap\b/.test(text);
  if (!asksForCollectionContainer || !asksForOutsideSpacing || explicitlyBetweenItems) return false;

  const operations = Array.isArray(parsed?.operations)
    ? parsed.operations
    : parsed?.operation ? [parsed.operation] : [];
  return operations.some((operation) => (
    operation?.type === 'spacing' && (operation.gridGap || operation.gap)
  ));
}

module.exports = { parsePortfolioOperation };
