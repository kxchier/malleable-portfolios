
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['painted_world'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    root.classList.add('pw-root');

    // ── HERO SECTION ──
    const hero = document.createElement('div');
    hero.className = 'pw-hero';

    // Eye motifs
    const eyeRow = document.createElement('div');
    eyeRow.className = 'pw-hero-eyes';

    function makeEye(flip) {
      const eyeWrap = document.createElement('div');
      eyeWrap.className = 'pw-eye-motif';
      if (flip) eyeWrap.style.transform = 'scaleX(-1)';
      if (assets && assets['eye-flower.svg']) {
        eyeWrap.innerHTML = assets['eye-flower.svg'];
      } else {
        // Fallback inline eye+flower SVG
        eyeWrap.innerHTML = `<svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" width="90" height="90">
          <g opacity="0.95">
            <!-- petals -->
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#6a1b9a" transform="rotate(0 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#8b26b8" transform="rotate(45 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#6a1b9a" transform="rotate(90 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#7b1fa2" transform="rotate(135 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#6a1b9a" transform="rotate(180 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#8b26b8" transform="rotate(225 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#6a1b9a" transform="rotate(270 45 45)"/>
            <ellipse cx="45" cy="12" rx="7" ry="14" fill="#7b1fa2" transform="rotate(315 45 45)"/>
            <!-- eye white -->
            <ellipse cx="45" cy="45" rx="18" ry="13" fill="#f3e5f5"/>
            <!-- iris -->
            <circle cx="45" cy="45" r="9" fill="#388e3c"/>
            <!-- pupil -->
            <circle cx="45" cy="45" r="5" fill="#1a1035"/>
            <!-- highlight -->
            <circle cx="48" cy="42" r="2.5" fill="#f3e5f5" opacity="0.85"/>
            <!-- eye outline stroke -->
            <ellipse cx="45" cy="45" rx="18" ry="13" fill="none" stroke="#f57c00" stroke-width="1.5"/>
          </g>
        </svg>`;
      }
      return eyeWrap;
    }

    eyeRow.appendChild(makeEye(false));
    eyeRow.appendChild(makeEye(true));
    hero.appendChild(eyeRow);

    // Portfolio title
    const ptitle = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (ptitle) {
      ptitle.className = (ptitle.className || '') + ' pw-hero-title';
      hero.appendChild(ptitle);
    } else {
      const ht = document.createElement('h1');
      ht.className = 'pw-hero-title';
      ht.setAttribute('data-text-id', 'portfolio-title');
      ht.setAttribute('data-text-role', 'portfolio-title');
      ht.setAttribute('data-text-fallback', 'Louis Wain');
      ht.textContent = 'Louis Wain';
      hero.appendChild(ht);
    }

    // Decorative stroke underline
    const stroke = document.createElement('div');
    stroke.className = 'pw-hero-stroke';
    hero.appendChild(stroke);

    root.appendChild(hero);

    // ── FLOATING PETALS ──
    const petalColors = ['#6a1b9a', '#f57c00', '#388e3c', '#1a237e', '#f3e5f5'];
    for (let i = 0; i < 10; i++) {
      const petal = document.createElement('div');
      petal.className = 'pw-floating-petal';
      const size = 10 + Math.random() * 18;
      const leftPct = Math.random() * 100;
      const duration = 8 + Math.random() * 14;
      const delay = Math.random() * 12;
      const color = petalColors[i % petalColors.length];
      petal.style.cssText = `left:${leftPct}%;width:${size}px;height:${size}px;animation-duration:${duration}s;animation-delay:${delay}s;`;
      petal.innerHTML = `<svg viewBox="0 0 20 20" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="10" cy="10" rx="5" ry="9" fill="${color}" opacity="0.7" transform="rotate(${Math.random()*360} 10 10)"/>
      </svg>`;
      document.body.appendChild(petal);
    }

    // Leaf SVG helper
    function makeLeafSVG() {
      const el = document.createElement('div');
      el.className = 'pw-collection-leaf';
      if (assets && assets['leaf.svg']) {
        el.innerHTML = assets['leaf.svg'];
      } else {
        el.innerHTML = `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
          <path d="M14 2 C6 8, 2 16, 8 24 C10 20, 16 14, 14 2 Z" fill="currentColor" opacity="0.85"/>
          <path d="M14 2 C22 8, 26 16, 20 24 C18 20, 12 14, 14 2 Z" fill="currentColor" opacity="0.55"/>
          <line x1="14" y1="4" x2="14" y2="22" stroke="#f3e5f5" stroke-width="0.7" opacity="0.5"/>
        </svg>`;
      }
      return el;
    }

    // Fur corner SVG
    function makeFurCorner() {
      if (assets && assets['fur-corner.svg']) {
        const el = document.createElement('div');
        el.innerHTML = assets['fur-corner.svg'];
        return el.firstElementChild;
      }
      return null;
    }

    // ── COLLECTIONS ──
    collections.forEach((col, ci) => {
      const section = helpers.collectionFrame(col, col.originalIndex ?? ci, { className: 'pw-collection' });

      // Accent shimmer bar
      const accentBar = document.createElement('div');
      accentBar.className = 'pw-collection-accent-bar';
      section.insertBefore(accentBar, section.firstChild);

      // Title row with leaf
      const existingH2 = section.querySelector('h2');
      if (existingH2 && existingH2.parentNode === section) {
        const titleRow = document.createElement('div');
        titleRow.className = 'pw-collection-title-row';
        titleRow.appendChild(makeLeafSVG());
        section.insertBefore(titleRow, existingH2);
        titleRow.appendChild(existingH2);
        // Move accentBar above titleRow
        section.insertBefore(accentBar, titleRow);
      }

      // Fur corners
      const positions = ['tl', 'tr', 'bl', 'br'];
      positions.forEach(pos => {
        const corner = document.createElement('div');
        corner.className = `pw-fur-corner ${pos}`;
        const furSVG = assets && assets['fur-corner.svg'];
        if (furSVG) {
          corner.innerHTML = furSVG;
        } else {
          const sz = 48;
          corner.innerHTML = `<svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2 Q8 12, 4 24" stroke="#f57c00" stroke-width="2.5" fill="none" opacity="0.6" stroke-linecap="round"/>
            <path d="M8 2 Q14 14, 8 26" stroke="#f3e5f5" stroke-width="1.8" fill="none" opacity="0.5" stroke-linecap="round"/>
            <path d="M14 2 Q20 12, 16 22" stroke="#6a1b9a" stroke-width="2" fill="none" opacity="0.55" stroke-linecap="round"/>
            <path d="M2 8 Q12 14, 4 24" stroke="#388e3c" stroke-width="1.5" fill="none" opacity="0.45" stroke-linecap="round"/>
            <path d="M2 16 Q10 20, 6 32" stroke="#f57c00" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>
          </svg>`;
        }
        section.appendChild(corner);
      });

      // Work grid
      const grid = document.createElement('div');
      grid.className = 'pw-grid';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'pw-work',
          alt: 'Louis Wain artwork',
          collectionIndex: col.originalIndex,
          workIndex: wi,
          fixedSize: false
        });
        tile.setAttribute('data-canvas-draggable', 'true');
        grid.appendChild(tile);
      });

      section.appendChild(grid);
      root.appendChild(section);
    });
  }
};
  