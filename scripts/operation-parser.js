/** Parse cursor-assistant requests into validated local edit operations. */
const { callTextModel, normalizeProvider, providerLabel } = require('./ai-client.js');

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
     "scope": "this" | "role" | "all-headings",
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

2. elementStylePatch
   Use for local visual style edits to the selected non-text object, especially clicked artworks/images/work tiles and collection sections.
   This is NOT arbitrary HTML/CSS rewriting. Return only safe style properties for the clicked target.
   Shape:
   {
     "type": "elementStylePatch",
     "target": target,
     "scope": "this" | "all-images" | "all-sections",
     "patch": {
       "borderRadius": "9999px",
       "overflow": "hidden",
       "aspectRatio": "1/1",
       "border": "2px solid var(--color-accent)",
       "boxShadow": "0 8px 24px rgba(0,0,0,0.2)",
       "filter": "grayscale(100%)",
       "gap": "24px",
       "margin": "24px 0",
       "marginTop": "24px",
       "marginBottom": "24px",
       "marginLeft": "24px",
       "marginRight": "24px",
       "opacity": "0.8",
       "padding": "24px",
       "paddingTop": "24px",
       "paddingBottom": "24px",
       "paddingLeft": "24px",
       "paddingRight": "24px",
       "rowGap": "24px",
       "columnGap": "24px",
       "transform": "rotate(-4deg)"
     },
     "imagePatch": {
       "borderRadius": "9999px",
       "objectFit": "cover",
       "objectPosition": "center"
     }
   }

3. collectionVisibility
   Use when the user wants a collection hidden/shown in the current presentation.
   { "type": "collectionVisibility", "target": target, "visible": false }

4. spacing
   Use for making the current presentation less/more crowded.
   { "type": "spacing", "target": target, "gridGap": "40px", "artSize": "180px", "margin": "24px", "padding": "24px", "gap": "24px" }

5. noop
   Use when the request cannot be safely represented as a local edit to the clicked target/current presentation.
   { "type": "noop", "target": target }

Rules:
- Prefer stylePatch for text requests such as rotate, tilt, align, make italic, space letters, underline, fade, enlarge.
- For font change requests, prefer these always-loaded web fonts, matched to the requested mood:
  serif/elegant: 'Playfair Display', 'Fraunces', 'DM Serif Display', 'Cinzel', 'Zilla Slab', 'Cormorant Garamond';
  sans/modern: 'Space Grotesk', 'Outfit', 'Archivo', 'Oswald', 'DM Sans';
  playful/bold: 'Fredoka', 'Baloo 2', 'Bungee', 'Chewy', 'Pacifico';
  handwritten: 'Caveat', 'Shadows Into Light', 'Gochi Hand';
  mono/typewriter: 'Special Elite', 'Courier Prime', 'Space Mono', 'VT323'.
