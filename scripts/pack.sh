#!/usr/bin/env bash
# Build a self-contained, double-click executable of the editor using Node SEA.
# Produces ./PortfolioEditor — drop it in the repo folder and double-click it.
#
# Requires: Node 20+ (for SEA), network access for esbuild + postject (via npx).
# This is macOS-oriented (codesign steps); see README for Windows/Linux notes.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="PortfolioEditor"
FUSE="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

echo "==> 1/6 Bundling serve.js (+ build-manifest.js) into one file"
mkdir -p build
npx --yes esbuild scripts/serve.js --bundle --platform=node --target=node20 --outfile=build/app.js

echo "==> 2/6 Generating SEA blob"
node --experimental-sea-config sea-config.json

echo "==> 3/6 Copying the Node runtime"
cp "$(command -v node)" "build/$APP_NAME"

echo "==> 4/6 Removing existing signature (macOS)"
codesign --remove-signature "build/$APP_NAME" || true

echo "==> 5/6 Injecting the blob into the binary"
npx --yes postject "build/$APP_NAME" NODE_SEA_BLOB build/sea-prep.blob \
  --sentinel-fuse "$FUSE" \
  --macho-segment-name NODE_SEA

echo "==> 6/6 Re-signing (ad-hoc) + placing at repo root"
codesign --sign - "build/$APP_NAME" || true
cp "build/$APP_NAME" "./$APP_NAME"
chmod +x "./$APP_NAME"

echo ""
echo "Done. Built ./$APP_NAME"
echo "Double-click it in Finder (or run ./$APP_NAME) — it serves THIS folder and opens the editor."
