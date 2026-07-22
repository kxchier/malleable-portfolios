#!/usr/bin/env node
/**
 * Local authoring server for the art-portfolio app.
 *
 * Run:  node scripts/serve.js   (then open http://localhost:8080/edit.html)
 *
 * Unlike GitHub Pages (static, no backend), this server runs on YOUR machine and
 * has real filesystem access. That's what lets the editor rebuild the site with a
 * button click. "Save" writes the same static files (manifest.json, theme.json)
 * that get committed and served by GitHub Pages — so what you edit locally is
 * exactly what deploys.
 *
 * Endpoints:
 *   GET  /api/manifest  -> live scan of Art/ (always current, never stale)
 *   POST /api/rebuild   -> rescan Art/ and write manifest.json to disk
 *   POST /api/theme     -> write the posted JSON body to theme.json
 *   POST /api/content   -> write the posted JSON body to content.json
 *   GET  /api/layouts   -> built-in + AI-generated layout registry
 *   POST /api/layouts/delete -> remove a generated layout and its files
 *   POST /api/operation -> selected AI provider: parse cursor request into a local operation
 *   POST /api/portfolio-operation -> Anthropic: parse page-level sparkle request into safe edits
 *   POST /api/design-axis -> selected AI provider: score layouts on a custom design axis
 *   POST /api/image-design-tokens -> OpenAI vision: extract structured design tokens from an image
 *   POST /api/assets/generate -> selected AI provider: add decorative SVG assets to a layout
 *   POST /api/generate-questions -> selected AI provider: ask design questions before generation
 *   POST /api/generate  -> selected AI provider: create new layout (presentation + CSS + JS + SVG assets)
 *   GET  /api/status    -> { ok: true } so the frontend can detect the local app
 *   (anything else)     -> static file from the project root
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { ART_DIR, EXAMPLE_ART_DIR, buildCollections, ROOT } = require('./build-manifest.js');
const { writeContent } = require('./build-content.js');
const { listAllLayouts, deleteGeneratedLayout } = require('./layout-registry.js');
const { generateTemplate } = require('./generate-template.js');
const { parseCursorOperation } = require('./operation-parser.js');
const { parsePortfolioOperation } = require('./portfolio-operation-parser.js');
const { scoreDesignAxis } = require('./design-axis-parser.js');
const { analyzeImageDesignTokens } = require('./image-design-tokens.js');
const { generateDecorativeAssets } = require('./asset-generator.js');

const PORT = process.env.PORT || 8080;

// True when running as a packaged single-executable app (Node SEA)
let isSea = false;
try { isSea = require('node:sea').isSea(); } catch (e) { /* not a SEA */ }

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? `open "${url}"`
    : process.platform === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => { /* best effort */ });
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function artSelection(req) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const participantId = String(requestUrl.searchParams.get('participant') || '')
    .trim().toLowerCase();
  const wantsParticipant = requestUrl.searchParams.get('art') === 'participant';
  if (wantsParticipant && /^[a-z0-9_-]{1,40}$/.test(participantId)) {
    return {
      kind: 'participant',
      participantId,
      root: path.join(ART_DIR, 'participants', participantId),
    };
  }
  return { kind: 'example', participantId: '', root: EXAMPLE_ART_DIR };
}

function collectionsForRequest(req) {
  return buildCollections(artSelection(req).root);
}

