window.PublicLayoutRuntime = (() => {
  function register(layout) {
    if (!layout?.key || !layout.publicSpec) return;
    window.GeneratedLayouts = window.GeneratedLayouts || {};
    window.GeneratedLayouts[layout.key] = {
      async mount(root, { collections, helpers }) {
        root.className = `public-layout public-layout--${layout.publicSpec.composition}`;
        collections.forEach((collection, collectionIndex) => {
          const section = helpers.collectionFrame(collection, collectionIndex, { className: 'public-layout-section' });
          if (layout.publicSpec.showCollectionNumbers) {
            const number = document.createElement('span');
            number.className = 'public-layout-number';
            number.textContent = String(collectionIndex + 1).padStart(2, '0');
            section.prepend(number);
          }
          const works = document.createElement('div');
          works.className = 'public-layout-works';
          (collection.images || []).forEach((image, workIndex) => {
            works.appendChild(helpers.workTile(image, {
              collectionIndex,
              workIndex,
              work: collection.workItems?.[workIndex],
              label: collection.workItems?.[workIndex]?.title,
              className: 'generated-work-tile public-layout-card',
              fixedSize: layout.publicSpec.composition === 'masonry',
            }));
          });
          section.appendChild(works);
          root.appendChild(section);
        });
      },
    };
  }

  register(window.__PUBLIC_LAYOUT__);
  return { register };
})();
