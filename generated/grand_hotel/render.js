
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['grand_hotel'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    // ── SCENIC BACKDROP ──────────────────────────────────────────
    const backdrop = document.createElement('div');
    backdrop.className = 'gh-backdrop';
    backdrop.innerHTML = '<div class="gh-sky"></div>'
      + (assets['mountains.svg'] ? '<div class="gh-mountains">' + assets['mountains.svg'] + '</div>' : '')
      + '<div class="gh-waterfall-strip"></div>'
      + '<div class="gh-cloud-l">' + (assets['cloud.svg'] || '') + '</div>'
      + '<div class="gh-cloud-r">' + (assets['cloud.svg'] || '') + '</div>';
    root.appendChild(backdrop);

    // ── MAIN ROOT ─────────────────────────────────────────────────
    const ghRoot = document.createElement('div');
    ghRoot.className = 'gh-root';
    root.appendChild(ghRoot);

    // ── HOTEL FACADE HEADER ───────────────────────────────────────
    const header = document.createElement('header');
    header.className = 'gh-facade-header';

    // Cornice
    const cornice = document.createElement('div');
    cornice.className = 'gh-facade-cornice';
    header.appendChild(cornice);

    // Nameplate
    const nameplate = document.createElement('div');
    nameplate.className = 'gh-facade-nameplate';

    const shellTitle = document.querySelector('body.view-grand_hotel > header h1');
    const titleEl = shellTitle || (helpers.portfolioTitle ? helpers.portfolioTitle() : null);
    if (titleEl) {
      titleEl.className = 'gh-hotel-title';
      titleEl.hidden = false;
      nameplate.appendChild(titleEl);
    } else {
      const t = document.createElement('div');
      t.className = 'gh-hotel-title';
      t.setAttribute('data-text-id', 'portfolio-title');
      t.setAttribute('data-text-role', 'portfolio-title');
      t.setAttribute('data-text-fallback', 'Grand Portfolio');
      t.textContent = 'Grand Portfolio';
      nameplate.appendChild(t);
    }

    const subtitle = document.createElement('div');
    subtitle.className = 'gh-hotel-subtitle';
    subtitle.textContent = 'Rooms of Recent Work';
    nameplate.appendChild(subtitle);
    header.appendChild(nameplate);

    // Base
    const base = document.createElement('div');
    base.className = 'gh-facade-base';
    header.appendChild(base);

    const facadeBody = document.createElement('div');
    facadeBody.className = 'gh-facade-body';

    const towerLeft = document.createElement('div');
    towerLeft.className = 'gh-tower gh-tower-left';
    towerLeft.innerHTML = '<div class="gh-tower-roof"></div><div class="gh-tower-window"></div><div class="gh-tower-window"></div>';

    const entrance = document.createElement('div');
    entrance.className = 'gh-entrance';
    entrance.innerHTML = '<div class="gh-entrance-sign">Lobby</div><div class="gh-entrance-arch"></div>';

    const towerRight = document.createElement('div');
    towerRight.className = 'gh-tower gh-tower-right';
    towerRight.innerHTML = '<div class="gh-tower-roof"></div><div class="gh-tower-window"></div><div class="gh-tower-window"></div>';

    // Decorative windows row
    const winsRow = document.createElement('div');
    winsRow.className = 'gh-facade-windows';
    for (let w = 0; w < 9; w++) {
      const win = document.createElement('div');
      win.className = 'gh-win';
      winsRow.appendChild(win);
    }
    facadeBody.appendChild(towerLeft);
    facadeBody.appendChild(winsRow);
    facadeBody.appendChild(towerRight);
    facadeBody.appendChild(entrance);
    header.appendChild(facadeBody);

    // Flags
    const flagsRow = document.createElement('div');
    flagsRow.className = 'gh-flags';
    for (let f = 0; f < 3; f++) {
      const pole = document.createElement('div');
      pole.className = 'gh-flag-pole';
      const line = document.createElement('div');
      line.className = 'gh-flag-pole-line';
      const banner = document.createElement('div');
      banner.className = 'gh-flag-banner';
      pole.appendChild(banner);
      pole.appendChild(line);
      flagsRow.appendChild(pole);
    }
    header.appendChild(flagsRow);

    ghRoot.appendChild(header);

    // ── COLLECTION FLOORS ──────────────────────────────────────────
    const floorNames = ['Ground Floor', 'First Floor', 'Second Floor', 'Penthouse', 'Attic', 'Rooftop'];
    const ornaments = ['❧', '✦', '❦', '✿', '❧', '✦'];

    collections.forEach((col, ci) => {
      // Divider before each floor (except first)
      if (ci > 0) {
        const divider = document.createElement('div');
        divider.className = 'gh-floor-divider';
        divider.innerHTML = '<div class="gh-floor-divider-line"></div><div class="gh-floor-divider-diamond"></div><div class="gh-floor-divider-line"></div>';
        ghRoot.appendChild(divider);
      }

      // Collection frame (floor section)
      const section = helpers.collectionFrame(col, col.originalIndex ?? ci, { className: 'gh-floor', tagName: 'section' });

      // Override inner heading with styled floor header
      // Find or rebuild the floor header
      const existingH2 = section.querySelector('h2');

      const floorHeader = document.createElement('div');
      floorHeader.className = 'gh-floor-header';

      const ruleL = document.createElement('div');
      ruleL.className = 'gh-floor-rule';

      const labelWrap = document.createElement('div');
      labelWrap.className = 'gh-floor-label-wrap';

      const floorNum = document.createElement('div');
      floorNum.className = 'gh-floor-number';
      floorNum.textContent = (floorNames[ci] || ('Floor ' + (ci + 1))) + ' · Key ' + String(ci + 1).padStart(2, '0');

      const ornL = document.createElement('span');
      ornL.className = 'gh-floor-ornament';
      ornL.textContent = ornaments[ci % ornaments.length];

      labelWrap.appendChild(floorNum);

      if (existingH2) {
        existingH2.className = 'gh-floor-name';
        labelWrap.appendChild(ornL);
        labelWrap.appendChild(existingH2);
      } else {
        const h2 = document.createElement('h2');
        h2.className = 'gh-floor-name';
        h2.setAttribute('data-text-id', 'collection-' + (col.originalIndex ?? ci) + '-title');
        h2.setAttribute('data-text-role', 'collection-title');
        h2.setAttribute('data-text-fallback', col.name || ('Collection ' + (ci + 1)));
        h2.textContent = col.name || ('Collection ' + (ci + 1));
        labelWrap.appendChild(ornL);
        labelWrap.appendChild(h2);
      }

      const ruleR = document.createElement('div');
      ruleR.className = 'gh-floor-rule';

      floorHeader.appendChild(ruleL);
      floorHeader.appendChild(labelWrap);
      floorHeader.appendChild(ruleR);
      section.insertBefore(floorHeader, section.firstChild);

      // Works row
      const worksRow = document.createElement('div');
      worksRow.className = 'gh-works-row';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'gh-work',
          alt: (col.name || 'artwork') + ' ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi
        });
        const roomPlaque = document.createElement('div');
        roomPlaque.className = 'gh-room-plaque';
        roomPlaque.textContent = String(ci + 1).padStart(2, '0') + String(wi + 1).padStart(2, '0');
        tile.insertBefore(roomPlaque, tile.firstChild);
        // Add picture hanger ornament
        const hanger = document.createElement('div');
        hanger.className = 'gh-work-hanger';
        tile.insertBefore(hanger, tile.firstChild);
        tile.setAttribute('data-canvas-draggable', 'true');
        worksRow.appendChild(tile);
      });

      section.appendChild(worksRow);
      ghRoot.appendChild(section);
    });

    // ── FOOTER ────────────────────────────────────────────────────
    const footer = document.createElement('footer');
    footer.className = 'gh-facade-footer';
    footer.innerHTML = '<div class="gh-footer-rule"></div>'
      + '<div class="gh-footer-text">Est. MMXXV &nbsp;·&nbsp; All Works Reserved</div>';
    ghRoot.appendChild(footer);
  }
};