function textOverridesForRequest(req, textOverrides) {
  if (artSelection(req).kind === 'participant') return textOverrides;
  return { 'portfolio.title': textOverrides['portfolio.title'] };
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return sendJSON(res, 400, { error: 'bad url' });
  }

  // ---- API ----
  if (pathname === '/api/status') {
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/manifest' && req.method === 'GET') {
    return sendJSON(res, 200, { collections: collectionsForRequest(req) });
  }

  if (pathname === '/api/content-model' && req.method === 'GET') {
    const { buildContentModel } = require('./build-content.js');
    let textOverrides = {};
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
      textOverrides = raw?.text || {};
    } catch (e) {
      // no overrides yet
    }
    const content = buildContentModel(
      collectionsForRequest(req),
      textOverridesForRequest(req, textOverrides)
    );
    return sendJSON(res, 200, content);
  }

  if (pathname === '/api/rebuild' && req.method === 'POST') {
    let textOverrides = {};
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
      textOverrides = raw?.text || {};
    } catch (e) {
      // no overrides yet
    }
    const selection = artSelection(req);
    const contentFile = selection.kind === 'participant'
      ? path.join(ROOT, 'models', 'participants', `${selection.participantId}.json`)
      : path.join(ROOT, 'models', 'content.json');
    const { content, manifest } = writeContent(
      collectionsForRequest(req),
      textOverridesForRequest(req, textOverrides),
      { contentFile, writeManifest: selection.kind === 'example' }
    );
    console.log(`[rebuild] ${manifest.collections.length} collection(s) — content model + manifest written`);
    return sendJSON(res, 200, { collections: manifest.collections, content, written: true });
  }

  if (pathname === '/api/theme' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const content = body.content;
      const theme = { ...body };
      delete theme.content;
      fs.writeFileSync(path.join(ROOT, 'theme.json'), JSON.stringify(theme, null, 2));
      if (content) {
        fs.writeFileSync(path.join(ROOT, 'content.json'), JSON.stringify(content, null, 2));
        console.log('[theme] theme.json + content.json saved');
      } else {
        console.log('[theme] theme.json saved');
      }
      return sendJSON(res, 200, { written: true, contentWritten: Boolean(content) });
    } catch (e) {
      return sendJSON(res, 400, { error: 'invalid theme json: ' + e.message });
    }
  }

  if (pathname === '/api/content' && req.method === 'POST') {
    try {
      const content = JSON.parse(await readBody(req));
      fs.writeFileSync(path.join(ROOT, 'content.json'), JSON.stringify(content, null, 2));
      console.log('[content] content.json saved');
      return sendJSON(res, 200, { written: true });
    } catch (e) {
      return sendJSON(res, 400, { error: 'invalid content json: ' + e.message });
    }
  }

  if (pathname === '/api/layouts' && req.method === 'GET') {
    return sendJSON(res, 200, { layouts: listAllLayouts() });
  }

  if (pathname === '/api/layouts/delete' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const key = body.key || body.layoutKey;
      if (!key) return sendJSON(res, 400, { error: 'missing layout key' });
      const result = deleteGeneratedLayout(key);
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[layouts/delete]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/operation' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const collections = buildCollections();
      let theme = {};
      try {
        theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'theme.json'), 'utf8'));
      } catch {
        // defaults
      }
      const result = await parseCursorOperation({
        target: body.target,
        prompt: body.prompt,
        scope: body.scope,
        presentationId: body.presentationId,
        context: {
          contentSummary: {
            collections: collections.map((col) => ({ name: col.name, count: col.images.length })),
          },
          theme: theme.colors || {},
        },
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[operation]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/portfolio-operation' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const collections = buildCollections();
      let theme = {};
      try {
        theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'theme.json'), 'utf8'));
      } catch {
        // defaults
      }
      const layouts = listAllLayouts();
      const layout = layouts.find((item) => item.key === body.layoutKey || item.presentationId === body.presentationId);
      let presentation = {};
      if (layout?.key) {
        const presentationPath = layout.generated
          ? path.join(ROOT, 'generated', layout.key, 'presentation.json')
          : path.join(ROOT, 'presentations', `${layout.key}.json`);
        try {
          presentation = JSON.parse(fs.readFileSync(presentationPath, 'utf8'));
        } catch {
          presentation = {};
        }
      }
      const result = await parsePortfolioOperation({
        provider: 'anthropic',
        prompt: body.prompt,
        layout,
        presentation,
        context: {
          contentSummary: {
            collections: collections.map((col) => ({ name: col.name, count: col.images.length })),
          },
          theme: body.theme || theme,
          spacing: body.spacing || theme.spacing || {},
        },
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[portfolio-operation]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/design-axis' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const layouts = listAllLayouts();
      const result = await scoreDesignAxis({
        axis: body.axis,
        layouts,
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[design-axis]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/image-design-tokens' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const result = await analyzeImageDesignTokens({
        image: body.image,
        mimeType: body.mimeType,
        fileName: body.fileName,
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[image-design-tokens]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/assets/generate' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const result = await generateDecorativeAssets({
        layoutKey: body.layoutKey,
        prompt: body.prompt,
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[assets/generate]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/generate-questions' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      // Reload so description truncation / prompt tweaks apply without a full restart.
      delete require.cache[require.resolve('./generate-questions.js')];
      const { generateQuestions: askGenerateQuestions } = require('./generate-questions.js');
      const result = await askGenerateQuestions({
        prompt: body.prompt,
        designSpace: body.designSpace,
        answers: Array.isArray(body.answers) ? body.answers : [],
        layouts: listAllLayouts(),
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      console.error('[generate-questions]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/generate' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const { buildContentModel } = require('./build-content.js');
      let textOverrides = {};
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
        textOverrides = raw?.text || {};
      } catch (e) {
        // no overrides
      }
      const collections = buildCollections();
      let theme = {};
      try {
        theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'theme.json'), 'utf8'));
      } catch (e) {
        // defaults
      }
      const existingLayouts = listAllLayouts();

      const { layout, versionTheme, versionColors, versionTypography, versionSpacing } = await generateTemplate({
        prompt: body.prompt,
        context: {
          collections,
          existingLayouts,
          primary: theme.colors?.primary,
          accent: theme.colors?.accent,
          background: theme.colors?.background,
          designSpace: body.designSpace,
          referenceImage: body.referenceImage,
        },
      });

      return sendJSON(res, 200, {
        layout,
        versionTheme,
        versionColors,
        versionTypography,
        versionSpacing,
        layouts: listAllLayouts(),
      });
    } catch (e) {
      console.error('[generate]', e.message);
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // ---- Static files ----
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(ROOT, rel);

  // Keep requests inside the project root
  if (!filePath.startsWith(ROOT)) {
    return sendJSON(res, 403, { error: 'forbidden' });
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  const editorUrl = `http://localhost:${PORT}/edit.html`;
  console.log(`\n  Art portfolio editor running:`);
  console.log(`    ${editorUrl}   (editor)`);
  console.log(`    http://localhost:${PORT}/ver1.html   (grid view)`);
  console.log(`    http://localhost:${PORT}/ver2.html   (clothesline view)`);
  console.log(`    http://localhost:${PORT}/ver3.html   (desk view)`);
  console.log(`    http://localhost:${PORT}/ver4.html   (directory view)`);
  console.log(`\n  Edits to Art/ show up live. Hit Save in the editor to write the static files.\n`);
  // As a double-click app there's no terminal to copy a URL from, so open it for them.
  if (isSea) openBrowser(editorUrl);
});
