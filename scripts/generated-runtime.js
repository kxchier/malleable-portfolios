/** Runtime for AI-generated layouts — Model + Canvas + Cursor Assistant layers. */
window.GeneratedRuntime = (() => {
  async function fetchSvgAssets(layoutKey) {
    const assets = {};
    const known = [
      'frame.svg',
      'wall-pattern.svg',
      'clip.svg',
      'hook.svg',
      'moulding.svg',
      'brass-pull.svg',
      'cabinet-nameplate.svg',
      'folder-tab-texture.svg',
      'index-card-lines.svg',
      'wood-grain.svg',
      'butterfly.svg',
      'flower.svg',
      'sparkle.svg',
      'star.svg',
      'cloud.svg',
      'cloud-band.svg',
      'swirl-divider.svg',
      'creature.svg',
      'creature2.svg',
      'fish.svg',
      'coral.svg',
      'cityscape.svg',
      'turbine.svg',
      'washi-tape.svg',
      'sketch-frame.svg',
      'corner-doodle.svg',
      'leaf.svg',
      'small-flower.svg',
      'rack-edge.svg',
      'spine-texture.svg',
      'close-icon.svg',
    ];
    const files = new Set(known);
    try {
      const indexRes = await fetch(`./generated/${layoutKey}/assets/index.json`);
      if (indexRes.ok) {
        const index = await indexRes.json();
        const listed = Array.isArray(index) ? index : index.files;
        if (Array.isArray(listed)) {
          listed.forEach((file) => {
            if (typeof file === 'string' && file.endsWith('.svg')) files.add(file);
          });
        }
      }
    } catch {
      /* optional asset index */
    }

    await Promise.all(
      [...files].map(async (file) => {
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

  async function fetchDecorations(layoutKey) {
    try {
      const res = await fetch(`./generated/${layoutKey}/assets/decorations.json?ts=${Date.now()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function mountDecorations(root, assets, decorations) {
    if (!root || !Array.isArray(decorations) || !decorations.length) return;

    if (!document.getElementById('generated-asset-decoration-styles')) {
      const style = document.createElement('style');
      style.id = 'generated-asset-decoration-styles';
      style.textContent = `
        .generated-asset-decorations {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 8;
          overflow: hidden;
        }
        .generated-asset-decoration {
          position: absolute;
          display: block;
          width: var(--asset-size, 76px);
          height: var(--asset-size, 76px);
          left: var(--asset-x, 12%);
          top: var(--asset-y, 12%);
          opacity: var(--asset-opacity, 0.72);
          color: var(--color-accent);
          transform: translate(-50%, -50%) rotate(var(--asset-rotate, 0deg));
          filter: drop-shadow(0 4px 14px color-mix(in srgb, var(--color-primary) 15%, transparent));
        }
        .generated-asset-decoration svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      `;
      document.head.appendChild(style);
    }

    const host = document.createElement('div');
    host.className = 'generated-asset-decorations';
    host.setAttribute('aria-hidden', 'true');

    decorations.forEach((decoration) => {
      const svg = assets?.[decoration.file];
      if (!svg) return;
      const item = document.createElement('span');
      item.className = 'generated-asset-decoration';
      item.style.setProperty('--asset-x', `${Number(decoration.x) || 12}%`);
      item.style.setProperty('--asset-y', `${Number(decoration.y) || 12}%`);
      item.style.setProperty('--asset-size', `${Math.max(24, Math.min(220, Number(decoration.size) || 76))}px`);
      item.style.setProperty('--asset-rotate', `${Math.max(-45, Math.min(45, Number(decoration.rotate) || 0))}deg`);
      item.style.setProperty('--asset-opacity', String(Math.max(0.12, Math.min(1, Number(decoration.opacity) || 0.72))));
      item.innerHTML = svg;
      host.appendChild(item);
    });

    if (host.children.length) {
      if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
      root.appendChild(host);
    }
  }

  function buildHelpers(models, versionKey) {
    const PC = window.PortfolioContent;
    const metadataDisplay = ['none', 'below', 'side', 'overlay'].includes(
      models.contentOverrides?.layoutOverrides?.[versionKey]?.metadataDisplay
    )
      ? models.contentOverrides.layoutOverrides[versionKey].metadataDisplay
      : 'none';
    const workByKey = new Map();
    const workByImage = new Map();
    (models.manifest?.collections || []).forEach((collection, fallbackCollectionIndex) => {
      const collectionIndex = collection.originalIndex ?? fallbackCollectionIndex;
      (collection.workItems || []).forEach((work, fallbackWorkIndex) => {
        const sourceCollectionIndex = work?.sourceCollectionIndex ?? collectionIndex;
        const sourceWorkIndex = work?.sourceWorkIndex ?? fallbackWorkIndex;
        workByKey.set(`${sourceCollectionIndex}:${sourceWorkIndex}`, work);
        (work?.images || []).forEach((imagePath) => workByImage.set(imagePath, work));
      });
    });

    function workMetadata(work, fallbackTitle) {
      if (!work) return null;
      const title = String(work.title || fallbackTitle || '').trim();
      const description = String(work.description || '').trim();
      const medium = String(work.medium || '').trim();
      const year = String(work.year || '').trim();
      const link = String(work.link || '').trim();
      if (!title && !description && !medium && !year && !link) return null;
      return { title, description, medium, year, link };
    }

    function safeMetadataHref(link) {
      return /^(https?:\/\/|mailto:)/i.test(String(link || '')) ? link : '';
    }

    function appendWorkMetadata(tile, metadata) {
      if (!metadata || metadataDisplay === 'none') return;
      const caption = document.createElement('figcaption');
      caption.className = `work-metadata work-metadata--${metadataDisplay}`;
      const hasBodyText = Boolean(metadata.description || metadata.medium || metadata.year || metadata.link);

      if (metadata.title && hasBodyText) {
        const title = document.createElement('strong');
        title.className = 'work-metadata-title';
        title.textContent = metadata.title;
        caption.appendChild(title);
      }
      if (metadata.description) {
        const desc = document.createElement('span');
        desc.className = 'work-metadata-description';
        desc.textContent = metadata.description;
        caption.appendChild(desc);
      }
      const details = [metadata.medium, metadata.year].filter(Boolean).join(' · ');
      if (details) {
        const detail = document.createElement('span');
        detail.className = 'work-metadata-detail';
        detail.textContent = details;
        caption.appendChild(detail);
      }
      if (metadata.link) {
        const href = safeMetadataHref(metadata.link);
        if (href) {
          const link = document.createElement('a');
          link.className = 'work-metadata-link';
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Link';
          caption.appendChild(link);
        }
      }
      if (caption.children.length) {
        tile.classList.add('has-work-metadata', `metadata-${metadataDisplay}`);
        tile.appendChild(caption);
      }
    }

    function portfolioTitle() {
      const placeholder = document.createElement('span');
      placeholder.hidden = true;
      placeholder.dataset.generatedShellTitle = 'true';
      return placeholder;
    }

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

    function collectionFrame(collection, collectionIndex, opts = {}) {
      const frame = document.createElement(opts.tagName || 'section');
      frame.className = ['generated-collection', opts.className || ''].filter(Boolean).join(' ');
      frame.dataset.collectionIndex = String(collectionIndex);
      frame.dataset.modelKind = 'collection';
      frame.dataset.modelPath = `collections.${collection.originalIndex ?? collectionIndex}`;
      frame.dataset.collectionId = `collection_${collection.originalIndex ?? collectionIndex}`;
      frame.dataset.modelLabel = collection.name;

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

      frame.appendChild(h2);
      return frame;
    }

    function workTile(imgPath, opts = {}) {
      const tile = document.createElement('div');
      tile.className = opts.className || 'generated-work-tile scroll-item';
      if (!tile.classList.contains('generated-work-tile')) {
        tile.classList.add('generated-work-tile');
      }
      if (opts.draggable !== false) tile.dataset.canvasDraggable = 'true';
      if (opts.fixedSize === true) {
        tile.dataset.fixedSize = 'true';
      } else {
        tile.style.setProperty('width', 'var(--space-artSize)');
        tile.style.setProperty('min-width', 'var(--space-artSize)');
        tile.style.setProperty('flex-basis', 'var(--space-artSize)');
      }
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
      const inferredWork = opts.work
        || workByImage.get(imgPath)
        || workByKey.get(`${opts.collectionIndex ?? 0}:${opts.workIndex ?? 0}`);
      appendWorkMetadata(tile, workMetadata(inferredWork, opts.label || opts.alt));
      return tile;
    }

    function inlineAsset(name, assets) {
      return assets[name] || '';
    }

    return { collectionSection, collectionFrame, workTile, inlineAsset, portfolioTitle };
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

  function bindGeneratedModelTargets(root) {
    root.querySelectorAll('[data-collection-index]').forEach((el) => {
      if (el.dataset.modelKind || el.dataset.workIndex != null) return;
      const ci = Number(el.dataset.collectionIndex);
      if (!Number.isFinite(ci)) return;
      el.dataset.modelKind = 'collection';
      el.dataset.modelPath = `collections.${ci}`;
      el.dataset.collectionId = `collection_${ci}`;
      const heading = el.querySelector('h1,h2,h3,h4,h5,h6');
      el.dataset.modelLabel = heading?.textContent?.trim() || `Collection ${ci + 1}`;
    });

    root.querySelectorAll('[data-canvas-draggable="true"], [data-work-index]').forEach((el) => {
      if (el.dataset.modelKind) return;
      const ci = Number(el.dataset.collectionIndex ?? 0);
      const wi = Number(el.dataset.workIndex ?? 0);
      if (!Number.isFinite(ci) || !Number.isFinite(wi)) return;
      el.dataset.modelKind = 'work';
      el.dataset.modelPath = `collections.${ci}.works.${wi}`;
      el.dataset.collectionIndex = String(ci);
      el.dataset.workIndex = String(wi);
      el.dataset.workId = `work_${ci}_${wi}`;
      const img = el.querySelector('img');
      el.dataset.modelLabel = img?.alt && img.alt !== 'artwork'
        ? img.alt
        : img?.src?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Artwork';
    });
  }

  function promoteCollectionTargetsToVisibleWrappers(root) {
    root.querySelectorAll('[data-model-kind="collection"]').forEach((section) => {
      const parent = section.parentElement;
      if (!parent || parent === root || parent.dataset.modelKind || parent.dataset.textId) return;
      const directCollectionChildren = Array.from(parent.children)
        .filter((child) => child.dataset?.modelKind === 'collection');
      if (directCollectionChildren.length !== 1 || directCollectionChildren[0] !== section) return;
      const hasVisibleWrapperStyling = parent.classList.length > 0 || parent.dataset.canvasDraggable === 'true';
      if (!hasVisibleWrapperStyling) return;

      ['collectionIndex', 'modelKind', 'modelPath', 'collectionId', 'modelLabel'].forEach((key) => {
        if (section.dataset[key] != null) parent.dataset[key] = section.dataset[key];
        delete section.dataset[key];
      });
      parent.classList.add('generated-collection');
      section.classList.remove('generated-collection');
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
      id: col.id || (window.PortfolioContent?.collectionId(col.originalIndex ?? index) ?? `collection_${index}`),
      originalIndex: col.originalIndex ?? index,
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

    const [assets, decorations] = await Promise.all([
      fetchSvgAssets(layoutKey),
      fetchDecorations(layoutKey),
    ]);
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
    const layoutOverrides = resolvedModels.contentOverrides?.layoutOverrides?.[layoutKey] || {};
    const displayOverride = layoutOverrides.collectionDisplay || '';
    const materialOverride = layoutOverrides.materialTexture || '';
    root.dataset.layoutOverride = displayOverride;
    root.dataset.materialTexture = materialOverride;
    root.dataset.metadataDisplay = layoutOverrides.metadataDisplay || 'none';
    root.classList.toggle('layout-override-grid', displayOverride === 'grid');
    root.classList.toggle('layout-override-horizontal', displayOverride === 'horizontal');
    root.classList.toggle('layout-override-vertical', displayOverride === 'vertical');
    ['textured', 'wood', 'paper', 'fabric', 'metal', 'glass'].forEach((texture) => {
      root.classList.toggle(`layout-material-${texture}`, materialOverride === texture);
    });
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
    mountDecorations(root, assets, decorations);

    bindGeneratedModelTargets(root);
    promoteCollectionTargetsToVisibleWrappers(root);
    bindGeneratedText(root, collections, resolvedModels, versionKey);

    root.querySelectorAll('.generated-collection[data-model-kind="collection"]').forEach((section) => {
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
    if (window.PortfolioDecorations) {
      PortfolioDecorations.mount(root, resolvedModels.contentOverrides, layoutKey);
    }
    if (window.PortfolioSocialPrototype) {
      PortfolioSocialPrototype.mount(root, {
        presentationId: layoutKey,
        mode: layoutOverrides.socialPrototype || 'none',
      });
    }

    if (document.body.dataset.editMode) {
      bindCanvasDrag(root);
    }

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
