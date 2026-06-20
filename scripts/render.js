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
