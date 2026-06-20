/** Component types for Walo presentation rendering and future scoped editing. */
window.PortfolioComponents = (() => {
  const REGISTRY = {
    portfolio_header: {
      role: 'heading',
      textRole: 'portfolio.title',
      textId: 'portfolio.title',
      editable: ['content', 'font', 'size'],
      defaultScope: { content: 'instance', style: 'layout' },
    },
    organization_controls: {
      role: 'chrome',
      editable: [],
    },
    collection_section: {
      role: 'section',
      editable: ['title'],
      defaultScope: { content: 'instance' },
    },
    image_grid: {
      role: 'image',
      containerClass: 'grid-view',
      tileClass: 'grid-item',
      editable: ['caption', 'border'],
      defaultScope: { style: 'type' },
    },
    horizontal_strip: {
      role: 'image',
      containerClass: 'images-scroll',
      tileClass: 'scroll-item',
      sectionClass: 'collection-strip',
      editable: ['caption'],
      defaultScope: { style: 'layout' },
    },
    desk_surface: {
      role: 'surface',
      containerClass: 'desk-surface',
      tileClass: 'desk-item',
      sectionClass: 'desk-collection',
      titleClass: 'desk-title',
      editable: ['color', 'position'],
      defaultScope: { style: 'layout' },
    },
    draggable_tile: {
      role: 'image',
      tileClass: 'desk-item',
      draggable: false,
      editable: ['rotation', 'position'],
      defaultScope: { style: 'instance' },
    },
  };

  function get(type) {
    return REGISTRY[type] || null;
  }

  function titleClassForPresentation(presentationId) {
    if (presentationId === 'clothesline') return 'strip-title';
    if (presentationId === 'desk') return 'desk-title';
    return '';
  }

  function sectionClassForPresentation(presentationId) {
    const strip = get('horizontal_strip');
    const desk = get('desk_surface');
    if (presentationId === 'clothesline') return strip.sectionClass;
    if (presentationId === 'desk') return desk.sectionClass;
    return '';
  }

  function workContainerForEngine(engine) {
    if (engine === 'css_grid') return get('image_grid');
    if (engine === 'horizontal_scroll') return get('horizontal_strip');
    if (engine === 'desk_surface') return get('desk_surface');
    return get('image_grid');
  }

  return {
    REGISTRY,
    get,
    titleClassForPresentation,
    sectionClassForPresentation,
    workContainerForEngine,
  };
})();
