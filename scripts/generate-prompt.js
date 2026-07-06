/** System prompt and schema for Cerebras template generation. */
const EXAMPLE_CSS = `body.view-KEY {
  background-color: var(--color-background);
  color: var(--color-primary);
}
.KEY-work {
  min-width: 0;
  padding: var(--space-imagePadding);
  background: var(--color-paper);
}
.KEY-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--space-artSize)), 1fr));
  gap: var(--space-gridGap);
}
.KEY-work img {
  width: 100%;
  height: auto;
  object-fit: contain;
}`;

const EXAMPLE_RENDER = `window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['KEY'] = {
  mount(root, ctx) {
    const { collections, helpers } = ctx;
    collections.forEach((col, ci) => {
      const section = helpers.collectionFrame(col, col.originalIndex ?? ci, { className: 'KEY-section' });
      const list = document.createElement('div');
      list.className = 'KEY-list';
      col.images.forEach((img, wi) => {
        list.appendChild(helpers.workTile(img, {
          className: 'KEY-work',
          alt: 'artwork',
          collectionIndex: col.originalIndex,
          workIndex: wi,
        }));
      });
      section.appendChild(list);
      root.appendChild(section);
    });
  },
};`;

function buildSystemPrompt() {
  return `You are a portfolio presentation generator for an art portfolio editor with two layers:

1. MODEL LAYER — Walo task-driven presentation JSON (entities: PORTFOLIO, COLLECTION, WORK).
2. CANVAS LAYER — the artist manipulates the live preview: drag tiles, edit colors via CSS variables, click text headings.

Generate a complete new portfolio interface from the user's prompt. Output ONLY valid JSON (no markdown fences) with this exact shape:

{
  "name": "1-2 word display name (e.g. Gallery, Museum, Scrapbook — NOT long phrases)",
  "key": "snake_case_id",
  "metaphor": "short_metaphor_id",
  "themeColors": {
    "background": "#hex",
    "primary": "#hex",
    "accent": "#hex",
    "paper": "#hex",
    "panel": "#hex",
    "secondary": "#hex"
  },
  "themeTypography": {
    "heading1": { "fontFamily": "font stack", "fontSize": "CSS size", "fontWeight": "400" },
    "heading2": { "fontFamily": "font stack", "fontSize": "CSS size", "fontWeight": "600" },
    "body": { "fontFamily": "font stack", "fontSize": "CSS size", "fontWeight": "400" }
  },
  "themeSpacing": {
    "gridGap": "CSS length",
    "artSize": "CSS length",
    "imagePadding": "CSS length"
  },
  "presentation": { ...full Walo presentation spec... },
  "css": "...complete CSS string...",
  "renderScript": "...complete JavaScript string...",
  "assets": { "filename.svg": "<svg>...</svg>", ... }
}

themeColors (REQUIRED):
- Include ONLY colors your CSS actually uses via var(--color-*).
- Always include: background, primary, accent, paper.
- Include panel ONLY if CSS uses var(--color-panel). Include secondary ONLY if CSS uses var(--color-secondary).
- Do NOT include unused swatch colors — the editor hides swatches that are not used.
- Choose a palette that belongs to the generated metaphor and encounter, even when it differs strongly from the current portfolio/editor colors.
- Treat the current portfolio colors as optional context, not a style constraint. Do not default to cream, beige, brown, or paper tones unless the user prompt, reference image, or metaphor specifically calls for them.

themeTypography / themeSpacing (OPTIONAL but encouraged):
- Use these when the generated interface should change the whole website shell, not just generated components.
- themeTypography controls the shared body, portfolio title, and collection-title variables.
- Choose typography with real personality that matches the metaphor. Avoid defaulting to Arial, Trebuchet MS, DM Sans, or system-ui unless the concept is intentionally plain/utilitarian.
- Use diverse local/system font stacks that are likely available. Examples:
  - bubbly/playful/aquatic: 'Cooper Black', 'Arial Rounded MT Bold', 'Comic Sans MS', 'Chalkboard SE', Trebuchet MS, sans-serif
  - handmade/zine/sketchbook: 'Comic Sans MS', 'Marker Felt', 'Chalkboard SE', 'Bradley Hand', cursive
  - typewriter/archive/research: 'American Typewriter', 'Courier New', Courier, monospace
  - elegant/gallery/literary: 'Cormorant Garamond', Georgia, 'Times New Roman', serif
  - futuristic/technical: 'DIN Alternate', 'Avenir Next Condensed', 'Arial Narrow', system-ui, sans-serif
- Use heading1 as the most expressive display font; heading2 should harmonize; body can stay more readable.
- Do NOT import fonts or use external URLs.
- themeSpacing controls shared spacing variables: gridGap, artSize, imagePadding. Use CSS lengths like "28px", "13rem", "0.8rem".

css (CRITICAL — editor swatches depend on this):
- NEVER invent custom color variable names like --color-wall, --color-gold, --color-matting. Use ONLY the standard theme variables:
  --color-background, --color-primary, --color-secondary, --color-accent, --color-paper, --color-panel
- body.view-{key} { background-color: var(--color-background); color: var(--color-primary); }
- For whole-page typography, rely on themeTypography and the shared variables:
  --font-heading1-family, --font-heading1, --font-heading1-weight,
  --font-heading2-family, --font-heading2, --font-heading2-weight,
  --font-body-family, --font-body, --font-body-weight.
- Headings: var(--color-primary) or color-mix with var(--color-accent)
- Frames/mats/surfaces: var(--color-paper), var(--color-accent), var(--color-panel), or var(--color-secondary) as appropriate to the metaphor. These variables do not have to mean literal beige paper; they can be steel, glass, signal lights, water, sky, concrete, fabric, etc.
- For darker/lighter variants use color-mix(in srgb, var(--color-accent) 70%, black) — NOT hardcoded hex for swatch colors
- Spacing and sizing controls: generated layouts should respond to the editor sliders by default.
  Use var(--space-gridGap) for gaps between works/sections and var(--space-artSize) for artwork tile or panel width/size.
  Use var(--space-imagePadding) for mats/inner image padding.
  Only use a fixed px/rem size for artwork panels when the user explicitly asks for a specific fixed-size object/metaphor.
- Scope under body.view-{key} and unique class prefixes
- Generated layouts may be full-bleed, but they must not depend on an unstated parent height. If a root uses absolute positioning, overflow hidden, panning, or height: 100%, also set a concrete min-height such as min-height: 100vh on the root/content surface.
- Do not create a large blank hero, title stage, or decorative spacer before the first collection. The first collection's heading and at least part of its artwork should appear within the first viewport on desktop and mobile.
- If you include a generated title/nameplate, keep it compact: no more than 1rem top padding above it and no more than 1rem margin before the first collection.
- Choose a collection display mode that fits the metaphor. Options include: responsive grid, quilt/patchwork grid, masonry board, vertical stacked story, freeform collage field, pinned wall, drawer/file reveal, carousel/horizontal strip, full-scene/world navigation, or nested rooms/shelves. A horizontal strip is one available choice, not the assumed structure.
- When choosing a horizontal strip, include .images-scroll { overflow-x: auto; display: flex; gap: var(--space-gridGap); }. For grids, patchworks, masonry boards, fields, rooms, and shelves, use CSS grid/flex/positioning that matches that display mode.
- Work tiles: show the full artwork. Use object-fit: contain on img, object-position: center, and avoid cropping unless the user explicitly asks for cropped thumbnails.

presentation:
- Must include id (same as key), layout_family, metaphor, visual_language, encounter, intent, components, ui_spec, layout_engine.
- ui_spec must declare PORTFOLIO.title, COLLECTION.title, COLLECTION.works, WORK.images as editable where appropriate.

renderScript:
- MUST register: window.GeneratedLayouts = window.GeneratedLayouts || {};
- MUST set window.GeneratedLayouts['KEY'] = { mount(root, ctx) { ... } };
- ctx provides: collections (array with name, images, originalIndex), helpers, assets, presentation, theme.
- helpers.collectionFrame(col, collectionIndex, { className, tagName }) — returns the visible outer collection section with editable h2 and collection edit metadata. Prefer this for generated collection sections, especially when the section has a visible card/frame/patch/shelf/drawer/panel surface. Left/right section spacing edits rely on the collection metadata being on this visible outer wrapper.
- helpers.collectionSection(col, collectionIndex) — legacy helper returning a basic <section> with editable h2. Use only when that exact section is also the visible outer collection wrapper.
- If you create a decorative outer wrapper around a helper-created collection section, put the collection metadata on the visible outer wrapper instead. Do not hide the editable collection target inside an inner shell, because cursor edits like padding, margins, borders, and backgrounds must affect the visible section.
- helpers.workTile(imgPath, { className, alt, collectionIndex, workIndex, fixedSize }) — returns div with img for author artwork. Always pass collectionIndex: col.originalIndex and workIndex: wi so clicked images can be edited directly. Leave fixedSize unset/false so the size slider controls it; use fixedSize: true only for explicitly fixed-size concepts.
- helpers.portfolioTitle() — optional; headings are usually in the page shell.
- Any generated portfolio/collection/work label text that should be editable must receive data-text-id, data-text-role, and data-text-fallback, or be created through the helper APIs.
- Loop every collection and every image in col.images — NEVER skip artwork slots.
- Mark draggable canvas elements with data-canvas-draggable="true" on work tiles when appropriate.
- Mark collection sections with class matching metaphor (e.g. museum-collection).
- Do NOT use fetch, eval, or external URLs. Inline SVG from ctx.assets only.

assets:
- Generate 0–6 inline SVG strings for decorative chrome and reference motifs (frames, clips, wall patterns, hooks, clouds, stars, creatures, icons, labels, waves, foliage, etc.).
- SVG should use currentColor or CSS variables where possible for theme integration.
- Keys are filenames like "frame.svg", "wall-pattern.svg", "cloud.svg", "creature.svg".

Minimal CSS pattern:
${EXAMPLE_CSS}

Minimal renderScript pattern:
${EXAMPLE_RENDER}

Be creative with metaphors, layout, positioning, color world, and skeuomorphic decoration, but prioritize getting the artwork on screen quickly. Always render ALL author artwork from ctx.collections. themeColors MUST match the metaphor, material world, and dark/light mood of your CSS, not merely copy the current portfolio palette.`;
}

