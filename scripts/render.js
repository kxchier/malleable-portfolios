/** Jelly-style rule-based renderer for Walo presentation models. */
window.PortfolioRender = (() => {
  function appendImage(parent, imgPath, tileClass, draggable) {
    const item = document.createElement('div');
    item.className = tileClass;
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

  function appendClotheslinePiece(parent, imgPath, index) {
    const piece = document.createElement('div');
    piece.className = 'clothesline-piece';
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
    wire.innerHTML = '<path d="M0 4 Q50 10 100 4" />';

    const items = document.createElement('div');
    items.className = 'clothesline-items';

    collection.images.forEach((img, index) => {
      appendClotheslinePiece(items, img, index);
    });

    rig.append(wire, items);
    scroll.appendChild(rig);
    section.appendChild(scroll);

    requestAnimationFrame(() => layoutClotheslineRig(rig));
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => layoutClotheslineRig(rig));
      observer.observe(items);
      observer.observe(scroll);
    }
  }

  function renderWorkContainer(section, collection, presentation) {
    const engine = presentation.layout_engine?.work_container || 'css_grid';
    const component = PortfolioComponents.workContainerForEngine(engine);
    if (!component) return;

    if (engine === 'desk_surface') {
      const surface = document.createElement('div');
      surface.className = component.containerClass;
      section.appendChild(surface);
      requestAnimationFrame(() => {
        if (typeof layoutDeskSurface === 'function') {
          layoutDeskSurface(surface, collection.images);
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
    collection.images.forEach((img) => {
      appendImage(container, img, component.tileClass, draggable);
    });
    section.appendChild(container);
  }

  function renderCollectionSection(root, collection, presentation) {
    const section = document.createElement('section');
    const sectionClass = PortfolioComponents.sectionClassForPresentation(presentation.id);
    if (sectionClass) section.className = sectionClass;

    section.appendChild(buildCollectionHeading(collection, presentation.id));
    renderWorkContainer(section, collection, presentation);
    root.appendChild(section);
  }

  function renderCollections(root, collections, models) {
    const { presentation, manifest, theme, contentOverrides } = models;
    root.innerHTML = '';

    collections.forEach((collection) => {
      renderCollectionSection(root, collection, presentation);
    });

    if (window.PortfolioContent) {
      PortfolioContent.applyPageText(manifest, theme, contentOverrides, presentation.id);
    }
  }

  function insertOrganizationControls(root, models, onChange) {
    if (!window.PortfolioOrganization) {
      onChange(
        models.manifest.collections.map((col, index) => ({
          id: PortfolioContent.collectionId(index),
          originalIndex: index,
          ...col,
        }))
      );
      return;
    }

    const parent = root.parentNode;
    const existing = parent.querySelector('.organization-controls');
    if (existing) existing.remove();

    const modes = models.presentation.encounter?.organization_modes;
    if (!modes || modes.length === 0) {
      onChange(
        models.manifest.collections.map((col, index) => ({
          id: PortfolioContent.collectionId(index),
          originalIndex: index,
          ...col,
        }))
      );
      return;
    }

    const controls = PortfolioOrganization.createControls({
      manifest: models.manifest,
      content: models.contentOverrides,
      onChange,
    });
    parent.insertBefore(controls, root);
  }

  async function mount({ root, presentationId, models: providedModels, previewState }) {
    const models = providedModels || await PortfolioModels.load(presentationId, {
      theme: previewState?.theme,
      contentOverrides: previewState?.content,
      contentModel: previewState?.contentModel,
    });

    const render = (collections) => renderCollections(root, collections, models);
    insertOrganizationControls(root, models, render);
  }

  return {
    mount,
    renderCollections,
    renderCollectionSection,
  };
})();
