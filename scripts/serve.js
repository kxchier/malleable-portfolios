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
 *   GET  /api/status    -> { ok: true } so the frontend can detect the local app
 *   (anything else)     -> static file from the project root
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { buildCollections, ROOT } = require('./build-manifest.js');
const { writeContent } = require('./build-content.js');

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
    return sendJSON(res, 200, { collections: buildCollections() });
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
    const content = buildContentModel(buildCollections(), textOverrides);
    return sendJSON(res, 200, content);
  }

  if (pathname === '/api/rebuild' && req.method === 'POST') {
    const { content, manifest } = writeContent();
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
  console.log(`\n  Edits to Art/ show up live. Hit Save in the editor to write the static files.\n`);
  // As a double-click app there's no terminal to copy a URL from, so open it for them.
  if (isSea) openBrowser(editorUrl);
});
