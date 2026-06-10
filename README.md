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

### Adding New Representations

1. Create a new HTML file (e.g., `ver3.html`)
2. Load manifest and theme using `loader.js`
3. Render your custom layout reading from `manifest.collections`
4. Add a button in `edit.html` to switch to your new version

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
