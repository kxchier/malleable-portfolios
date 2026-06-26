
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['zine_rack'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    root.classList.add('zr-root');

    // state: which spread is open
    let openIndex = null;
    const spreadPanels = [];

    collections.forEach((col, ci) => {
      const sectionRow = document.createElement('div');
      sectionRow.className = 'zr-section-row';

      // Rack shelf row
      const shelf = document.createElement('div');
      shelf.className = 'zr-rack-shelf';
      shelf.setAttribute('role', 'list');
      shelf.setAttribute('aria-label', col.name + ' rack');

      const rackLabel = document.createElement('span');
      rackLabel.className = 'zr-rack-label';
      rackLabel.setAttribute('data-text-id', 'collection-' + col.originalIndex + '-title');
      rackLabel.setAttribute('data-text-role', 'collection-title');
      rackLabel.setAttribute('data-text-fallback', col.name);
      rackLabel.textContent = col.name;
      shelf.appendChild(rackLabel);

      col.images.forEach((img, wi) => {
        const spineWrap = document.createElement('div');
        spineWrap.className = 'zr-spine-wrap';
        spineWrap.setAttribute('role', 'listitem');
        spineWrap.setAttribute('tabindex', '0');
        spineWrap.setAttribute('aria-label', 'Open work ' + (wi + 1) + ' in ' + col.name);
        spineWrap.dataset.collectionIndex = String(col.originalIndex);
        spineWrap.dataset.workIndex = String(wi);

        const spine = document.createElement('div');
        spine.className = 'zr-spine';

        const thumb = document.createElement('img');
        thumb.src = img;
        thumb.alt = 'Artwork ' + (wi + 1);
        thumb.className = 'zr-spine-thumb';
        thumb.setAttribute('loading', 'lazy');
        spine.appendChild(thumb);

        const title = document.createElement('div');
        title.className = 'zr-spine-title';
        title.textContent = col.name.split('/').pop().trim() + ' ' + String(wi + 1).padStart(2, '0');
        spine.appendChild(title);

        spineWrap.appendChild(spine);
        shelf.appendChild(spineWrap);

        spineWrap.addEventListener('click', () => {
          openSpread(ci, wi);
        });
        spineWrap.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpread(ci, wi); }
        });
      });

      sectionRow.appendChild(shelf);

      // Spread panel (hidden until a spine is clicked)
      const spreadPanel = document.createElement('div');
      spreadPanel.className = 'zr-spread-panel';
      spreadPanel.setAttribute('aria-live', 'polite');

      const spreadHeader = document.createElement('div');
      spreadHeader.className = 'zr-spread-header';

      const h2 = document.createElement('h2');
      h2.setAttribute('data-text-id', 'collection-' + col.originalIndex + '-title');
      h2.setAttribute('data-text-role', 'collection-title');
      h2.setAttribute('data-text-fallback', col.name);
      h2.textContent = col.name;
      spreadHeader.appendChild(h2);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'zr-close-btn';
      closeBtn.setAttribute('aria-label', 'Close spread');
      closeBtn.innerHTML = assets['close-icon.svg'] || '&#215;';
      closeBtn.addEventListener('click', () => {
        closeSpread(ci);
      });
      spreadHeader.appendChild(closeBtn);
      spreadPanel.appendChild(spreadHeader);

      const pagesScroll = document.createElement('div');
      pagesScroll.className = 'zr-pages-scroll';

      col.images.forEach((img, wi) => {
        const page = helpers.workTile(img, {
          className: 'zr-page-mat',
          alt: 'Artwork ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi
        });
        const pageWrap = document.createElement('div');
        pageWrap.className = 'zr-page';
        pageWrap.appendChild(page);

        const pageNum = document.createElement('div');
        pageNum.className = 'zr-page-num';
        pageNum.textContent = String(wi + 1).padStart(2, '0');
        pageWrap.appendChild(pageNum);

        pagesScroll.appendChild(pageWrap);
      });

      spreadPanel.appendChild(pagesScroll);
      sectionRow.appendChild(spreadPanel);
      spreadPanels.push({ panel: spreadPanel, shelf });

      root.appendChild(sectionRow);
    });

    function openSpread(ci, focusWi) {
      // Close previous
      if (openIndex !== null && openIndex !== ci) {
        closeSpread(openIndex);
      }
      openIndex = ci;
      const { panel, shelf } = spreadPanels[ci];
      panel.classList.add('zr-open');

      // Highlight active spine
      const spines = shelf.querySelectorAll('.zr-spine-wrap');
      spines.forEach((s, i) => {
        s.classList.toggle('zr-active', i === focusWi);
      });

      // Scroll to focused work
      if (focusWi !== null) {
        const pages = panel.querySelectorAll('.zr-page');
        if (pages[focusWi]) {
          setTimeout(() => {
            pages[focusWi].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }, 50);
        }
      }
    }

    function closeSpread(ci) {
      const { panel, shelf } = spreadPanels[ci];
      panel.classList.remove('zr-open');
      shelf.querySelectorAll('.zr-spine-wrap').forEach(s => s.classList.remove('zr-active'));
      if (openIndex === ci) openIndex = null;
    }
  }
};