- For text alignment requests such as "center this text" or "align this in the middle", return stylePatch with textAlign "center". The renderer will position block headings consistently across edit and preview surfaces.
- For relative text size requests, return a concrete fontSize value. If target.currentStyle.fontSize is present, use it as the starting point: "a little bigger" means about +2px, "bigger/larger" means about +4px, "a little smaller" means about -2px, and "smaller" means about -4px. Keep the final fontSize between 10px and 96px.
- Prefer elementStylePatch for clicked image/work/object requests such as make this image a circle, round this, make this black and white, add a border, fade this, tilt this, make this artwork cropped/contained.
- Scope is about similar objects in the current interface, not different templates/views.
- For selected text: use "this" for only the clicked text, "role" for all section titles when the target role is collection.title, and "all-headings" for all portfolio/section headings.
- For selected images/work tiles: use "this" for only the clicked image and "all-images" for all images in the current interface.
- For selected collection sections: use "this" for only the clicked section and "all-sections" for all collection/section containers in the current interface.
- If the clicked target is a work/image but the request clearly refers to its containing section/collection/panel/frame, use target.parentCollection as the operation target when it is provided.
- Spacing edits are safe when represented by CSS spacing properties only: margin, marginTop, marginRight, marginBottom, marginLeft, padding, paddingTop, paddingRight, paddingBottom, paddingLeft, gap, rowGap, and columnGap.
- For adding horizontal space outside a selected section, use marginLeft and marginRight on the collection section. This moves the visible section away from the page edges. Do not use gap/rowGap/columnGap unless the user specifically asks for more spacing between images/items.
- For moving content inward inside a selected section, use paddingLeft and paddingRight. For vertical spacing before/after a selected section, use marginTop and marginBottom. Use scope "all-sections" when the user picked all sections.
- Map semantic visual language to actual CSS properties from the allowed list. Examples: "more breathing room around sections" -> marginLeft/marginRight or marginTop/marginBottom; "move contents inward" -> paddingLeft/paddingRight; "space between images" -> gap/rowGap/columnGap; "rounder/softer" -> borderRadius; "more framed" -> border/boxShadow/padding; "tilt" -> transform rotate(...).
- When a safe local interpretation exists, choose concrete CSS values and return the corresponding patch. Use noop only when the request truly cannot be represented by the allowed operation types and allowed CSS properties.
- Return actual CSS property names exactly. Do not invent semantic aliases such as outerSpacing, innerSpacing, horizontalSpacing, sectionSpacing, or betweenSpacing.
- For "make this image a circle", use patch borderRadius 9999px, overflow hidden, aspectRatio 1/1 and imagePatch borderRadius 9999px, objectFit cover, objectPosition center.
- Keep CSS values simple and safe. Use px/rem/em/% spacing values, numeric line-height, opacity 0-1, and transform rotate/scale/translate only.
- If the target is not text and the request is visual styling of the clicked object, return elementStylePatch, not newRepresentation.
- Never create or request a new layout/template from cursor-assistant edits.
- If the request requires adding/removing/rearranging interface structure beyond the clicked object, return noop with a message that it cannot be safely applied as a local edit.
- Reuse the provided target object exactly, except you may use target.parentCollection when the user's wording refers to the containing collection/section rather than the clicked work/image.`;
}

function buildOperationRepairPrompt() {
  return `${buildOperationSystemPrompt()}

The previous attempt returned noop. Before returning noop, try once more to translate the user's semantic visual request into the closest safe CSS patch from the allowed properties.

Do not invent aliases. Do not write arbitrary CSS. Return elementStylePatch or stylePatch when a safe mapping exists. Return noop only if no allowed property can express the request.`;
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

async function parseCursorOperation({ apiKey, provider, target, prompt, scope, presentationId, context }) {
  const normalizedProvider = normalizeProvider(provider);

  const user = buildOperationUserPrompt({ target, prompt, scope, presentationId, context });
  const result = await callTextModel({
    provider: normalizedProvider,
    apiKey,
    system: buildOperationSystemPrompt(),
    user,
    maxTokens: 1200,
    temperature: 0.15,
  });

  const text = result.text;
  if (!text) throw new Error(`${providerLabel(normalizedProvider)} returned no operation`);
  const parsed = extractJson(text);
  if (parsed?.operation?.type !== 'noop') return parsed;

  const repair = await callTextModel({
    provider: normalizedProvider,
    apiKey,
    system: buildOperationRepairPrompt(),
    user: JSON.stringify({
      target,
      request: prompt,
      scope,
      currentPresentation: presentationId,
      previousOperation: parsed.operation,
      previousMessage: parsed.message,
      contentSummary: context?.contentSummary || null,
      currentTheme: context?.theme || null,
    }, null, 2),
    maxTokens: 1200,
    temperature: 0.05,
  });

  const repairText = repair.text;
  if (!repairText) return parsed;
  const repaired = extractJson(repairText);
  return repaired?.operation ? repaired : parsed;
}

module.exports = { parseCursorOperation };
