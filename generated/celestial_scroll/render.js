
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['celestial_scroll'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    // Sky canvas with animated stars
    const skyCanvas = document.createElement('div');
    skyCanvas.className = 'cs-sky-canvas';
    const starPositions = [
      [8,12],[15,5],[23,18],[31,3],[42,9],[50,14],[58,7],[67,20],[74,4],[82,11],
      [90,16],[5,28],[18,35],[29,23],[38,40],[48,31],[55,45],[63,27],[71,38],[88,42],
      [11,55],[24,62],[35,50],[44,68],[53,58],[61,73],[70,52],[79,65],[93,57],[3,70],
      [16,78],[27,85],[39,74],[47,90],[57,81],[66,88],[75,76],[85,83],[96,79],[9,95]
    ];
    starPositions.forEach(([lp, tp], i) => {
      const star = document.createElement('div');
      star.className = 'cs-star';
      const size = 1 + Math.random() * 3;
      star.style.cssText = `left:${lp}%;top:${tp}%;width:${size}px;height:${size}px;--dur:${2.5+Math.random()*4}s;--delay:${Math.random()*5}s;`;
      skyCanvas.appendChild(star);
    });
    root.appendChild(skyCanvas);

    // Page wrapper
    const page = document.createElement('div');
    page.className = 'cs-page';
    root.appendChild(page);

    // Hero title
    const heroDiv = document.createElement('div');
    heroDiv.className = 'cs-hero';
    const titleEl = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (titleEl) {
      titleEl.className = 'cs-hero-title';
      heroDiv.appendChild(titleEl);
    } else {
      const t = document.createElement('h1');
      t.className = 'cs-hero-title';
      t.setAttribute('data-text-id', 'portfolio-title');
      t.setAttribute('data-text-role', 'portfolio-title');
      t.setAttribute('data-text-fallback', 'Portfolio');
      t.textContent = 'Portfolio';
      heroDiv.appendChild(t);
    }
    const sub = document.createElement('p');
    sub.className = 'cs-hero-subtitle';
    sub.textContent = '✦ celestial works ✦';
    heroDiv.appendChild(sub);
    page.appendChild(heroDiv);

    // SVG assets
    const cloudBandSVG = assets['cloud-band.svg'] || '';
    const creatureSVG = assets['creature.svg'] || '';
    const starClusterSVG = assets['star-cluster.svg'] || '';
    const swirlSVG = assets['swirl-divider.svg'] || '';

    // Creature icons cycle
    const creatureList = assets['creature.svg'] ? [assets['creature.svg'], assets['creature2.svg'] || assets['creature.svg']] : [];

    collections.forEach((col, ci) => {
      // Cloud band separator
      if (ci > 0 && cloudBandSVG) {
        const band = document.createElement('div');
        band.className = 'cs-cloud-band';
        band.innerHTML = cloudBandSVG;
        page.appendChild(band);
      }

      const section = helpers.collectionSection(col, col.originalIndex);
      section.className = (section.className || '') + ' cs-collection-section';

      // Clear default children and rebuild header
      const existingH2 = section.querySelector('h2');
      const headerDiv = document.createElement('div');
      headerDiv.className = 'cs-collection-header';

      // Creature accent
      if (creatureSVG) {
        const cAcc = document.createElement('span');
        cAcc.className = 'cs-creature-accent';
        cAcc.innerHTML = creatureSVG;
        cAcc.style.animationDelay = (ci * 1.1) + 's';
        headerDiv.appendChild(cAcc);
      }

      if (existingH2) {
        section.removeChild(existingH2);
        headerDiv.appendChild(existingH2);
      }

      // Star cluster decoration
      if (starClusterSVG) {
        const sc = document.createElement('span');
        sc.className = 'cs-star-cluster';
        sc.innerHTML = starClusterSVG;
        headerDiv.appendChild(sc);
      }

      section.insertBefore(headerDiv, section.firstChild);

      // Works scroll
      const scrollRow = document.createElement('div');
      scrollRow.className = 'cs-works-scroll';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'cs-work-tile',
          alt: col.name + ' work ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi,
          fixedSize: false
        });
        tile.setAttribute('data-canvas-draggable', 'true');
        tile.style.setProperty('--fi', String(wi));
        scrollRow.appendChild(tile);
      });

      section.appendChild(scrollRow);

      // Swirl divider after each section
      if (swirlSVG) {
        const swirlEl = document.createElement('div');
        swirlEl.innerHTML = '<svg class="cs-swirl-divider" viewBox="0 0 1200 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">' + (assets['swirl-divider.svg'] ? '' : '') + '</svg>';
        // Use inline swirl
        const sw = document.createElement('div');
        sw.innerHTML = swirlSVG;
        const swSvg = sw.querySelector('svg');
        if (swSvg) {
          swSvg.className = 'cs-swirl-divider';
          section.appendChild(swSvg);
        }
      }

      page.appendChild(section);
    });
  }
};
