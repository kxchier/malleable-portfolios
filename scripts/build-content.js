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

function textMetadataPath(imagePath) {
  const parsed = path.parse(path.join(ROOT, imagePath));
  return path.join(parsed.dir, `${parsed.name}.txt`);
}

function normalizeMetadataKey(key) {
  const normalized = String(key || '').trim().toLowerCase();
  if (['name', 'title'].includes(normalized)) return 'title';
  if (['blurb', 'caption', 'description', 'desc', 'context'].includes(normalized)) return 'description';
  if (['url', 'href', 'link'].includes(normalized)) return 'link';
  if (['medium', 'media'].includes(normalized)) return 'medium';
  if (['year', 'date'].includes(normalized)) return 'year';
  if (['tags', 'tag'].includes(normalized)) return 'tags';
  return normalized;
}

function parseWorkMetadata(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};

  const metadata = {};
  const descriptionLines = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (descriptionLines.length) descriptionLines.push('');
      return;
    }

    const match = trimmed.match(/^([A-Za-z][A-Za-z0-9 _-]{0,32})\s*:\s*(.+)$/);
    if (!match) {
      descriptionLines.push(line);
      return;
    }

    const key = normalizeMetadataKey(match[1]);
    const value = match[2].trim();
    if (!value) return;
    if (key === 'tags') {
      metadata.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
    } else if (key === 'description') {
      descriptionLines.push(value);
    } else if (key === 'link') {
      if (/^(https?:\/\/|mailto:)/i.test(value)) metadata.link = value;
    } else if (['title', 'medium', 'year'].includes(key)) {
      metadata[key] = value;
    } else {
      descriptionLines.push(line);
    }
  });

  const description = descriptionLines.join('\n').trim();
  if (description) metadata.description = description;
  if (!metadata.link) {
    const linkMatch = text.match(/https?:\/\/\S+/);
    if (linkMatch) metadata.link = linkMatch[0].replace(/[),.;]+$/, '');
  }
  return metadata;
}

function readWorkMetadata(imagePath) {
  const filePath = textMetadataPath(imagePath);
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return {};
    return parseWorkMetadata(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
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
      const metadata = readWorkMetadata(imagePath);
      works.push({
        id: workId,
        title: metadata.title || titleFromFilename(imagePath),
        images: [imagePath],
        ...metadata,
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
