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
      section.dataset.modelKind = 'collection';
      section.dataset.modelPath = `collections.${collection.originalIndex ?? collectionIndex}`;
      section.dataset.collectionId = `collection_${collection.originalIndex ?? collectionIndex}`;
      section.dataset.modelLabel = collection.name;

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
      if (opts.fixedSize === true) tile.dataset.fixedSize = 'true';
      if (opts.collectionIndex != null || opts.workIndex != null) {
        const ci = opts.collectionIndex ?? 0;
        const wi = opts.workIndex ?? 0;
        tile.dataset.modelKind = 'work';
        tile.dataset.modelPath = `collections.${ci}.works.${wi}`;
        tile.dataset.collectionIndex = String(ci);
        tile.dataset.workIndex = String(wi);
        tile.dataset.workId = opts.workId || `work_${ci}_${wi}`;
        tile.dataset.modelLabel = opts.label || imgPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Artwork';
      }

      const image = document.createElement('img');
      image.src = imgPath;
      image.alt = opts.alt || 'artwork';
      image.draggable = false;
      image.dataset.generatedArtworkImage = 'true';
      image.classList.add('generated-artwork-image');
      image.onerror = () => image.remove();
      tile.appendChild(image);
      return tile;
    }

    function inlineAsset(name, assets) {
      return assets[name] || '';
    }

    return { collectionSection, workTile, inlineAsset };
  }

  function bindCollectionHeading(el, collection, models, versionKey) {
    const PC = window.PortfolioContent;
    if (!el || !collection || !PC || el.dataset.textId) return;
    const originalIndex = collection.originalIndex;
    if (originalIndex == null) return;
    const cid = PC.collectionId(originalIndex);
    el.dataset.textId = cid;
    el.dataset.textRole = 'collection.title';
    el.dataset.textFallback = collection.name;
    el.dataset.modelKind = 'text';
    el.dataset.modelPath = `content.text.${cid}`;
    el.dataset.modelLabel = `${collection.name} title`;
    el.textContent = PC.getText(models.contentOverrides, cid, collection.name);
    const style = PC.styleToCss(
      PC.getElementStyle(models.theme, models.contentOverrides, cid, 'collection.title', versionKey)
    );
    if (style) el.setAttribute('style', `${el.getAttribute('style') || ''};${style}`);
  }

  function bindGeneratedText(root, collections, models, versionKey) {
    const PC = window.PortfolioContent;
    if (!PC) return;

    collections.forEach((collection, renderedIndex) => {
      const selectors = [
        `[data-collection-index="${renderedIndex}"]`,
        `[data-collection-index="${collection.originalIndex}"]`,
      ];
      const containers = Array.from(root.querySelectorAll(selectors.join(',')));
      containers.forEach((container) => {
        const heading = container.matches('h1,h2,h3,h4,h5,h6')
          ? container
          : container.querySelector('h1,h2,h3,h4,h5,h6');
        bindCollectionHeading(heading, collection, models, versionKey);
      });
    });

    const textCandidates = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,figcaption,blockquote,li,span,small,strong,em'))
      .filter((el) => {
        if (el.dataset.textId || el.closest('[data-text-id]')) return false;
        if (el.closest('svg')) return false;
        if (el.querySelector('img,svg,video,canvas,input,textarea,select,button')) return false;
        return (el.textContent || '').trim().length > 0;
      });

    textCandidates.forEach((el, index) => {
      const fallback = (el.textContent || '').trim();
      const role = el.matches('h1') ? 'portfolio.title'
        : el.matches('h2,h3,h4,h5,h6') ? 'collection.title'
          : 'body';
      const id = `generated.${versionKey}.${el.tagName.toLowerCase()}.${index}`;
      el.dataset.textId = id;
      el.dataset.textRole = role;
      el.dataset.textFallback = fallback;
      el.dataset.modelKind = 'text';
      el.dataset.modelPath = `content.text.${id}`;
      el.dataset.modelLabel = fallback.slice(0, 48);
      el.textContent = PC.getText(models.contentOverrides, id, fallback);
      const style = PC.styleToCss(PC.getElementStyle(models.theme, models.contentOverrides, id, role, versionKey));
      if (style) el.setAttribute('style', `${el.getAttribute('style') || ''};${style}`);
    });
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
    const collections = allCollections(resolvedModels.manifest).filter((collection) => {
      const id = window.PortfolioContent?.collectionId(collection.originalIndex) ?? `collection.${collection.originalIndex}`;
      const hiddenIn = resolvedModels.contentOverrides?.visibility?.collections?.[id]?.hiddenIn || [];
      return !hiddenIn.includes(layoutKey);
    });
    const helpers = buildHelpers(resolvedModels, versionKey);

    root.innerHTML = '';
    root.dataset.modelKind = 'presentation';
    root.dataset.modelPath = `presentations.${layoutKey}`;
    root.dataset.presentationId = layoutKey;
    root.dataset.modelLabel = `${layoutKey} presentation`;
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

    bindGeneratedText(root, collections, resolvedModels, versionKey);

    root.querySelectorAll('.generated-collection').forEach((section) => {
      const ci = Number(section.dataset.collectionIndex || section.dataset.modelPath?.split('.')[1] || 0);
      section.querySelectorAll('[data-canvas-draggable="true"]').forEach((tile, wi) => {
        if (tile.dataset.modelKind) return;
        tile.dataset.modelKind = 'work';
        tile.dataset.modelPath = `collections.${ci}.works.${wi}`;
        tile.dataset.collectionIndex = String(ci);
        tile.dataset.workIndex = String(wi);
        tile.dataset.workId = `work_${ci}_${wi}`;
        const img = tile.querySelector('img');
        tile.dataset.modelLabel = img?.alt && img.alt !== 'artwork'
          ? img.alt
          : img?.src?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Artwork';
      });
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
