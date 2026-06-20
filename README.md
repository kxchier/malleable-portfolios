# GitHub Pages Art Portfolio Template

HI GUYZ~! :D

This is a mockup of a malleable, editable art portfolio template site, designed for GitHub Pages. It includes a **Portfolio Editor** (run locally) for direct manipulation and (eventually) AI-powered generation of portfolio presentations. Art lives in the `Art/` folder; the site renders it through multiple **presentation formats** (Grid, Clothesline, Desk) from a single shared **content model**.

Built as a prototype for [Walo] — separating *what the work is* from *how it is encountered* — using a task-driven data model inspired by [Jelly](https://doi.org/10.1145/3706598.3713285).

## Quick Start

### Run the editor locally

1. Clone this repo:
   ```bash
   git clone <repo-url>
   cd malleable-portfolios
   ```

2. Add your artwork to `Art/`, organized by collection. Nested folders that contain images each become a collection (example art may be included; in practice this folder might be gitignored):
   ```
   Art/VTubers/Kyle.jpg
   Art/Comics/Fall Chilly/00.jpg     →  collection "Comics / Fall Chilly"
   ```

3. Build the content model (optional if using the local server — Save rebuilds automatically):
   ```bash
   node scripts/build-content.js
   ```

4. Start the app by double-clicking `PortfolioEditor` or running:
   ```bash
   node scripts/serve.js
   ```
   Restart the server after pulling updates so new API routes (e.g. `/api/content-model`) are available.

5. Visit in your browser (`PortfolioEditor` should open one automatically):
   - **Edit mode**: http://localhost:8080/edit.html
   - **Grid view**: http://localhost:8080/ver1.html
   - **Clothesline view**: http://localhost:8080/ver2.html
   - **Desk view**: http://localhost:8080/ver3.html

   With the local server running, views read `Art/` live via `/api/content-model` — newly added art shows up on refresh. Hit **Save** in the editor to write static files for deploy.

> **Static-only fallback:** You can open the site with any static server (e.g. `python3 -m http.server`), but then it reads committed `models/content.json` / `manifest.json` instead of scanning live, and Save won't have a backend. Run `node scripts/build-content.js` manually to refresh those files.

### Verify it's working

```bash
node scripts/build-content.js          # should print collections + work count
curl -s http://localhost:8080/api/content-model | head -c 200   # JSON with portfolio, collections, works
```

In the browser: all three layout URLs should show the same art, laid out differently (grid vs horizontal strips vs scattered desk). Open the console on a view page — no errors from `PortfolioModels` or `PortfolioRender`.

## Data model (Walo)

The site is driven by three layers:

| Layer | Location | What it describes |
|-------|----------|-------------------|
| **Schema** | `models/schema.json` | Entity types (Portfolio, Artist, Collection, Work) and relationships |
| **Content** | `models/content.json` | Your actual art — built from `Art/` (one image = one work in v1) |
| **Presentation** | `presentations/*.json` | How work is encountered — layout, metaphor, navigation, UI spec |

Shared styling and text overrides still live in `theme.json` and `content.json`.

```
Art/  →  build-content.js  →  models/content.json
                                    ↓
presentations/grid.json  ──→  scripts/render.js  →  ver1.html (thin shell)
presentations/clothesline.json                    →  ver2.html
presentations/desk.json                           →  ver3.html
theme.json ────────────────────────────────────────┘
```

`manifest.json` is kept as a **legacy shim** (`{ collections: [{ name, images }] }`) for static hosting compatibility. New code should prefer `models/content.json`.

### Theme customization

Edit `theme.json` to control:
- **Colors**: primary, secondary, accent, background, paper
- **Typography**: heading1, heading2, body (global + per-layout under `versions`)
- **Spacing**: gridGap, imagePadding

Changes are visible in all views when using the editor or after saving.

### Built-in layouts

Each layout is a thin HTML shell plus a presentation spec. All three read the same content model.

| Layout | File | Presentation spec | Metaphor |
|--------|------|-------------------|----------|
| **Grid** | `ver1.html` | `presentations/grid.json` | Gallery wall — high discoverability |
| **Clothesline** | `ver2.html` | `presentations/clothesline.json` | Prints on a sagging line with clothespins |
| **Desk** | `ver3.html` | `presentations/desk.json` | Scattered surface, draggable tiles |

Example AI prompts for each layout live in `scripts/layouts.js` and appear as chips in the editor's **+ Create New** modal.

### Adding a new representation

1. Add `presentations/my-layout.json` — layout family, encounter settings, `ui_spec`, and `layout_engine` (see existing specs for structure).
2. Create a thin HTML shell (e.g. `ver4.html`) that loads `loader.js`, `model-loader.js`, `component-registry.js`, `render.js`, and calls:
   ```js
   PortfolioRender.mount({ root: document.getElementById('content'), presentationId: 'my-layout' });
   ```
3. Register the layout in `scripts/layouts.js` and add a button in `edit.html`.

Renderer logic lives in `scripts/render.js`; component types are listed in `scripts/component-registry.js`.

### Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to "GitHub Actions"
4. Push any commit to `main` — the workflow auto-deploys

`.github/workflows/deploy.yml` runs `node scripts/build-content.js`, which writes `models/content.json` and `manifest.json`, then deploys the site.

Visit `https://yourusername.github.io/repo-name/ver1.html` to see your portfolio.

## Edit mode features

In `/edit.html`, you can:

- **Switch representations**: Toggle between Grid, Clothesline, and Desk previews
- **Edit properties**: Change title, colors, spacing in real time
- **Live preview**: See changes instantly in the preview pane
- **Save changes**: Writes `theme.json`, `content.json`, and rebuilds `models/content.json` + `manifest.json` from `Art/` (requires `node scripts/serve.js`)
- **Preview static**: Open the current layout in a new tab

### Direct text editing

In the edit preview, **click any heading** (portfolio title or section title) to open a floating toolbar:

- **Text** — change the wording (saved to `content.json`)
- **Font / Size** — **Apply to** lets you target this heading only, all section titles, or all headings on the current layout. Per-layout typography lives in `theme.json` under `versions`.

### Palette swatches

Above the preview, click a palette swatch to open a color pad:

- **↔ horizontal** — shift hue
- **↕ vertical** — lighter (up) or darker (down)

Swatches: Background, Primary, Hover, Desk (surface), and Border (artwork mat). The **Gap** slider adjusts image spacing.

### Inspect model

Click **Inspect model** in the editor toolbar to open a side panel showing the data behind the preview:

| Tab | What you see |
|-----|----------------|
| **Content** | Live content model with text overrides applied |
| **Presentation** | Current layout spec (`presentations/*.json`) |
| **Schema** | Entity types (`models/schema.json`) |
| **Theme** | Edited colors, typography, spacing |

Use **Copy JSON** to export any tab. Updates when you switch layouts, edit, or save.

### Coming soon

- AI-generated presentation specs from the **+ Create New** modal
- Click-to-edit art tiles (captions, scope: this piece / collection / all)

## Key files

| Path | Role |
|------|------|
| `Art/` | Source images (folder structure → collections) |
| `models/schema.json` | Walo entity schema |
| `models/content.json` | Structured art data (generated) |
| `presentations/*.json` | Per-layout presentation models |
| `theme.json` | Colors, typography, spacing |
| `content.json` | Text overrides for headings |
| `manifest.json` | Legacy collection list (generated shim) |
| `scripts/build-content.js` | Scan `Art/` → content model + manifest |
| `scripts/render.js` | Model-driven layout renderer |
| `scripts/inspect-model.js` | Edit-mode model inspector panel |
| `scripts/model-loader.js` | Load schema, content, presentation, theme |
| `scripts/serve.js` | Local editor server + APIs |

### Local server APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/content-model` | GET | Live content model from `Art/` |
| `/api/manifest` | GET | Legacy manifest view |
| `/api/rebuild` | POST | Rebuild content model + manifest on disk |
| `/api/theme` | POST | Save `theme.json` (+ optional `content.json`) |
| `/api/content` | POST | Save `content.json` |

## Packaging as a double-click app

Instead of `node scripts/serve.js` in a terminal, the editor can ship as a **self-contained double-click app** with no Node install — ideal for study participants. The binary bundles the Node runtime + server, sits in the portfolio folder, and on launch serves that folder and opens the editor (same filesystem access to scan `Art/` and write `models/content.json`, `manifest.json`, `theme.json`).

### Build it

macOS (Node SEA, Node 20+):

```bash
bash scripts/pack.sh          # produces ./PortfolioEditor (gitignored, ~105 MB)
./PortfolioEditor             # or double-click in Finder
```

Under the hood `pack.sh` bundles `serve.js` + `build-content.js` via `esbuild` → Node SEA blob → `postject` → ad-hoc code-sign.

> The binary must sit **in the portfolio folder** (next to `Art/`, `edit.html`, etc.).

### Caveats

- **Per-OS builds**: build separately for macOS, Windows, Linux
- **macOS terminal flash**: wrap in a minimal `.app` bundle for a cleaner launch
- **Code signing**: ad-hoc signed by default; notarize for wider distribution
- **Publish to GitHub** in the editor UI is still mocked

## Next steps

- [ ] Package as a double-click app (Node SEA) — see above
- [ ] Add image upload/reordering in edit mode
- [ ] Implement AI presentation generator (`presentations/*.json` from prompts)
- [ ] Richer content model (medium, tags, visibility, multi-image works)
- [ ] Persist desk tile positions in the content model
- [ ] Desktop Archive layout (`ver4`)
- [x] Task-driven data model (content + presentation specs)
- [x] Shared renderer for Grid / Clothesline / Desk
- [x] Inspect model panel in edit mode
- [x] Desk view + example prompts in `scripts/layouts.js`
- [ ] Add dark mode toggle
- [ ] Mobile-optimized edit interface

---

Built as a prototype for malleable, generative art presentation. Extend it however you like!