function buildUserPrompt(userPrompt, context = {}) {
  const collections = context.collections || [];
  const collectionSummary = collections.map((c) => `"${c.name}" (${(c.images || []).length} works)`).join(', ');
  const existingLayouts = Array.isArray(context.existingLayouts) ? context.existingLayouts : [];
  const existingMetaphors = existingLayouts
    .map((layout) => layout.metaphor || layout.key || layout.name)
    .filter(Boolean);
  const existingMetaphorsBlock = existingMetaphors.length
    ? `
Already used portfolio interface metaphors:
${existingLayouts.map((layout) => {
  const metaphor = layout.metaphor || layout.key || layout.name;
  const description = String(layout.prompt || layout.examplePrompt || '').trim();
  return `- ${layout.name || layout.key}: ${metaphor}${description ? ` — ${description.slice(0, 120)}` : ''}`;
}).join('\n')}

Do NOT generate another interface with the same metaphor, place-world, object world, material system, or organizing conceit as any item above. Pick a genuinely new metaphor and set both top-level "metaphor" and presentation.metaphor to that new short_metaphor_id.`
    : '';
  const designSpace = context.designSpace || null;
  const designX = Number.isFinite(Number(designSpace?.x)) ? Number(designSpace.x) : 0;
  const designY = Number.isFinite(Number(designSpace?.y)) ? Number(designSpace.y) : 0;
  const xAxis = designSpace?.xAxis || { name: 'Visible to Friction', leftLabel: 'immediately visible', rightLabel: 'deliberate friction and slower encounter' };
  const yAxis = designSpace?.yAxis || { name: 'Abstract to Skeuomorphic', leftLabel: 'abstract/interface-native', rightLabel: 'tactile/skeuomorphic/object-like' };
  const customAxes = Array.isArray(designSpace?.customAxes) ? designSpace.customAxes : [];
  const axisTermForValue = (axis, value) => {
    const terms = Array.isArray(axis?.terms) ? axis.terms.filter((term) => term.label) : [];
    if (!terms.length) return null;
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    return terms.slice().sort((a, b) => Math.abs((Number(a.value) || 0) - v) - Math.abs((Number(b.value) || 0) - v))[0];
  };
  const termText = (axis, value) => {
    const term = axisTermForValue(axis, value);
    return term ? `${term.label}${term.description ? ` (${term.description})` : ''}` : '';
  };
  const customAxisBlock = customAxes.length
    ? `
User-defined concept axes:
${customAxes.map((axis) => {
  const value = Number.isFinite(Number(axis.value)) ? Number(axis.value) : 0.5;
  const endpointCue = (image, label) => {
    if (!image || typeof image !== 'object') return '';
    const summary = String(image.summary || '').trim();
    const keywords = Array.isArray(image.keywords) && image.keywords.length ? ` keywords ${image.keywords.join(', ')}` : '';
    const palette = Array.isArray(image.palette) && image.palette.length ? ` palette ${image.palette.join(', ')}` : '';
    return summary || palette || keywords ? `${label} endpoint image cue:${keywords}${summary ? ` ${summary}` : ''}${palette}` : '';
  };
  const endpointLabel = (side) => {
    const label = String(side === 'right' ? axis.rightLabel || '' : axis.leftLabel || '').trim();
    if (label) return label;
    const image = side === 'right' ? axis.rightImage : axis.leftImage;
    if (image && typeof image === 'object') return String(image.fileName || `${side} image reference`).slice(0, 80);
    return `${side} concept`;
  };
  const left = endpointLabel('left');
  const right = endpointLabel('right');
  const role = axis.mapRole ? `; marked as ${String(axis.mapRole).toUpperCase()} rectangle axis` : '';
  const nearby = Array.isArray(axis.scores)
    ? axis.scores
      .slice()
      .sort((a, b) => Math.abs(Number(a.value) - value) - Math.abs(Number(b.value) - value))
      .slice(0, 3)
      .map((score) => `${score.name || score.key} ${Number(score.value).toFixed(2)}${score.manual ? ' artist-corrected' : ''}`)
      .join(', ')
    : '';
  const ladder = Array.isArray(axis.terms) && axis.terms.length
    ? `; semantic ladder: ${axis.terms.map((term) => `${term.label} ${Number(term.value).toFixed(2)}`).join(' -> ')}`
    : '';
  const current = termText(axis, value);
  const endpoints = [endpointCue(axis.leftImage, left), endpointCue(axis.rightImage, right)].filter(Boolean).join('; ');
  return `- ${axis.name || `${left} to ${right}`}: ${value.toFixed(2)} (0 = ${left}, 1 = ${right})${role}${current ? `; current concept: ${current}` : ''}${ladder}${nearby ? `; nearby/corrected interfaces: ${nearby}` : ''}${endpoints ? `; ${endpoints}` : ''}`;
}).join('\n')}

Use these axes as artist-authored semantic interpolation controls. Artist-corrected note positions are stronger evidence than initial AI rankings. Endpoint image cues define the visual language at each end of an axis. If the selected value is between endpoint concepts or endpoint images, synthesize a coherent middle ground rather than choosing one endpoint literally.`
    : '';
  const designSpaceBlock = designSpace
    ? `
Design space selection:
- x ${xAxis.name || `${xAxis.leftLabel} to ${xAxis.rightLabel}`}: ${designX.toFixed(2)} (0 = ${xAxis.leftLabel}, 1 = ${xAxis.rightLabel})
- y ${yAxis.name || `${yAxis.leftLabel} to ${yAxis.rightLabel}`}: ${designY.toFixed(2)} (0 = ${yAxis.leftLabel}, 1 = ${yAxis.rightLabel})
- Interpreted concept words: ${termText(xAxis, designX) || 'between x-axis concepts'} + ${termText(yAxis, designY) || 'between y-axis concepts'}
${customAxisBlock}

Use this coordinate as a research/prototyping constraint. It should shape the presentation model, encounter model, layout engine, and material language. This is not a decorative slider value. Prefer the interpreted concept words over exposing numbers in the generated idea.`
    : '';
  const highFidelityReferenceBlock = /REFERENCE_FIDELITY:\s*high/i.test(String(userPrompt || ''))
    ? `
High-fidelity image reference constraint:
- The uploaded image is the primary art direction, not a loose mood board.
- A reference image asset is available to generated CSS/renderScript as ${context.referenceImageAssetName ? `url("assets/${context.referenceImageAssetName}")` : 'a generated reference image asset when provided'}. Use it as a translucent underlay, texture, traced backdrop, or collage layer unless the user explicitly says not to.
- Preserve the reference's visible visual language: palette, line quality, texture, material system, softness, composition density, component metaphors, and interaction mood.
- Treat "Layout contract", "Required motifs", "Required materials", "Must preserve", "Material system", and "Motif vocabulary" lines as implementation requirements. They should show up in CSS class names, DOM structures, SVG assets, background layers, or visible generated chrome.
- Do not satisfy the image by choosing a generic adjacent metaphor like diary, scrapbook, notebook, zine, gallery, or card grid unless the prompt explicitly asks for that exact object. Build a new interface surface from the reference's actual mechanics instead.
- The first viewport must visibly resemble the reference before any interaction: use a reference-derived palette, layered background treatment, and multiple motifs or marks from the token vocabulary.
- Convert named visual motifs from the extracted tokens into concrete interface elements. If tokens mention things like swirling clouds, stars, creatures, windows, posters, vines, waves, stickers, etc., they must appear as visible CSS/SVG/DOM details, not just influence colors or wording.
- Include at least five reference-derived visual motifs or material details in the generated CSS/renderScript/assets, and make at least one motif animated when the tokens mention motion or atmosphere.
- Create simple inline SVG assets or generated DOM decorations when needed; do not avoid motifs just because no external image asset exists.
- Do not let clarification answers replace the image with an unrelated world. If the prompt mentions another object or place, translate it through the reference image's style and structure.
- Use the reference palette for themeColors; do not drift to plain cream/black handwriting unless those are dominant in the reference.
- The generated website should be recognizable as descended from the reference image at first glance.`
    : '';
  return `User prompt: ${userPrompt}

Portfolio has ${collections.length} collection(s): ${collectionSummary || 'none yet'}.
Current portfolio colors for optional continuity only: primary ${context.primary || '#1a1816'}, accent ${context.accent || '#8b7355'}, background ${context.background || '#f8f6f3'}. Do not copy this palette unless the user asks for continuity or it genuinely fits the generated metaphor.
${existingMetaphorsBlock}
${designSpaceBlock}
${highFidelityReferenceBlock}

Generate a unique interface matching the prompt. Include decorative SVG assets when the metaphor benefits from them (frames, lines, surfaces, atmospheric motifs, icons, creatures, etc.); for REFERENCE_FIDELITY: high prompts, include visible reference-derived motifs as required interface material.`;
}

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
};
