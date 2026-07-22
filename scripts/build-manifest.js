#!/usr/bin/env node
/**
 * Build manifest from Art/ directory structure.
 *
 * Exposes the scan logic so the local dev server (scripts/serve.js) can reuse it
 * to rebuild on demand. Run directly (or in GitHub Actions) to write manifest.json.
 *
 * Any folder that directly contains images becomes a collection. Nested folders
 * are supported: Art/Comics/Fall Chilly/ becomes a collection "Comics / Fall Chilly".
 */

const fs = require('fs');
const path = require('path');

// ROOT is the project folder we read/write. Normally that's one level up from
// scripts/. When bundled as a single-executable app (Node SEA), there is no
// scripts/ dir on disk, so anchor to the folder the executable sits in instead.
let isSea = false;
try { isSea = require('node:sea').isSea(); } catch (e) { /* older Node: not a SEA */ }
const ROOT = isSea ? path.dirname(process.execPath) : path.join(__dirname, '..');
const ART_DIR = path.join(ROOT, 'Art');
const EXAMPLE_ART_DIR = path.join(ART_DIR, 'example');
const OUTPUT_FILE = path.join(ROOT, 'manifest.json');

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

function walk(dir, collections, collectionRoot) {
  const entries = fs.readdirSync(dir).sort();

  const images = entries
    .filter(f => IMAGE_RE.test(f) && fs.statSync(path.join(dir, f)).isFile())
    .map(f => path.relative(ROOT, path.join(dir, f)));

  if (images.length > 0) {
    const rel = path.relative(collectionRoot, dir);
    const name = rel === '' ? 'Art' : rel.split(path.sep).join(' / ');
    collections.push({ name, images });
  }

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, collections, collectionRoot);
    }
  });
}

/** Scan Art/ and return the collections array (no disk write). */
function buildCollections(collectionRoot = (fs.existsSync(EXAMPLE_ART_DIR) ? EXAMPLE_ART_DIR : ART_DIR)) {
  if (!fs.existsSync(collectionRoot)) return [];
  const collections = [];
  walk(collectionRoot, collections, collectionRoot);
  return collections;
}

/** Scan Art/ and write manifest.json. Returns the collections array. */
function writeManifest() {
  const collections = buildCollections();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ collections }, null, 2));
  return collections;
}

module.exports = { ART_DIR, EXAMPLE_ART_DIR, buildCollections, writeManifest, OUTPUT_FILE, ROOT };

// Run as a CLI (GitHub Actions, or `node scripts/build-manifest.js`)
if (require.main === module) {
  const { buildContentModel, toManifestShim } = require('./build-content.js');
  const manifest = toManifestShim(buildContentModel(buildCollections(), {}));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
  console.log('Manifest built:', OUTPUT_FILE);
  console.log('Collections:', manifest.collections.map((c) => `${c.name} (${c.images.length} images)`).join(', ') || '(none)');
}
