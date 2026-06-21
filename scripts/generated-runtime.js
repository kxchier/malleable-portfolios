/** Runtime for AI-generated layouts — Model + Canvas + Cursor Assistant layers. */
window.GeneratedRuntime = (() => {
  async function fetchSvgAssets(layoutKey) {
    const assets = {};
    try {
      const indexRes = await fetch(`./generated/${layoutKey}/assets/`);
      if (!indexRes.ok) return assets;
    } catch {
      return assets;
    }

    const known = ['frame.svg', 'wall-pattern.svg', 'clip.svg', 'hook.svg', 'moulding.svg'];
    await Promise.all(
      known.map(async (file) => {
        try {
          const res = await fetch(`./generated/${layoutKey}/assets/${file}`);
          if (res.ok) assets[file] = await res.text();
        } catch {
          /* optional asset */
        }
      })
    );
    return assets;
  }

  function buildHelpers(models, versionKey) {
    const PC = window.PortfolioContent;

    function collectionSection(collection, collectionIndex) {
      const section = document.createElement('section');
      section.className = 'generated-collection';
      section.dataset.collectionIndex = String(collectionIndex);

      const h2 = document.createElement('h2');
      if (collection.originalIndex != null && PC) {
        const cid = PC.collectionId(collection.originalIndex);
        h2.dataset.textId = cid;
        h2.dataset.textRole = 'collection.title';
        h2.dataset.textFallback = collection.name;
        h2.textContent = PC.getText(models.contentOverrides, cid, collection.name);
        const style = PC.styleToCss(
          PC.getElementStyle(models.theme, models.contentOverrides, cid, 'collection.title', versionKey)
        );
        if (style) h2.setAttribute('style', style);
      } else {
        h2.textContent = collection.name;
      }

      section.appendChild(h2);
      return section;
    }

    function workTile(imgPath, opts = {}) {
      const tile = document.createElement('div');
      tile.className = opts.className || 'generated-work-tile scroll-item';
      if (opts.draggable !== false) tile.dataset.canvasDraggable = 'true';

      const image = document.createElement('img');
      image.src = imgPath;
      image.alt = opts.alt || 'artwork';
      image.draggable = false;
      image.onerror = () => image.remove();
      tile.appendChild(image);
      return tile;
    }

    function inlineAsset(name, assets) {
      return assets[name] || '';
    }

    return { collectionSection, workTile, inlineAsset };
  }

  function bindCanvasDrag(root) {
    root.querySelectorAll('[data-canvas-draggable="true"]').forEach((item) => {
      if (item.dataset.canvasBound === '1') return;
      item.dataset.canvasBound = '1';

      item.style.cursor = 'grab';
      item.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('[data-text-id]')) return;
        e.preventDefault();

        const parent = item.offsetParent || item.parentElement;
        if (!parent) return;

        if (getComputedStyle(item).position === 'static') {
          item.style.position = 'relative';
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseFloat(item.style.left) || 0;
        const startTop = parseFloat(item.style.top) || 0;

        item.style.cursor = 'grabbing';
        item.dataset.canvasDragged = '1';

        const onMove = (ev) => {
          item.style.left = `${startLeft + ev.clientX - startX}px`;
          item.style.top = `${startTop + ev.clientY - startY}px`;
        };

        const onUp = () => {
          item.style.cursor = 'grab';
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onUp);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      });
    });
  }

  function allCollections(manifest) {
    return manifest.collections.map((col, index) => ({
      id: window.PortfolioContent?.collectionId(index) ?? `collection_${index}`,
      originalIndex: index,
      ...col,
    }));
  }

  async function mount({ root, layoutKey, models, previewState }) {
    const resolvedModels = models || await window.PortfolioModels.load(layoutKey, previewState || {});
    const versionKey = previewState?.versionKey || layoutKey;
    const layout = window.GeneratedLayouts?.[layoutKey];

    if (!layout || typeof layout.mount !== 'function') {
      root.innerHTML = `<p class="generated-error">Generated layout "${layoutKey}" has no mount function.</p>`;
      return resolvedModels;
    }

    document.body.classList.remove('view-grid', 'view-clothesline', 'view-desk', 'view-directory');
    document.querySelectorAll('[class^="view-"]').forEach(() => {});
    document.body.classList.add(`view-${layoutKey}`);

    const assets = await fetchSvgAssets(layoutKey);
    const collections = allCollections(resolvedModels.manifest);
    const helpers = buildHelpers(resolvedModels, versionKey);

    root.innerHTML = '';
    layout.mount(root, {
      collections,
      theme: resolvedModels.theme,
      contentOverrides: resolvedModels.contentOverrides,
      presentation: resolvedModels.presentation,
      assets,
      helpers,
      layoutKey,
      versionKey,
    });

    if (window.PortfolioContent) {
      PortfolioContent.applyPageText(
        resolvedModels.manifest,
        resolvedModels.theme,
        resolvedModels.contentOverrides,
        versionKey
      );
    }

    bindCanvasDrag(root);

    return resolvedModels;
  }

  function remount(root, layoutKey, models, versionKey) {
    return mount({
      root,
      layoutKey,
      models,
      previewState: { versionKey, theme: models.theme, content: models.contentOverrides },
    });
  }

  return { mount, remount, bindCanvasDrag, buildHelpers, allCollections };
})();
