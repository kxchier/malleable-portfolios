window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['quilt_patch'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    root.className = (root.className || '') + ' qp-root';

    // --- SVG inline helpers ---
    const roseSVG = assets['rose.svg'] || '';
    const cornerSVG = assets['corner-floral.svg'] || '';
    const smallFlowerSVG = assets['small-flower.svg'] || '';

    // Nameplate
    const nameplate = document.createElement('div');
    nameplate.className = 'qp-nameplate';
    const titleEl = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (titleEl) {
      nameplate.appendChild(titleEl);
    } else {
      const h1 = document.createElement('h1');
      h1.setAttribute('data-text-id', 'portfolio-title');
      h1.setAttribute('data-text-role', 'portfolio-title');
      h1.setAttribute('data-text-fallback', 'Portfolio');
      h1.textContent = 'Portfolio';
      nameplate.appendChild(h1);
    }
    // Stitch decoration under nameplate
    const stitchRow = document.createElement('div');
    stitchRow.className = 'qp-nameplate-stitch';
    const sl1 = document.createElement('div'); sl1.className = 'qp-nameplate-stitch-line';
    const sl2 = document.createElement('div'); sl2.className = 'qp-nameplate-stitch-line';
    const roseSpan = document.createElement('span');
    roseSpan.style.cssText = 'width:22px;height:22px;display:inline-block;opacity:0.65;';
    roseSpan.innerHTML = roseSVG || '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4" fill="#c88c8c" opacity="0.8"/><circle cx="12" cy="7" r="2.5" fill="#d9a3a3" opacity="0.7"/><circle cx="12" cy="17" r="2.5" fill="#d9a3a3" opacity="0.7"/><circle cx="7" cy="12" r="2.5" fill="#d9a3a3" opacity="0.7"/><circle cx="17" cy="12" r="2.5" fill="#d9a3a3" opacity="0.7"/></svg>';
    stitchRow.appendChild(sl1);
    stitchRow.appendChild(roseSpan);
    stitchRow.appendChild(sl2);
    nameplate.appendChild(stitchRow);
    root.appendChild(nameplate);

    // Collections
    collections.forEach((col, ci) => {
      // Seam divider between patches (not before first)
      if (ci > 0) {
        const seam = document.createElement('div');
        seam.className = 'qp-seam-divider';
        seam.innerHTML = '<span></span>' +
          (smallFlowerSVG ? '<span style="width:16px;height:16px;display:inline-block;color:var(--color-secondary);opacity:0.8">' + smallFlowerSVG + '</span>' : '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6"/><circle cx="8" cy="3" r="1.5" fill="currentColor" opacity="0.5"/><circle cx="8" cy="13" r="1.5" fill="currentColor" opacity="0.5"/><circle cx="3" cy="8" r="1.5" fill="currentColor" opacity="0.5"/><circle cx="13" cy="8" r="1.5" fill="currentColor" opacity="0.5"/></svg>') +
          '<span></span>';
        root.appendChild(seam);
      }

      // Patch block
      const patch = document.createElement('div');
      patch.className = 'qp-patch';
      patch.setAttribute('data-canvas-draggable', 'true');

      // Decorative top floral border
      const floralBorder = document.createElement('div');
      floralBorder.className = 'qp-floral-border';
      patch.appendChild(floralBorder);

      // Dashed seam overlay
      const seamOverlay = document.createElement('div');
      seamOverlay.className = 'qp-patch-seam';
      patch.appendChild(seamOverlay);

      // Corner floral motifs
      ['top-left', 'top-right', 'btm-left'].forEach(pos => {
        const cm = document.createElement('span');
        cm.className = 'qp-corner-motif ' + pos;
        cm.innerHTML = cornerSVG || '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="4" fill="#c88c8c" opacity="0.55"/><circle cx="6" cy="14" r="2.5" fill="#d9a3a3" opacity="0.45"/><circle cx="14" cy="6" r="2.5" fill="#d9a3a3" opacity="0.45"/><circle cx="6" cy="22" r="1.5" fill="#8a9a5b" opacity="0.4"/><circle cx="22" cy="6" r="1.5" fill="#8a9a5b" opacity="0.4"/><line x1="6" y1="6" x2="6" y2="24" stroke="#8b7355" stroke-width="1" stroke-dasharray="2 3" opacity="0.35"/><line x1="6" y1="6" x2="24" y2="6" stroke="#8b7355" stroke-width="1" stroke-dasharray="2 3" opacity="0.35"/></svg>';
        patch.appendChild(cm);
      });

      // Collection section (provides editable h2)
      const section = helpers.collectionSection(col, ci);
      section.className = (section.className || '') + ' embroidered_quilt-collection';
      patch.dataset.collectionIndex = String(col.originalIndex ?? ci);
      patch.dataset.modelKind = 'collection';
      patch.dataset.modelPath = 'collections.' + (col.originalIndex ?? ci);
      patch.dataset.collectionId = 'collection_' + (col.originalIndex ?? ci);
      patch.dataset.modelLabel = col.name;
      delete section.dataset.collectionIndex;
      delete section.dataset.modelKind;
      delete section.dataset.modelPath;
      delete section.dataset.collectionId;
      delete section.dataset.modelLabel;

      // Wrap label with rose icon
      const labelWrap = document.createElement('div');
      labelWrap.className = 'qp-patch-label';
      const roseIcon = document.createElement('span');
      roseIcon.className = 'qp-patch-label-rose';
      roseIcon.innerHTML = roseSVG || '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4" fill="#c88c8c"/><circle cx="12" cy="7" r="2" fill="#d9a3a3" opacity="0.8"/><circle cx="12" cy="17" r="2" fill="#d9a3a3" opacity="0.8"/><circle cx="7" cy="12" r="2" fill="#d9a3a3" opacity="0.8"/><circle cx="17" cy="12" r="2" fill="#d9a3a3" opacity="0.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="#d9a3a3" opacity="0.6"/><circle cx="15.5" cy="8.5" r="1.5" fill="#d9a3a3" opacity="0.6"/></svg>';
      labelWrap.appendChild(roseIcon);

      // Move the h2 into labelWrap
      const h2 = section.querySelector('h2');
      if (h2) {
        labelWrap.appendChild(h2);
      }
      section.insertBefore(labelWrap, section.firstChild);

      // Work grid: each collection becomes a responsive quilt patch.
      const grid = document.createElement('div');
      grid.className = 'qp-work-grid';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'qp-work-tile',
          alt: col.name + ' work ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi,
          fixedSize: false
        });
        tile.setAttribute('data-canvas-draggable', 'true');
        grid.appendChild(tile);
      });

      section.appendChild(grid);
      patch.appendChild(section);
      root.appendChild(patch);
    });

    // Animated ambient floral float — subtle rose drifting effect
    const floatStyle = document.createElement('style');
    floatStyle.textContent = `
      @keyframes qp-petal-float {
        0%   { transform: translateY(0) rotate(0deg);   opacity: 0.18; }
        50%  { transform: translateY(-8px) rotate(6deg); opacity: 0.28; }
        100% { transform: translateY(0) rotate(0deg);   opacity: 0.18; }
      }
      .qp-ambient-petal {
        position: fixed;
        pointer-events: none;
        z-index: 0;
        animation: qp-petal-float 6s ease-in-out infinite;
      }
    `;
    document.head.appendChild(floatStyle);

    // Place a few ambient floating petals
    const petalPositions = [
      { right: '4%',  top: '18%', delay: '0s',   size: '28px' },
      { right: '12%', top: '55%', delay: '2.1s', size: '20px' },
      { left:  '3%',  top: '38%', delay: '1.3s', size: '24px' },
      { left:  '8%',  top: '72%', delay: '3.5s', size: '18px' },
      { right: '7%',  top: '80%', delay: '4.2s', size: '22px' },
    ];
    petalPositions.forEach(p => {
      const petal = document.createElement('span');
      petal.className = 'qp-ambient-petal';
      petal.style.cssText = Object.entries(p).filter(([k]) => k !== 'size' && k !== 'delay').map(([k,v]) => k+':'+v).join(';') +
        ';width:' + p.size + ';height:' + p.size + ';animation-delay:' + p.delay;
      petal.innerHTML = smallFlowerSVG || '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="2.5" fill="#c88c8c" opacity="0.7"/><circle cx="10" cy="4" r="2" fill="#d9a3a3" opacity="0.6"/><circle cx="10" cy="16" r="2" fill="#d9a3a3" opacity="0.6"/><circle cx="4" cy="10" r="2" fill="#d9a3a3" opacity="0.6"/><circle cx="16" cy="10" r="2" fill="#d9a3a3" opacity="0.6"/></svg>';
      root.appendChild(petal);
    });
  }
};
