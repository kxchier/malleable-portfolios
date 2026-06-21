/** System prompt and schema for Cerebras template generation. */
const EXAMPLE_PRESENTATION = {
  id: 'museum_gallery',
  layout_family: 'horizontal_strip',
  metaphor: 'museum_gallery',
  visual_language: {
    abstract_to_skeuomorphic: 0.75,
    materials: ['gilded_frame', 'mat', 'gallery_wall'],
    density: 'medium',
  },
  encounter: {
    fast_discovery_to_deep_encounter: 0.55,
    navigation: 'horizontal_scroll',
    progressive_disclosure: false,
    hiddenness: 'low',
  },
  intent: {
    professional_legibility: 0.5,
    personal_archive: 0.35,
    social_encounter: 0.15,
  },
  components: ['portfolio_header', 'collection_section', 'museum_gallery'],
  ui_spec: {
    PORTFOLIO: {
      title: { function: 'publicIdentifier', render: 'shortText', editable: true },
    },
    COLLECTION: {
      title: { function: 'publicIdentifier', render: 'shortText', editable: true },
      works: {
        render: 'expanded',
        item: { type: '__WORK__', thumbnail: ['images'] },
      },
    },
    WORK: {
      images: { render: 'expanded', item: { render: 'image' } },
    },
  },
  layout_engine: {
    collection_container: 'vertical_stack',
    work_container: 'horizontal_scroll',
    work_tile: { aspect: 'natural', border: 'frame' },
  },
};

const EXAMPLE_CSS = `body.view-museum_gallery {
  background-color: var(--color-background);
  color: var(--color-primary);
}
.view-museum_gallery h2 {
  color: var(--color-primary);
  border-bottom: 1px solid var(--color-accent);
}
.museum-frame {
  padding: 0.5rem;
  background: linear-gradient(145deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, black));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
.museum-mat {
  background: var(--color-paper);
  padding: var(--space-imagePadding);
}
.images-scroll {
  overflow-x: auto;
  display: flex;
  gap: var(--space-gridGap);
}`;

const EXAMPLE_THEME_COLORS = {
  background: '#1a1816',
  primary: '#f8f6f3',
  accent: '#c5a059',
  paper: '#f8f6f3',
  panel: '#2c2520',
  secondary: '#2c2520',
};

const EXAMPLE_RENDER = `window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['museum_gallery'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;
    collections.forEach((col, ci) => {
      const section = helpers.collectionSection(col, ci);
      const strip = document.createElement('div');
      strip.className = 'museum-scroll images-scroll';
      strip.dataset.collectionIndex = String(ci);

      col.images.forEach((img, wi) => {
        const piece = document.createElement('article');
        piece.className = 'museum-piece';
        piece.dataset.collectionIndex = String(ci);
        piece.dataset.workIndex = String(wi);
        piece.dataset.canvasDraggable = 'true';

        const frame = document.createElement('div');
        frame.className = 'museum-frame';
        frame.setAttribute('aria-hidden', 'true');
        frame.innerHTML = assets['frame.svg'] || '';

        const mat = helpers.workTile(img, {
          className: 'museum-mat scroll-item',
          alt: 'artwork',
        });

        frame.appendChild(mat);
        piece.append(frame);
        strip.appendChild(piece);
      });

      section.appendChild(strip);
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

css (CRITICAL — editor swatches depend on this):
- NEVER invent custom color variable names like --color-wall, --color-gold, --color-matting. Use ONLY the standard theme variables:
  --color-background, --color-primary, --color-secondary, --color-accent, --color-paper, --color-panel
- body.view-{key} { background-color: var(--color-background); color: var(--color-primary); }
- Headings: var(--color-primary) or color-mix with var(--color-accent)
- Frames/mats: var(--color-paper), var(--color-accent)
- For darker/lighter variants use color-mix(in srgb, var(--color-accent) 70%, black) — NOT hardcoded hex for swatch colors
- Spacing: var(--space-gridGap), var(--space-artSize), var(--space-imagePadding)
- Scope under body.view-{key} and unique class prefixes
- Include .images-scroll { overflow-x: auto; display: flex; gap: var(--space-gridGap); } for scroll layouts
- Work tiles: object-fit: cover on img

presentation:
- Must include id (same as key), layout_family, metaphor, visual_language, encounter, intent, components, ui_spec, layout_engine.
- ui_spec must declare PORTFOLIO.title, COLLECTION.title, COLLECTION.works, WORK.images as editable where appropriate.

renderScript:
- MUST register: window.GeneratedLayouts = window.GeneratedLayouts || {};
- MUST set window.GeneratedLayouts['KEY'] = { mount(root, ctx) { ... } };
- ctx provides: collections (array with name, images, originalIndex), helpers, assets, presentation, theme.
- helpers.collectionSection(col, collectionIndex) — returns <section> with editable h2.
- helpers.workTile(imgPath, { className, alt }) — returns div with img for author artwork.
- helpers.portfolioTitle() — optional; headings are usually in the page shell.
- Loop every collection and every image in col.images — NEVER skip artwork slots.
- Mark draggable canvas elements with data-canvas-draggable="true" on work tiles when appropriate.
- Mark collection sections with class matching metaphor (e.g. museum-collection).
- Do NOT use fetch, eval, or external URLs. Inline SVG from ctx.assets only.

assets:
- Generate 0–4 inline SVG strings for decorative chrome (frames, clips, wall patterns, hooks).
- SVG should use currentColor or CSS variables where possible for theme integration.
- Keys are filenames like "frame.svg", "wall-pattern.svg".

Example themeColors (dark museum — adjust to match your prompt):
${JSON.stringify(EXAMPLE_THEME_COLORS, null, 2)}

Example css:
${EXAMPLE_CSS}

Example presentation:
${JSON.stringify(EXAMPLE_PRESENTATION, null, 2)}

Example renderScript (adapt key and classes to the user's metaphor):
${EXAMPLE_RENDER}

Be creative with metaphors, layout, positioning, and skeuomorphic decoration. Always render ALL author artwork from ctx.collections. themeColors MUST match the dark/light mood of your CSS.`;
}

function buildUserPrompt(userPrompt, context = {}) {
  const collections = context.collections || [];
  const collectionSummary = collections.map((c) => `"${c.name}" (${(c.images || []).length} works)`).join(', ');
  return `User prompt: ${userPrompt}

Portfolio has ${collections.length} collection(s): ${collectionSummary || 'none yet'}.
Theme colors: primary ${context.primary || '#1a1816'}, accent ${context.accent || '#8b7355'}, background ${context.background || '#f8f6f3'}.

Generate a unique interface matching the prompt. Include decorative SVG assets when the metaphor benefits from them (frames, lines, surfaces, etc.).`;
}

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
  EXAMPLE_PRESENTATION,
};
