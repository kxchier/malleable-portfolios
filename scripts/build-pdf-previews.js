#!/usr/bin/env node
/** Generate browser-independent first-page JPEG previews for PDF artwork. */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ART_DIR } = require('./build-manifest.js');

function findPdfs(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) findPdfs(filePath, files);
    else if (entry.isFile() && /\.pdf$/i.test(entry.name)) files.push(filePath);
  });
  return files;
}

function previewPath(pdfPath) {
  return pdfPath.replace(/\.pdf$/i, '.pdf.preview');
}

function buildPdfPreviews(root = ART_DIR) {
  const results = [];
  findPdfs(root).forEach((pdfPath) => {
    const outputPath = previewPath(pdfPath);
    const outputBase = outputPath;
    const result = spawnSync('pdftoppm', [
      '-jpeg',
      '-jpegopt', 'quality=88,optimize=y,progressive=y',
      '-f', '1',
      '-singlefile',
      '-scale-to', '1600',
      pdfPath,
      outputBase,
    ], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      const detail = result.error?.message || result.stderr?.trim() || `exit ${result.status}`;
      throw new Error(`Could not preview ${pdfPath}: ${detail}`);
    }
    fs.renameSync(`${outputBase}.jpg`, outputPath);
    results.push(outputPath);
  });
  return results;
}

module.exports = { buildPdfPreviews, findPdfs, previewPath };

if (require.main === module) {
  const previews = buildPdfPreviews();
  console.log(`Built ${previews.length} PDF preview${previews.length === 1 ? '' : 's'}.`);
}
