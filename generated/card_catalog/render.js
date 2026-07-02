
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['card_catalog'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    // Root wrapper
    const ccRoot = document.createElement('div');
    ccRoot.className = 'cc-root';

    // Nameplate
    const nameplate = document.createElement('div');
    nameplate.className = 'cc-nameplate';
    const titleEl = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (titleEl) {
      titleEl.querySelector('h1,h2,[data-text-id]') && nameplate.appendChild(titleEl);
    } else {
      const h1 = document.createElement('h1');
      h1.setAttribute('data-text-id', 'portfolio-title');
      h1.setAttribute('data-text-role', 'portfolio-title');
      h1.setAttribute('data-text-fallback', 'Portfolio Archive');
      h1.textContent = 'Portfolio Archive';
      nameplate.appendChild(h1);
    }
    const subtitle = document.createElement('div');
    subtitle.className = 'cc-subtitle';
    subtitle.textContent = 'REFERENCE COLLECTION';
    nameplate.appendChild(subtitle);
    ccRoot.appendChild(nameplate);

    // Cabinet
    const cabinet = document.createElement('div');
    cabinet.className = 'cc-cabinet';

    const cabTopLabel = document.createElement('div');
    cabTopLabel.className = 'cc-cabinet-top-label';
    cabTopLabel.textContent = 'CARD CATALOG';
    cabinet.appendChild(cabTopLabel);

    // Clip SVG asset
    const clipSVG = assets && assets['clip.svg'] ? assets['clip.svg'] : null;

    collections.forEach((col, ci) => {
      const drawerEl = document.createElement('div');
      drawerEl.className = 'cc-drawer';
      drawerEl.dataset.ci = ci;

      // Drawer face (clickable header)
      const face = document.createElement('div');
      face.className = 'cc-drawer-face';
      face.setAttribute('role', 'button');
      face.setAttribute('aria-expanded', 'false');
      face.setAttribute('tabindex', '0');

      // Drawer number badge
      const numBadge = document.createElement('div');
      numBadge.className = 'cc-drawer-number';
      numBadge.textContent = String(ci + 1).padStart(2, '0');
      face.appendChild(numBadge);

      // Brass pull
      const pull = document.createElement('div');
      pull.className = 'cc-brass-pull';
      face.appendChild(pull);

      // Label slot
      const labelSlot = document.createElement('div');
      labelSlot.className = 'cc-label-slot';
      const labelCard = document.createElement('div');
      labelCard.className = 'cc-label-card';

      // Use collectionSection helper to get editable h2, then extract it
      const colSection = helpers.collectionSection(col, ci);
      const h2 = colSection.querySelector('h2') || colSection;
      h2.className = '';
      // Rebuild inside label-card
      const labelH2 = document.createElement('h2');
      labelH2.setAttribute('data-text-id', h2.getAttribute('data-text-id') || ('col-title-' + col.originalIndex));
      labelH2.setAttribute('data-text-role', h2.getAttribute('data-text-role') || 'collection-title');
      labelH2.setAttribute('data-text-fallback', col.name || 'Collection');
      labelH2.setAttribute('data-collection-index', col.originalIndex);
      labelH2.textContent = col.name || 'Collection';
      labelCard.appendChild(labelH2);

      const labelMeta = document.createElement('div');
      labelMeta.className = 'cc-label-meta';
      labelMeta.textContent = col.images.length + ' ITEM' + (col.images.length !== 1 ? 'S' : '');
      labelCard.appendChild(labelMeta);
      labelSlot.appendChild(labelCard);
      face.appendChild(labelSlot);

      // Arrow
      const arrow = document.createElement('div');
      arrow.className = 'cc-drawer-arrow';
      arrow.textContent = '▼';
      face.appendChild(arrow);

      drawerEl.appendChild(face);

      // Drawer contents
      const contents = document.createElement('div');
      contents.className = 'cc-drawer-contents';

      // Folders rail
      const rail = document.createElement('div');
      rail.className = 'cc-folders-rail';
      rail.style.position = 'relative';

      // Artwork spread panel
      const spread = document.createElement('div');
      spread.className = 'cc-artwork-spread';
      const spreadInner = document.createElement('div');
      spreadInner.className = 'cc-spread-inner';
      spread.appendChild(spreadInner);

      let activeFolder = -1;

      col.images.forEach((imgPath, wi) => {
        const folderTab = document.createElement('div');
        folderTab.className = 'cc-folder-tab';
        folderTab.dataset.wi = wi;

        const tabHead = document.createElement('div');
        tabHead.className = 'cc-tab-head';
        const tabLabel = document.createElement('span');
        tabLabel.textContent = '#' + String(wi + 1).padStart(2, '0');
        const tabNum = document.createElement('span');
        tabNum.className = 'cc-tab-num';
        tabNum.textContent = col.name ? col.name.substring(0, 8).toUpperCase() : 'WORK';
        tabHead.appendChild(tabLabel);
        tabHead.appendChild(tabNum);
        folderTab.appendChild(tabHead);

        const folderBody = document.createElement('div');
        folderBody.className = 'cc-folder-body';
        folderTab.appendChild(folderBody);

        folderTab.setAttribute('role', 'button');
        folderTab.setAttribute('tabindex', '0');
        folderTab.setAttribute('aria-label', 'Open work ' + (wi + 1));

        folderTab.addEventListener('click', (e) => {
          e.stopPropagation();
          if (activeFolder === wi) {
            // Close
            activeFolder = -1;
            folderTab.classList.remove('is-active');
            spreadInner.innerHTML = '';
            spread.classList.remove('is-visible');
          } else {
            // Deactivate previous
            rail.querySelectorAll('.cc-folder-tab').forEach(ft => ft.classList.remove('is-active'));
            activeFolder = wi;
            folderTab.classList.add('is-active');
            // Populate spread
            spreadInner.innerHTML = '';
            const tile = helpers.workTile(imgPath, {
              className: 'cc-work',
              alt: (col.name || 'artwork') + ' ' + (wi + 1),
              collectionIndex: col.originalIndex,
              workIndex: wi,
              fixedSize: false
            });
            tile.setAttribute('data-canvas-draggable', 'true');
            // Add paperclip
            if (clipSVG) {
              const clipWrap = document.createElement('div');
              clipWrap.className = 'cc-clip';
              clipWrap.innerHTML = clipSVG;
              tile.appendChild(clipWrap);
            }
            const caption = document.createElement('div');
            caption.className = 'cc-work-caption';
            caption.textContent = (col.name || 'Work') + ' — ' + (wi + 1);
            tile.appendChild(caption);
            spreadInner.appendChild(tile);
            spread.classList.add('is-visible');
          }
        });

        folderTab.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') folderTab.click();
        });

        rail.appendChild(folderTab);
      });

      contents.appendChild(rail);
      contents.appendChild(spread);
      drawerEl.appendChild(contents);

      // Toggle drawer open/close
      const toggleDrawer = () => {
        const isOpen = drawerEl.classList.toggle('is-open');
        face.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (!isOpen) {
          // Close all folders too
          activeFolder = -1;
          rail.querySelectorAll('.cc-folder-tab').forEach(ft => ft.classList.remove('is-active'));
          spreadInner.innerHTML = '';
          spread.classList.remove('is-visible');
        }
      };

      face.addEventListener('click', toggleDrawer);
      face.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') toggleDrawer();
      });

      cabinet.appendChild(drawerEl);
    });

    const footer = document.createElement('div');
    footer.className = 'cc-cabinet-footer';
    footer.textContent = 'ARCHIVE REFERENCE SYSTEM';
    cabinet.appendChild(footer);

    ccRoot.appendChild(cabinet);
    root.appendChild(ccRoot);
  }
};
