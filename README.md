# GitHub Pages Art Portfolio Template
HI GUYZ~! :D
This is a mockup of a malleable, editable art portfolio template site, designed for GitHub Pages. It includes a "Portfolio Editor" program (intended to run locally) that allows both direct manipulation and AI-powered generation of static html representations of a portfolio site, that could then be hosted by github pages. It looks for art collections and subcollections inside the "Art" folder. 


## Quick Start

(HOW PEOPLE WOULD USE THIS)
### Run the editor locally

1. Clone this repo:
   ```bash
   git clone <repo-url>
   cd gh-pages-art-portfolio-template
   ```

2. Add your artwork to `Art/`, organized by collection. Nested folders that contains images each become a collection. I've included some of my art to work as an example, but actually i think in practice this folder would be git ignored.
   ```
   Art/VTubers/Kyle.jpg
   Art/Comics/Fall Chilly/00.jpg     →  collection "Comics / Fall Chilly"
   ```

3. Start the app by double clicking PortfolioEditor or running:

   ```bash
   node scripts/serve.js
   ```

4. Visit in your browser (the PortfolioEditor script should open a browser automatically):
   - **Edit mode**: http://localhost:8080/edit.html
   - **Grid view**: http://localhost:8080/ver1.html
   - **Clothesline view**: http://localhost:8080/ver2.html
   - **Desk view**: http://localhost:8080/ver3.html

   The views read your `Art/` folder live, so newly added art shows up on refresh.
   Hit **Save** in the editor to write the static files for deploy.


THE FOLLOWING ARE NOTES FOR THE FUTURE MOSTLY (thanks claude)

> Tip: you can still open the site with any static server (e.g. `python3 -m http.server`),
> but then it reads the committed `manifest.json` instead of scanning live, and Save
> won't have a backend to write to. Run `node scripts/build-manifest.js` manually to
> refresh the manifest in that case.

### Theme Customization

Edit `theme.json` to control:
- **Colors**: primary, secondary, accent, background
- **Typography**: heading1, heading2, body font sizes
- **Spacing**: gridGap, imagePadding

Changes to `theme.json` are immediately visible in all views.

### Built-in layouts

| Layout | File | Example prompt |
|--------|------|----------------|
| **Grid** | `ver1.html` | A clean responsive grid of square thumbnails, grouped by collection, with even spacing and chunky borders. |
| **Clothesline** | `ver2.html` | Horizontal scroll strips per collection, like prints clipped on a clothesline — peek and swipe sideways. |
| **Desk** | `ver3.html` | A scattered desk layout — prints loosely piled on a flat surface with slight tilts and soft overlaps. |

Prompts live in `scripts/layouts.js` and appear as chips in the editor's **+ Create New** modal (hover a layout button in edit mode to see its prompt).

### Adding New Representations

1. Create a new HTML file (e.g., `ver4.html`)
2. Load manifest and theme using `loader.js`
3. Render your custom layout reading from `manifest.collections`
4. Add an entry to `scripts/layouts.js` and a button in `edit.html`

### Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to "GitHub Actions"
4. Push any commit to `main`—the workflow will auto-deploy

The `.github/workflows/deploy.yml` automatically:
- Runs `build-manifest.js` to scan your Art/ folder
- Generates fresh `manifest.json`
- Deploys everything to GitHub Pages

Visit `https://yourusername.github.io/repo-name/ver1.html` to see your portfolio!

## Edit Mode Features

In `/edit.html`, you can:

- **Switch representations**: Toggle between different portfolio views
- **Edit properties**: Change title, colors, spacing in real-time
- **Live preview**: See changes instantly in the preview pane
- **Save changes**: Writes `theme.json` and rebuilds `manifest.json` from `Art/`
  (requires the local server — `node scripts/serve.js`)
- **Preview static**: Open static view in new tab

### Direct Manipulation Coming Soon

- Click headings to inline-edit typography
- Drag color swatches to adjust palette
- Resize grid gaps with interactive controls
- Generate new representations with AI prompts

## Packaging as a double-click app

Instead of `node scripts/serve.js` in a terminal, the editor can ship as a **self-contained,
double-click app** with no Node install and no command line — ideal for non-technical users
(e.g. study participants). This is **purely a packaging step**; the app code is unchanged
apart from anchoring its working folder to the executable's location and auto-opening the
browser when run as a packaged app. The binary bundles the Node runtime + the server, sits
inside the portfolio folder, and on launch serves that folder and opens the editor — keeping
the same local filesystem access that scans `Art/` and writes `manifest.json` / `theme.json`.

### Build it

A working build script is included (macOS; uses Node SEA — official, built into Node 20+):

```bash
bash scripts/pack.sh          # produces ./PortfolioEditor (gitignored, ~105 MB)
./PortfolioEditor             # or double-click it in Finder
```

Under the hood `pack.sh` does the standard Node SEA flow: bundle `serve.js` +
`build-manifest.js` into one file with `esbuild` → generate a blob from `sea-config.json`
via `node --experimental-sea-config` → copy the `node` binary → inject the blob with
`postject` → ad-hoc code-sign. (Alternative: `bun build --compile` does this in one command.
Avoid `vercel/pkg` — it's deprecated/archived.)

> The binary must sit **in the portfolio folder** (next to `Art/`, `edit.html`, etc.) — it
> serves whatever folder it lives in.

### Two tweaks to make it feel like an app

- **Auto-open the browser** on launch: have `serve.js` spawn the OS "open" command after
  `server.listen()` — `open` (macOS), `start` (Windows), `xdg-open` (Linux).
- **No terminal window** (macOS): wrap the binary in a minimal `.app` bundle so Finder
  launches it without a Terminal window.

### Caveats

- **Per-OS builds**: the binary is native — build separately for macOS, Windows, Linux (and
  per-arch on macOS, arm64 vs x64). `pack.sh` currently targets macOS.
- **Terminal flash on double-click (macOS)**: Finder runs a bare Unix executable inside a
  Terminal window. To launch with no terminal, wrap the binary in a minimal `.app` bundle —
  a small future polish.
- **Code signing / Gatekeeper**: `pack.sh` ad-hoc signs (runs fine on the machine that built
  it). To distribute to other Macs without "cannot verify developer" warnings, sign +
  notarize; Windows needs its own signing to avoid SmartScreen.
- The **Publish to GitHub** step is unaffected — it stays mocked (or becomes a real GitHub
  API call later) regardless of packaging.

## Next Steps

- [ ] Package as a double-click app (Node SEA) — see above
- [ ] Add image upload/reordering in edit mode
- [ ] Implement AI representation generator
- [ ] Add save/sync to backend (Firebase, Netlify, etc.)
- [x] Create ver3+ custom layouts (Desk view + example prompts in `scripts/layouts.js`)
- [ ] Add dark mode toggle
- [ ] Mobile-optimized edit interface

---

Built as a prototype for malleable, generative design. Extend it however you like!
