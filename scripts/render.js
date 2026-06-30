/** Jelly-style rule-based renderer for Walo presentation models. */
window.PortfolioRender = (() => {
  function modelPath(kind, collectionIndex, workIndex = null) {
    if (kind === 'collection') return `collections.${collectionIndex}`;
    if (kind === 'work') return `collections.${collectionIndex}.works.${workIndex}`;
    return kind;
  }

  function bindModelTarget(el, target) {
    if (!el || !target) return el;
    Object.entries(target).forEach(([key, value]) => {
      if (value != null) el.dataset[key] = String(value);
    });
    return el;
  }

  function appendImage(parent, imgPath, tileClass, draggable, target = {}) {
    const item = document.createElement('div');
    item.className = tileClass;
    bindModelTarget(item, {
      modelKind: 'work',
      modelPath: modelPath('work', target.collectionIndex, target.workIndex),
      collectionIndex: target.collectionIndex,
      workIndex: target.workIndex,
      workId: target.workId,
      modelLabel: target.label || imageBasename(imgPath),
    });
    const image = document.createElement('img');
    image.src = imgPath;
    image.alt = 'artwork';
    image.onerror = () => image.remove();
    if (draggable === false) image.draggable = false;
    item.appendChild(image);
    parent.appendChild(item);
  }

  function buildCollectionHeading(collection, presentationId) {
    const h2 = document.createElement('h2');
    const titleClass = PortfolioComponents.titleClassForPresentation(presentationId);
    if (titleClass) h2.className = titleClass;

    if (collection.originalIndex == null) {
      h2.textContent = collection.name;
      return h2;
    }

    const cid = PortfolioContent.collectionId(collection.originalIndex);
    h2.dataset.textId = cid;
    h2.dataset.textRole = 'collection.title';
    h2.dataset.textFallback = collection.name;
    return h2;
  }

  function clotheslineClipMarkup() {
    return `<svg class="clothesline-clip-svg" viewBox="0 0 24 37" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path class="clothesline-clip-spring-coil" d="M6 4.5c0-2 4-2.5 6-2.5s6 0.5 6 2.5c1.2 1.8 1.2 4.2 0 6-1.8 1.2-4.2 1.2-6 0-1.2-1.8-1.2-4.2 0-6z" fill="none" stroke="#6e6860" stroke-width="1.35" stroke-linecap="round"/>
      <rect class="clothesline-clip-spring-band" x="8.5" y="2" width="7" height="2.2" rx="0.8" fill="#a8a298" stroke="#5e5850" stroke-width="0.45"/>
      <path class="clothesline-clip-wood clothesline-clip-wood--left" d="M5.5 9.5 3.2 36.5c0 1.2 3.2 2.2 8.3 1.2L12 9.5Z" fill="#e8c08a" stroke="#8f6028" stroke-width="0.55" stroke-linejoin="round"/>
      <path class="clothesline-clip-wood clothesline-clip-wood--right" d="M18.5 9.5 20.8 36.5c0 1.2-3.2 2.2-8.3 1.2L12 9.5Z" fill="#c4893f" stroke="#8f6028" stroke-width="0.55" stroke-linejoin="round"/>
      <path d="M6.5 14v18M7.8 16v14" stroke="#a06c30" stroke-width="0.35" stroke-linecap="round" opacity="0.45"/>
      <path d="M17.5 14v18M16.2 16v14" stroke="#8f6020" stroke-width="0.35" stroke-linecap="round" opacity="0.4"/>
    </svg>`;
  }

  function appendClotheslinePiece(parent, imgPath, index, collection) {
    const piece = document.createElement('div');
    piece.className = 'clothesline-piece';
    bindModelTarget(piece, {
      modelKind: 'work',
      modelPath: modelPath('work', collection.originalIndex, index),
      collectionIndex: collection.originalIndex,
      workIndex: index,
      workId: `work_${collection.originalIndex}_${index}`,
      modelLabel: imageBasename(imgPath),
    });
    const tilt = (index % 2 === 0 ? -1 : 1) * (2 + (index % 3));
    piece.style.setProperty('--clothesline-tilt', `${tilt}deg`);

    const hanger = document.createElement('div');
    hanger.className = 'clothesline-hanger';

    const string = document.createElement('span');
    string.className = 'clothesline-string';
    string.setAttribute('aria-hidden', 'true');

    const suspend = document.createElement('div');
    suspend.className = 'clothesline-suspend';

    const clip = document.createElement('div');
    clip.className = 'clothesline-clip';
    clip.setAttribute('aria-hidden', 'true');
    clip.innerHTML = clotheslineClipMarkup();

    const item = document.createElement('div');
    item.className = 'scroll-item';
    const image = document.createElement('img');
    image.src = imgPath;
    image.alt = 'artwork';
    image.onerror = () => image.remove();
    item.appendChild(image);

    suspend.append(string, clip, item);
    hanger.appendChild(suspend);
    piece.appendChild(hanger);
    parent.appendChild(piece);
  }

  function folderIconMarkup() {
    return `<svg class="directory-icon directory-icon--folder" viewBox="0 0 16 14" aria-hidden="true">
      <path d="M1 3.25A1.75 1.75 0 0 1 2.75 1.5h3.35l1.4 1.4h5.5A1.75 1.75 0 0 1 14.75 4.65v8.1A1.75 1.75 0 0 1 13 14.5H3A1.75 1.75 0 0 1 1.25 12.75V3.25Z" fill="currentColor"/>
    </svg>`;
  }

  function fileIconMarkup() {
    return `<svg class="directory-icon directory-icon--file" viewBox="0 0 14 16" aria-hidden="true">
      <path d="M3.25.75h5.5l3.5 3.5v10.5a.75.75 0 0 1-.75.75H3.25a.75.75 0 0 1-.75-.75V1.5a.75.75 0 0 1 .75-.75Z" fill="var(--color-paper)" stroke="currentColor" stroke-width="1.1"/>
      <path d="M8.75.75v3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.1"/>
    </svg>`;
  }

  function imageBasename(imgPath) {
    const name = String(imgPath || '').split('/').pop() || 'untitled';
    return name.replace(/\.[^.]+$/, '');
  }

  function buildDirectoryFolderLabel(collection, presentationId) {
    const label = buildCollectionHeading(collection, presentationId);
    label.className = 'directory-folder-label';
    return label;
  }

  function directoryWorkTarget(collection, workIndex, imgPath, fileLabel) {
    return {
      modelKind: 'work',
      modelPath: modelPath('work', collection.originalIndex, workIndex),
      collectionIndex: collection.originalIndex,
      workIndex,
      workId: `work_${collection.originalIndex}_${workIndex}`,
      modelLabel: fileLabel || imageBasename(imgPath),
    };
  }

  function selectDirectoryFile(browser, fileButton, imgPath, fileLabel, collectionName, target = {}) {
    browser.querySelectorAll('.directory-file').forEach((btn) => {
      btn.classList.toggle('is-selected', btn === fileButton);
      btn.setAttribute('aria-selected', btn === fileButton ? 'true' : 'false');
    });

    const viewer = browser.querySelector('.directory-viewer');
    const preview = browser.querySelector('.directory-preview');
    const previewImg = browser.querySelector('.directory-preview img');
    const title = browser.querySelector('.directory-file-title');
    const collectionLabel = browser.querySelector('.directory-collection-label');
    [viewer, preview, previewImg, title].forEach((el) => bindModelTarget(el, target));
    if (previewImg) {
      previewImg.src = imgPath;
      previewImg.alt = fileLabel;
    }
    if (title) title.textContent = fileLabel;
    if (collectionLabel) collectionLabel.textContent = collectionName;
  }

  function renderDirectoryBrowser(root, collections, presentation) {
    const browser = document.createElement('div');
    browser.className = 'directory-browser';

    const tree = document.createElement('aside');
    tree.className = 'directory-tree';
    tree.setAttribute('aria-label', 'Collections');

    const treeList = document.createElement('ul');
    treeList.className = 'directory-root';
    treeList.setAttribute('role', 'tree');

    let firstFileButton = null;
    let firstSelection = null;

    collections.forEach((collection) => {
      if (!collection.images?.length) return;

      const folderItem = document.createElement('li');
      folderItem.className = 'directory-folder';
      folderItem.setAttribute('role', 'treeitem');
      folderItem.setAttribute('aria-expanded', 'true');

      const folderRow = document.createElement('div');
      folderRow.className = 'directory-folder-row';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'directory-folder-toggle';
      toggle.setAttribute('aria-label', `Toggle ${collection.name}`);
      toggle.innerHTML = folderIconMarkup();

      toggle.addEventListener('click', () => {
        const expanded = folderItem.getAttribute('aria-expanded') !== 'true';
        folderItem.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        folderItem.classList.toggle('is-collapsed', !expanded);
      });

      folderRow.append(toggle, buildDirectoryFolderLabel(collection, presentation.id));

      const fileList = document.createElement('ul');
      fileList.className = 'directory-files';
      fileList.setAttribute('role', 'group');

      collection.images.forEach((imgPath, workIndex) => {
        const fileItem = document.createElement('li');
        fileItem.className = 'directory-file-item';
        fileItem.setAttribute('role', 'none');

        const fileButton = document.createElement('button');
        fileButton.type = 'button';
        fileButton.className = 'directory-file';
        fileButton.setAttribute('role', 'treeitem');
        fileButton.setAttribute('aria-selected', 'false');
        const fileLabel = imageBasename(imgPath);
        const target = directoryWorkTarget(collection, workIndex, imgPath, fileLabel);
        bindModelTarget(fileButton, {
          ...target,
        });
        fileButton.innerHTML = fileIconMarkup();
        const nameSpan = document.createElement('span');
        nameSpan.className = 'directory-file-name';
        nameSpan.textContent = fileLabel;
        fileButton.appendChild(nameSpan);

        fileButton.addEventListener('click', () => {
          selectDirectoryFile(browser, fileButton, imgPath, fileLabel, collection.name, target);
        });

        fileItem.appendChild(fileButton);
        fileList.appendChild(fileItem);

        if (!firstFileButton) {
          firstFileButton = fileButton;
          firstSelection = { imgPath, fileLabel, collectionName: collection.name, target };
        }
      });

      folderItem.append(folderRow, fileList);
      treeList.appendChild(folderItem);
    });

    tree.appendChild(treeList);

    const viewer = document.createElement('section');
    viewer.className = 'directory-viewer';
    viewer.setAttribute('aria-label', 'Preview');

    const preview = document.createElement('div');
    preview.className = 'directory-preview';
    const image = document.createElement('img');
    image.alt = 'artwork';
    image.draggable = false;
    image.onerror = () => image.remove();
    preview.appendChild(image);

    const meta = document.createElement('div');
    meta.className = 'directory-meta';

    const fileTitle = document.createElement('h2');
    fileTitle.className = 'directory-file-title directory-title';
    const collectionLabel = document.createElement('p');
    collectionLabel.className = 'directory-collection-label';

    meta.append(fileTitle, collectionLabel);
    viewer.append(preview, meta);
    browser.append(tree, viewer);
    root.appendChild(browser);

    if (firstFileButton && firstSelection) {
      selectDirectoryFile(
        browser,
        firstFileButton,
        firstSelection.imgPath,
        firstSelection.fileLabel,
        firstSelection.collectionName,
        firstSelection.target
      );
    }

    layoutDirectoryViewport();
  }

  let directoryFrameObserver = null;
  let directoryFrameRaf = 0;

  function layoutDirectoryViewport() {
    if (!document.body.classList.contains('view-directory')) return;

    const browser = document.querySelector('.directory-browser');
    const content = document.getElementById('preview-content') || document.getElementById('content');
    if (!browser || !content) return;

    const apply = () => {
      const frame = window.frameElement;
      const docHeight = frame && frame.clientHeight > 0 ? frame.clientHeight : window.innerHeight;

      document.documentElement.style.height = `${docHeight}px`;
      document.body.style.height = `${docHeight}px`;

      const contentTop = content.getBoundingClientRect().top;
      const container = content.closest('.container');
      const padBottom = container
        ? parseFloat(getComputedStyle(container).paddingBottom) || 0
        : 0;
      const available = Math.floor(docHeight - contentTop - padBottom);

      if (available > 120) {
        content.style.height = `${available}px`;
        content.style.maxHeight = `${available}px`;
        browser.style.height = `${available}px`;
        browser.style.maxHeight = `${available}px`;
      }
    };

    apply();
    requestAnimationFrame(apply);
    window.setTimeout(apply, 60);

    const frame = window.frameElement;
    if (frame && typeof ResizeObserver !== 'undefined') {
      if (!directoryFrameObserver) {
        directoryFrameObserver = new ResizeObserver(() => {
          if (directoryFrameRaf) return;
          directoryFrameRaf = requestAnimationFrame(() => {
            directoryFrameRaf = 0;
            layoutDirectoryViewport();
          });
        });
      }
      directoryFrameObserver.disconnect();
      directoryFrameObserver.observe(frame);
    }
  }

  function layoutClotheslineRig(rig) {
    const wire = rig.querySelector('.clothesline-wire');
    const items = rig.querySelector('.clothesline-items');
    if (!wire || !items) return;
    const width = Math.max(items.scrollWidth, rig.clientWidth);
    wire.setAttribute('width', String(width));
    wire.style.width = `${width}px`;
  }

  function renderClotheslineContainer(section, collection) {
    const scroll = document.createElement('div');
    scroll.className = 'images-scroll clothesline-scroll';

    const rig = document.createElement('div');
    rig.className = 'clothesline-rig';

    const wire = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wire.setAttribute('class', 'clothesline-wire');
    wire.setAttribute('viewBox', '0 0 100 12');
    wire.setAttribute('preserveAspectRatio', 'none');
    wire.setAttribute('aria-hidden', 'true');
    wire.innerHTML = '<path d="M0 5 Q25 11 50 6 T100 5" /><path d="M0 5 Q25 11 50 6 T100 5" stroke-width="1.2" opacity="0.35" transform="translate(0,2)" />';

    const items = document.createElement('div');
    items.className = 'clothesline-items';

    collection.images.forEach((img, index) => {
      appendClotheslinePiece(items, img, index, collection);
    });

    rig.append(wire, items);
    scroll.appendChild(rig);
    section.appendChild(scroll);

    requestAnimationFrame(() => layoutClotheslineRig(rig));
    if (typeof ResizeObserver !== 'undefined') {
      let clotheslineRaf = 0;
      const observer = new ResizeObserver(() => {
        if (clotheslineRaf) return;
        clotheslineRaf = requestAnimationFrame(() => {
          clotheslineRaf = 0;
          layoutClotheslineRig(rig);
        });
      });
      observer.observe(items);
      observer.observe(scroll);
    }
  }

  function renderWorkContainer(section, collection, presentation) {
    const engine = presentation.layout_engine?.work_container || 'css_grid';
    const component = PortfolioComponents.workContainerForEngine(engine);
    if (!component) return;

    if (engine === 'desk_surface') {
      const scene = document.createElement('div');
      scene.className = 'desk-scene';
      const surface = document.createElement('div');
      surface.className = component.containerClass;
      scene.appendChild(surface);
      section.appendChild(scene);
      requestAnimationFrame(() => {
        if (typeof layoutDeskSurface === 'function') {
          layoutDeskSurface(surface, collection.images);
          surface.querySelectorAll('.desk-item').forEach((item, index) => {
            const img = collection.images[index];
            bindModelTarget(item, {
              modelKind: 'work',
              modelPath: modelPath('work', collection.originalIndex, index),
              collectionIndex: collection.originalIndex,
              workIndex: index,
              workId: `work_${collection.originalIndex}_${index}`,
              modelLabel: imageBasename(img),
            });
          });
        }
      });
      return;
    }

    if (presentation.id === 'clothesline' || presentation.metaphor === 'clothesline') {
      renderClotheslineContainer(section, collection);
      return;
    }

    const container = document.createElement('div');
    container.className = component.containerClass;
    const draggable = component.draggable !== false ? undefined : false;
    collection.images.forEach((img, index) => {
      appendImage(container, img, component.tileClass, draggable, {
        collectionIndex: collection.originalIndex,
        workIndex: index,
        workId: `work_${collection.originalIndex}_${index}`,
        label: imageBasename(img),
      });
    });
    section.appendChild(container);
  }

  function renderCollectionSection(root, collection, presentation) {
    const section = document.createElement('section');
    const sectionClass = PortfolioComponents.sectionClassForPresentation(presentation.id);
    if (sectionClass) section.className = sectionClass;
    bindModelTarget(section, {
      modelKind: 'collection',
      modelPath: modelPath('collection', collection.originalIndex),
      collectionIndex: collection.originalIndex,
      collectionId: `collection_${collection.originalIndex}`,
      modelLabel: collection.name,
    });

    section.appendChild(buildCollectionHeading(collection, presentation.id));
    renderWorkContainer(section, collection, presentation);
    root.appendChild(section);
  }

  function isDirectoryPresentation(presentation) {
    return presentation.id === 'directory' || presentation.metaphor === 'file_browser';
  }

  function setDirectoryViewActive(active) {
    document.documentElement.classList.toggle('view-directory', active);
    document.body.classList.toggle('view-directory', active);
  }

  function renderCollections(root, collections, models) {
    const { presentation, manifest, theme, contentOverrides } = models;
    root.innerHTML = '';
    bindModelTarget(root, {
      modelKind: 'presentation',
      modelPath: `presentations.${presentation.id}`,
      presentationId: presentation.id,
      modelLabel: `${presentation.id} presentation`,
    });

    const visibleCollections = collections.filter((collection) => {
      const id = PortfolioContent.collectionId(collection.originalIndex);
      const hiddenIn = contentOverrides?.visibility?.collections?.[id]?.hiddenIn || [];
      return !hiddenIn.includes(presentation.id);
    });

    if (isDirectoryPresentation(presentation)) {
      setDirectoryViewActive(true);
      renderDirectoryBrowser(root, visibleCollections, presentation);
    } else {
      setDirectoryViewActive(false);
      visibleCollections.forEach((collection) => {
        renderCollectionSection(root, collection, presentation);
      });
    }

    if (window.PortfolioContent) {
      PortfolioContent.applyPageText(manifest, theme, contentOverrides, presentation.id);
    }
  }

  function allCollections(manifest) {
    return manifest.collections.map((col, index) => ({
      id: PortfolioContent.collectionId(index),
      originalIndex: index,
      ...col,
    }));
  }

  async function mount({ root, presentationId, models: providedModels, previewState }) {
    const models = providedModels || await PortfolioModels.load(presentationId, {
      theme: previewState?.theme,
      contentOverrides: previewState?.content,
      contentModel: previewState?.contentModel,
    });

    document.body.classList.remove('view-grid', 'view-clothesline', 'view-desk', 'view-directory');
    document.documentElement.classList.remove('view-directory');
    document.body.classList.add(`view-${presentationId}`);
    if (presentationId === 'directory') {
      document.documentElement.classList.add('view-directory');
    }

    const render = (collections) => renderCollections(root, collections, models);
    render(allCollections(models.manifest));
  }

  return {
    mount,
    renderCollections,
    renderCollectionSection,
    renderDirectoryBrowser,
    layoutDirectoryViewport,
  };
})();
