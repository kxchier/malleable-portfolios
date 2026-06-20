#!/usr/bin/env node
/**
 * Build Walo content model from Art/ directory structure.
 *
 * Writes models/content.json and a legacy manifest.json shim for static/GitHub Pages.
 * Merges text overrides from content.json (portfolio.title, collection.N).
 */

const fs = require('fs');
const path = require('path');
const { buildCollections, ROOT } = require('./build-manifest.js');

const MODELS_DIR = path.join(ROOT, 'models');
const CONTENT_FILE = path.join(MODELS_DIR, 'content.json');
const LEGACY_CONTENT_FILE = path.join(ROOT, 'content.json');
const MANIFEST_FILE = path.join(ROOT, 'manifest.json');

function titleFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[_-]+/g, ' ').trim() || base;
}

function readTextOverrides() {
  try {
    const raw = JSON.parse(fs.readFileSync(LEGACY_CONTENT_FILE, 'utf8'));
    return raw?.text || {};
  } catch {
    return {};
  }
}

function buildContentModel(collections, textOverrides = {}) {
  const portfolioTitle = textOverrides['portfolio.title']?.content || 'My Art Portfolio';
  const works = [];
  const contentCollections = collections.map((col, colIndex) => {
    const collectionId = `collection_${colIndex}`;
    const titleOverride = textOverrides[`collection.${colIndex}`]?.content;
    const workIds = col.images.map((imagePath, workIndex) => {
      const workId = `work_${colIndex}_${workIndex}`;
      works.push({
        id: workId,
        title: titleFromFilename(imagePath),
        images: [imagePath],
      });
      return workId;
    });
    return {
      id: collectionId,
      title: titleOverride || col.name,
      works: workIds,
    };
  });

  return {
    portfolio: {
      id: 'portfolio_1',
      title: portfolioTitle,
      artist: 'artist_1',
      collections: contentCollections.map((c) => c.id),
    },
    artist: {
      id: 'artist_1',
      name: portfolioTitle,
      bio: null,
      links: [],
    },
    collections: contentCollections,
    works,
  };
}

function toManifestShim(content) {
  const worksById = Object.fromEntries(content.works.map((w) => [w.id, w]));
  return {
    collections: content.collections.map((col) => ({
      name: col.title,
      images: col.works.flatMap((wid) => worksById[wid]?.images || []),
    })),
  };
}

function writeContent() {
  const collections = buildCollections();
  const textOverrides = readTextOverrides();
  const content = buildContentModel(collections, textOverrides);
  const manifest = toManifestShim(content);

  fs.mkdirSync(MODELS_DIR, { recursive: true });
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  return { content, manifest, collections };
}

module.exports = { buildContentModel, toManifestShim, writeContent, CONTENT_FILE };

if (require.main === module) {
  const { content, manifest } = writeContent();
  console.log('Content model built:', CONTENT_FILE);
  console.log('Manifest shim written:', MANIFEST_FILE);
  console.log(
    'Collections:',
    manifest.collections.map((c) => `${c.name} (${c.images.length} images)`).join(', ') || '(none)'
  );
  console.log('Works:', content.works.length);
}
