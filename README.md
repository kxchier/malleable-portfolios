# GitHub Pages Art Portfolio Template

HI GUYZ~! :D

This is a mockup of a malleable, editable art portfolio template site, designed for GitHub Pages. It includes a **Portfolio Editor** (run locally) for direct manipulation, AI-generated presentation templates, and a cursor-local AI editing assistant. Art lives in the `Art/` folder; the site renders it through multiple **presentation formats** (Grid, Clothesline, Desk, Directory, plus generated templates) from a single shared **content model**.

Built as a prototype for [Walo] — separating *what the work is* from *how it is encountered* — using a task-driven data model inspired by [Jelly](https://doi.org/10.1145/3706598.3713285).

## Quick Start

### Run the editor locally

1. Clone this repo:
   ```bash
   git clone <repo-url>
   cd malleable-portfolios
   ```

2. Put shared study images in `Art/example/` and each participant's images in
   `Art/participants/<id>/`, organized by collection. Nested folders that contain images
   become collections:
   ```
   Art/example/Louis Wain/a-good-read.jpeg
   Art/participants/01/VTubers/Kyle.jpg
   Art/participants/01/Comics/Fall Chilly/00.jpg
                                      →  collection "Comics / Fall Chilly"
   ```
   To add optional metadata for an image, place a same-name `.txt` file beside it:
   ```
   Art/participants/01/VTubers/Kyle.jpg
   Art/participants/01/VTubers/Kyle.txt
   ```
   The text file can be plain blurb text, or key/value lines like `title: Kyle`, `blurb: Character portrait`, `link: https://...`, `medium: Digital`, `year: 2026`, and `tags: portrait, vtuber`. In the editor toolbar, use **Metadata** to display this text hidden, below the image, beside the image, or overlaid on it for each site version.

   The portfolio also includes a lightweight **social interaction prototype**: sample likes, comment notes, and page sticky notes can render in the browser to show artists what social feedback could feel like. It is **Off by default**; in the editor toolbar, use **Social** to choose All, Likes, Comments, Likes + comments, Page notes, or Off for each site version. These interactions are demo-only and are not stored or sent anywhere.

3. Build the content model (optional if using the local server — Save rebuilds automatically):
   ```bash
   node scripts/build-content.js
   ```

4. Start the app by double-clicking `PortfolioEditor` or running:
   ```bash
   node scripts/serve.js
   ```
   Restart the server after pulling updates so new API routes (e.g. `/api/content-model`, `/api/generate`, `/api/operation`) are available. If port 8080 is busy, run `PORT=8090 node scripts/serve.js`.

5. Visit in your browser (`PortfolioEditor` should open one automatically):
   - **Edit mode**: http://localhost:8080/edit.html
   - **Grid view**: http://localhost:8080/ver1.html
   - **Clothesline view**: http://localhost:8080/ver2.html
   - **Desk view**: http://localhost:8080/ver3.html
   - **Directory view**: http://localhost:8080/ver4.html
   - **Generated views**: `ver5.html`, `ver6.html`, etc. after creating templates

   With the local server running, views read the selected example or participant folder
   live via `/api/content-model` — newly added art shows up on refresh. In the editor,
   enter the participant ID and use **Artwork → My art / Example art** to switch sets.
   Hit **Save** to write static files for deploy.

> **Static-only fallback:** You can open the site with any static server (e.g. `python3 -m http.server`), but then it reads committed `models/content.json` / `manifest.json` instead of scanning live, and Save won't have a backend. Run `node scripts/build-content.js` manually to refresh those files.

### Verify it's working

```bash
node scripts/build-content.js          # should print collections + work count
curl -s http://localhost:8080/api/content-model | head -c 200   # JSON with portfolio, collections, works
```

In the browser: the built-in layout URLs should show the same art, laid out differently (grid vs horizontal strips vs scattered desk vs directory browser). Each view shows the same content model through a different presentation model. Open the console on a view page — no errors from `PortfolioModels`, `PortfolioRender`, or `GeneratedRuntime`.

## Data model (Walo)

The site is driven by three layers:

| Layer | Location | What it describes |
|-------|----------|-------------------|
| **Schema** | `models/schema.json` | Entity types (Portfolio, Artist, Collection, Work) and relationships |
| **Content** | `models/content.json`, `models/participants/*.json` | Shared example art and participant-specific art (one image = one work in v1) |
| **Presentation** | `presentations/*.json` | How work is encountered — layout, metaphor, navigation, UI spec |

Shared styling and text overrides still live in `theme.json` and `content.json`.

```
Art/example/  →  build-content.js  →  models/content.json
Art/participants/01/  →  build-content.js  →  models/participants/01.json
                                    ↓
presentations/grid.json       ──→  scripts/render.js            →  ver1.html (thin shell)
presentations/clothesline.json                                      →  ver2.html
presentations/desk.json                                             →  ver3.html
presentations/directory.json                                        →  ver4.html
generated/*/presentation.json ──→  scripts/generated-runtime.js  →  ver5.html+
theme.json ─────────────────────────────────────────────────────────┘
```

`manifest.json` is kept as a **legacy shim** (`{ collections: [{ name, images }] }`) for static hosting compatibility. New code should prefer `models/content.json`.

### Theme customization

Edit `theme.json` to control:
- **Colors**: primary, secondary, accent, background, paper (artwork mat), panel (clothesline strip background)
- **Typography**: heading1, heading2, body (global + per-layout under `versions`)
- **Spacing**: gridGap, artSize, imagePadding

Changes are visible across layouts when using the editor or after saving.

### Built-in and generated layouts

Each layout is a thin HTML shell plus a presentation spec. Built-in layouts use `scripts/render.js`; generated layouts use `scripts/generated-runtime.js` plus generated CSS/JS in `generated/<layout-key>/`. All layouts read the same content model.

| Layout | File | Presentation spec | Metaphor |
|--------|------|-------------------|----------|
| **Grid** | `ver1.html` | `presentations/grid.json` | Gallery wall — high discoverability |
| **Clothesline** | `ver2.html` | `presentations/clothesline.json` | Prints on a sagging line with clothespins |
| **Desk** | `ver3.html` | `presentations/desk.json` | Scattered surface, draggable tiles |
| **Directory** | `ver4.html` | `presentations/directory.json` | Split-pane file browser |
| **Generated** | `ver5.html+` | `generated/<key>/presentation.json` | AI-created presentation metaphor |

Example prompts for built-in layouts live in `scripts/layouts.js` and appear as chips in the editor's **+ Create New** modal. Generated templates are registered in `generated/registry.json`.

### Adding a new representation by hand

1. Add `presentations/my-layout.json` — layout family, encounter settings, `ui_spec`, and `layout_engine` (see existing specs for structure).
2. Create a thin HTML shell (e.g. `ver6.html`) that loads `loader.js`, `model-loader.js`, `component-registry.js`, `render.js`, and calls:
   ```js
   PortfolioRender.mount({ root: document.getElementById('content'), presentationId: 'my-layout' });
   ```
3. Register the layout in `scripts/layouts.js` and add a button in `edit.html`.

Renderer logic lives in `scripts/render.js`; component types are listed in `scripts/component-registry.js`.

### Generating a new representation with AI

In the editor, click **+ Create New**, enter a prompt, and provide a Cerebras API key. The local server calls `/api/generate`, then writes:

| Path | What it stores |
|------|----------------|
| `generated/<key>/presentation.json` | Walo presentation model for the generated interface |
| `generated/<key>/style.css` | Template-specific CSS, scoped to `body.view-<key>` |
| `generated/<key>/render.js` | Mount function registered on `window.GeneratedLayouts` |
| `generated/<key>/assets/` | Optional inline SVG assets |
| `generated/registry.json` | Generated layout registry used by the editor |
| `ver5.html`, `ver6.html`, ... | Thin static shell for the generated layout |

Generated layouts should still use the shared model layer. The prompt in `scripts/generate-prompt.js` asks the model to:
- keep artist content separate from presentation code
- use `helpers.collectionSection()` for editable section titles
- use `helpers.workTile()` for artwork so images get model bindings
- respect `--space-gridGap`, `--space-artSize`, and `--space-imagePadding`
- show full artworks with `object-fit: contain` unless cropped thumbnails are explicitly requested

#### Example prompt: Filing Cabinet

```text
A skeuomorphic filing cabinet portfolio where each collection is a labeled drawer. The user must click a drawer to open it, revealing the images inside as papers or folders. Keep the cabinet closed by default and show the full artwork inside the opened drawer.
```

### Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to "GitHub Actions"
4. Push any commit to `main` — the workflow auto-deploys

`.github/workflows/deploy.yml` runs `node scripts/build-content.js`, which writes `models/content.json` and `manifest.json`, then deploys the site via `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`.

Visit `https://yourusername.github.io/repo-name/ver1.html` to see your portfolio.

### Optional Supabase participant sessions

Supabase lets study participants save edited portfolio settings under an anonymous ID such as `P001`. Keep the separate name-to-ID lookup outside this repository.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Enable anonymous sign-ins in Supabase Auth settings.
4. Copy your Supabase project URL and anon public key into `scripts/supabase-config.js`.
5. Give the participant an anonymous ID, then have them enter it in the editor and click **Begin session**.
6. Click **Save Changes**. The editor saves locally when the local server is running, and also saves the current `theme` + `content` JSON to Supabase for that participant ID.

If the project was previously configured with the legacy `username` schema and
Supabase reports that `participant_id` is missing from its schema cache, run
`supabase/migrate-participant-id.sql` in the SQL editor. It preserves existing rows.

Pages load a saved study session with `?participant=p001`. If Supabase is not configured, or the participant ID is missing, the site falls back to the default local files.

The selected layout is saved with each participant session. If the selected layout is generated, its generated files must also be committed and deployed; Supabase stores the layout selection and user customizations, not executable renderer code or assets.

Generated layouts are tagged with the participant ID active at creation time and
only appear in that participant's editor. Built-in and older unowned layouts remain shared.
The participant-free `edit.html` researcher view shows every generated layout.

To permanently remove legacy username-based records and start the study with an empty participant-ID table, run `supabase/reset-study-data.sql` once in the Supabase SQL editor. This reset is destructive and cannot be undone.

## Edit mode features

The editor (`/edit.html`) uses a light, minimal UI so the portfolio preview stays the focus. In edit mode you can:

- **Switch representations**: Toggle between built-in and generated previews
- **Edit properties**: Change title, colors, spacing in real time
- **Generate templates**: Use **+ Create New** to create a new presentation model, renderer, and CSS from a prompt
- **Live preview**: See changes instantly in the framed preview pane
- **Save changes**: Writes `theme.json`, `content.json`, and rebuilds `models/content.json` + `manifest.json` from `Art/` (requires `node scripts/serve.js`)
- **Preview static**: Open the current layout in a new tab

### Direct text editing

In the edit preview, **click any heading** (portfolio title or section title) to open a floating toolbar:

- **Text** — change the wording (saved to `content.json`)
- **Font / Size** — **Apply to** lets you target this heading only, all section titles, or all headings on the current layout. Per-layout typography lives in `theme.json` under `versions`.

### Cursor AI assistant

Click an editable object in the preview, then click the small `✦` cursor affordance to open a lightweight prompt attached to that object. This assistant is for **editing the current interface in place**. It should not create a new layout/template.

Supported local operation families:

| Target | Scope options | Examples |
|--------|---------------|----------|
| **Text** | this text only; all section titles; all headings | "make this italic", "rotate this title", "left align these section titles" |
| **Image / work tile** | this image only; all images | "make this image a circle", "make all images black and white", "add a border" |
| **Collection** | this only | "hide this collection in this interface" |
| **Interface spacing** | current interface | "make this less crowded" |

The assistant sends the clicked target and prompt to `/api/operation`. The AI returns a small JSON operation, not arbitrary HTML/CSS. The editor validates the operation against allowlists before applying it:

- `stylePatch` for text styles
- `elementStylePatch` for clicked image/object styles
- `collectionVisibility` for hiding/showing collections in the current presentation
- `spacing` for gap/size changes
- `noop` when the request cannot be safely applied as a local edit

For example, "make this image a circle" becomes an `elementStylePatch` on the clicked work tile, with safe properties like `borderRadius`, `overflow`, `aspectRatio`, `objectFit`, and `objectPosition`.

### Palette swatches

Above the preview, click a palette swatch to open a color pad:

- **↔ horizontal** — shift hue
- **↕ vertical** — lighter (up) or darker (down)

| Swatch | Applies to |
|--------|------------|
| **Background** | Page behind your art |
| **Primary** | Headings, text, borders |
| **Hover** | Edit outlines & nav link hover |
| **Border** | Artwork mat / frame on tiles |
| **Line panel** | Clothesline strip background *(Clothesline layout only)* |
| **Desk** | Desk surface color *(Desk layout only)* |

Layout-specific swatches appear at the end of the strip when you switch layouts. The **Gap** and **Size** sliders adjust spacing and thumbnail/artwork panel size. Generated templates should use those same variables unless a prompt explicitly calls for fixed-size objects.

### Inspect model

Click **Inspect model** in the editor toolbar to open a side panel showing the data behind the preview:

| Tab | What you see |
|-----|----------------|
| **Content** | Live content model with text overrides applied |
| **Presentation** | Current layout spec (`presentations/*.json`) |
| **Schema** | Entity types (`models/schema.json`) |
| **Theme** | Edited colors, typography, spacing |

Use **Copy JSON** to export any tab. Updates when you switch layouts, edit, or save.

## Key files

| Path | Role |
|------|------|
| `Art/` | Source images (folder structure → collections) |
| `models/schema.json` | Walo entity schema |
| `models/content.json` | Structured art data (generated) |
| `presentations/*.json` | Per-layout presentation models |
| `theme.json` | Colors, typography, spacing (includes `panel` for clothesline) |
| `content.json` | Text overrides for headings |
| `manifest.json` | Legacy collection list (generated shim) |
| `scripts/build-content.js` | Scan `Art/` → content model + manifest |
| `scripts/render.js` | Model-driven layout renderer |
| `scripts/generated-runtime.js` | Runtime/helpers for generated layouts |
| `scripts/generate-prompt.js` | Prompt contract for AI-generated templates |
| `scripts/operation-parser.js` | Prompt contract for cursor-local AI edit operations |
| `scripts/cursor-assistant.js` | Cursor-local point-and-prompt assistant inside the preview |
| `scripts/text-edit.js` | Direct manipulation toolbar for editable text |
| `scripts/inspect-model.js` | Edit-mode model inspector panel |
| `scripts/palette-colors.js` | Edit-mode color swatch definitions |
| `scripts/model-loader.js` | Load schema, content, presentation, theme |
| `scripts/serve.js` | Local editor server + APIs |
| `generated/` | AI-generated templates and registry |

### Local server APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/content-model` | GET | Live content model from `Art/` |
| `/api/manifest` | GET | Legacy manifest view |
| `/api/layouts` | GET | Built-in + generated layout registry |
| `/api/rebuild` | POST | Rebuild content model + manifest on disk |
| `/api/theme` | POST | Save `theme.json` (+ optional `content.json`) |
| `/api/content` | POST | Save `content.json` |
| `/api/generate` | POST | Generate a new presentation/CSS/render script with Cerebras |
| `/api/operation` | POST | Parse cursor-assistant prompt into a safe local edit operation |

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
- [ ] Richer content model (medium, tags, visibility, multi-image works)
- [ ] Persist desk tile positions in the content model
- [ ] Persist cursor element style patches into static output more elegantly
- [x] Task-driven data model (content + presentation specs)
- [x] Shared renderer for Grid / Clothesline / Desk / Directory
- [x] AI presentation generator (`generated/*` from prompts)
- [x] Cursor-local assistant for safe point-and-prompt edits
- [x] Inspect model panel in edit mode
- [x] Desk view + example prompts in `scripts/layouts.js`
- [ ] Add dark mode toggle
- [ ] Mobile-optimized edit interface

---

Built as a prototype for malleable, generative art presentation. Extend it however you like!
