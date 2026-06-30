
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['aqua_city'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    root.classList.add('aqua-city-root');

    // ---- HEADER ----
    const header = document.createElement('div');
    header.className = 'aqua-city-header';

    const titleEl = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (titleEl) {
      titleEl.className = (titleEl.className || '') + ' aqua-city-title';
      header.appendChild(titleEl);
    } else {
      const h1 = document.createElement('h1');
      h1.className = 'aqua-city-title';
      h1.setAttribute('data-text-id', 'portfolio-title');
      h1.setAttribute('data-text-role', 'portfolio-title');
      h1.setAttribute('data-text-fallback', 'Aqua City Portfolio');
      h1.textContent = 'Aqua City Portfolio';
      header.appendChild(h1);
    }

    // Wave SVG divider
    const waveSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    waveSvg.setAttribute('viewBox', '0 0 1200 60');
    waveSvg.setAttribute('preserveAspectRatio', 'none');
    waveSvg.className = 'aqua-city-wave-divider';
    waveSvg.innerHTML = `
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--color-panel)" stop-opacity="0.5"/>
          <stop offset="50%" stop-color="var(--color-accent)" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <path d="M0,20 C150,5 300,40 450,22 C600,5 750,38 900,20 C1050,5 1150,32 1200,20 L1200,60 L0,60 Z" fill="url(#waveGrad)"/>
      <path d="M0,35 C200,18 400,48 600,32 C800,16 1000,44 1200,30 L1200,60 L0,60 Z" fill="var(--color-panel)" fill-opacity="0.15"/>
    `;
    header.appendChild(waveSvg);
    root.appendChild(header);

    // ---- CITYSCAPE STRIP ----
    const cityDiv = document.createElement('div');
    cityDiv.className = 'aqua-city-cityscape';
    if (assets && assets['cityscape.svg']) {
      cityDiv.innerHTML = assets['cityscape.svg'];
    } else {
      cityDiv.innerHTML = `<svg viewBox="0 0 1200 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="120" fill="var(--color-panel)" fill-opacity="0.08"/>
        <!-- Buildings background -->
        <rect x="40" y="60" width="30" height="60" fill="var(--color-panel)" fill-opacity="0.25" rx="2"/>
        <rect x="80" y="40" width="50" height="80" fill="var(--color-panel)" fill-opacity="0.3" rx="2"/>
        <rect x="140" y="55" width="35" height="65" fill="var(--color-panel)" fill-opacity="0.2" rx="2"/>
        <rect x="185" y="30" width="60" height="90" fill="var(--color-panel)" fill-opacity="0.28" rx="2"/>
        <rect x="255" y="50" width="40" height="70" fill="var(--color-panel)" fill-opacity="0.22" rx="2"/>
        <rect x="305" y="20" width="70" height="100" fill="var(--color-panel)" fill-opacity="0.32" rx="2"/>
        <rect x="385" y="45" width="45" height="75" fill="var(--color-panel)" fill-opacity="0.2" rx="2"/>
        <rect x="440" y="35" width="55" height="85" fill="var(--color-panel)" fill-opacity="0.27" rx="2"/>
        <rect x="505" y="55" width="38" height="65" fill="var(--color-panel)" fill-opacity="0.22" rx="2"/>
        <rect x="553" y="25" width="65" height="95" fill="var(--color-panel)" fill-opacity="0.3" rx="2"/>
        <rect x="628" y="48" width="42" height="72" fill="var(--color-panel)" fill-opacity="0.2" rx="2"/>
        <rect x="680" y="38" width="58" height="82" fill="var(--color-panel)" fill-opacity="0.28" rx="2"/>
        <rect x="748" y="52" width="36" height="68" fill="var(--color-panel)" fill-opacity="0.22" rx="2"/>
        <rect x="794" y="22" width="68" height="98" fill="var(--color-panel)" fill-opacity="0.32" rx="2"/>
        <rect x="872" y="46" width="44" height="74" fill="var(--color-panel)" fill-opacity="0.2" rx="2"/>
        <rect x="926" y="36" width="56" height="84" fill="var(--color-panel)" fill-opacity="0.26" rx="2"/>
        <rect x="992" y="50" width="40" height="70" fill="var(--color-panel)" fill-opacity="0.22" rx="2"/>
        <rect x="1042" y="28" width="62" height="92" fill="var(--color-panel)" fill-opacity="0.3" rx="2"/>
        <rect x="1114" y="44" width="48" height="76" fill="var(--color-panel)" fill-opacity="0.24" rx="2"/>
        <!-- Building windows -->
        <rect x="90" y="48" width="8" height="6" fill="#ffeb3b" fill-opacity="0.5" rx="1"/>
        <rect x="102" y="48" width="8" height="6" fill="#ffeb3b" fill-opacity="0.3" rx="1"/>
        <rect x="90" y="60" width="8" height="6" fill="#ffeb3b" fill-opacity="0.4" rx="1"/>
        <rect x="195" y="38" width="8" height="6" fill="#ffeb3b" fill-opacity="0.4" rx="1"/>
        <rect x="208" y="38" width="8" height="6" fill="#ffeb3b" fill-opacity="0.6" rx="1"/>
        <rect x="315" y="28" width="8" height="6" fill="#ffeb3b" fill-opacity="0.5" rx="1"/>
        <rect x="328" y="28" width="8" height="6" fill="#ffeb3b" fill-opacity="0.3" rx="1"/>
        <rect x="563" y="33" width="8" height="6" fill="#ffeb3b" fill-opacity="0.4" rx="1"/>
        <rect x="576" y="33" width="8" height="6" fill="#ffeb3b" fill-opacity="0.5" rx="1"/>
        <!-- Water surface line -->
        <path d="M0,100 C200,88 400,105 600,95 C800,85 1000,102 1200,92 L1200,120 L0,120 Z" fill="var(--color-background)" fill-opacity="0.4"/>
      </svg>`;
    }
    root.appendChild(cityDiv);

    // ---- TURBINES ----
    const turbineRow = document.createElement('div');
    turbineRow.className = 'aqua-city-turbines';
    for (let t = 0; t < 3; t++) {
      const turbineDiv = document.createElement('div');
      turbineDiv.className = 'aqua-turbine';
      turbineDiv.innerHTML = assets && assets['turbine.svg']
        ? assets['turbine.svg']
        : `<svg width="36" height="70" viewBox="0 0 36 70" xmlns="http://www.w3.org/2000/svg">
            <rect x="16" y="20" width="4" height="50" fill="var(--color-accent)" fill-opacity="0.6" rx="2"/>
            <g transform="translate(18,20)" style="transform-origin:0 0">
              <path d="M0,0 L-14,-8 L-2,-2 Z" fill="var(--color-accent)" fill-opacity="0.7"/>
              <path d="M0,0 L14,-8 L2,-2 Z" fill="var(--color-accent)" fill-opacity="0.5"/>
              <path d="M0,0 L0,16 L-2,2 Z" fill="var(--color-accent)" fill-opacity="0.6"/>
            </g>
            <circle cx="18" cy="20" r="3" fill="var(--color-background)" stroke="var(--color-accent)" stroke-width="1.5" fill-opacity="0.8"/>
          </svg>`;
      turbineRow.appendChild(turbineDiv);
    }
    root.appendChild(turbineRow);

    // ---- COLLECTIONS ----
    const collectionsDiv = document.createElement('div');
    collectionsDiv.className = 'aqua-city-collections';

    const fishColors = [
      'var(--color-primary)',
      'var(--color-accent)',
      'var(--color-panel)',
      'color-mix(in srgb, var(--color-primary) 70%, var(--color-accent))'
    ];

    collections.forEach((col, ci) => {
      // Use helper for editable collection section
      const section = helpers.collectionSection(col, ci);
      section.className = (section.className || '') + ' aqua-dome-section aquatic_ecosystem-collection';

      // Fix heading inside section
      const existingH2 = section.querySelector('h2');
      if (existingH2) {
        existingH2.className = 'aqua-dome-title';
        // Wrap heading in intro bar with fish icon
        const introBar = document.createElement('div');
        introBar.className = 'aqua-dome-intro';
        const fishSpan = document.createElement('span');
        fishSpan.className = 'aqua-dome-fish-icon';
        fishSpan.innerHTML = `<svg width="28" height="18" viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="12" cy="9" rx="10" ry="6" fill="currentColor" fill-opacity="0.9"/>
          <polygon points="22,9 28,2 28,16" fill="currentColor" fill-opacity="0.7"/>
          <circle cx="5" cy="7" r="2" fill="white" fill-opacity="0.6"/>
          <circle cx="5" cy="7" r="1" fill="var(--color-panel)" fill-opacity="0.8"/>
          <path d="M8,6 Q12,3 16,6" stroke="white" stroke-width="0.8" fill="none" stroke-opacity="0.5"/>
        </svg>`;
        fishSpan.style.color = fishColors[ci % fishColors.length];
        introBar.appendChild(fishSpan);

        // Move h2 into intro bar
        existingH2.parentNode.insertBefore(introBar, existingH2);
        introBar.appendChild(existingH2);

        // Coral divider
        const coralDiv = document.createElement('div');
        coralDiv.className = 'aqua-coral-divider';
        coralDiv.innerHTML = assets && assets['coral.svg']
          ? assets['coral.svg'] + assets['coral.svg'] + assets['coral.svg']
          : `
          <svg width="18" height="22" viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg">
            <path d="M9,20 L9,12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9,16 Q5,12 3,8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M9,14 Q13,10 15,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <circle cx="3" cy="7" r="2.5" fill="currentColor"/>
            <circle cx="15" cy="5" r="2.5" fill="currentColor"/>
            <circle cx="9" cy="12" r="2" fill="currentColor" fill-opacity="0.6"/>
          </svg>
          <svg width="14" height="26" viewBox="0 0 14 26" xmlns="http://www.w3.org/2000/svg">
            <path d="M7,24 L7,10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M7,18 Q3,14 2,8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M7,15 Q11,11 12,5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <circle cx="2" cy="7" r="3" fill="currentColor"/>
            <circle cx="12" cy="4" r="3" fill="currentColor"/>
          </svg>
          <svg width="18" height="22" viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg">
            <path d="M9,20 L9,12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9,16 Q5,12 3,8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M9,14 Q13,10 15,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <circle cx="3" cy="7" r="2.5" fill="currentColor"/>
            <circle cx="15" cy="5" r="2.5" fill="currentColor"/>
            <circle cx="9" cy="12" r="2" fill="currentColor" fill-opacity="0.6"/>
          </svg>`;
        section.insertBefore(coralDiv, introBar.nextSibling);
      }

      // Floating fish decoration inside dome
      const floatFish = document.createElement('div');
      floatFish.className = 'aqua-fish-icon';
      floatFish.style.bottom = '10px';
      floatFish.style.right = '20px';
      floatFish.style.color = fishColors[ci % fishColors.length];
      floatFish.innerHTML = `<svg width="44" height="28" viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="18" cy="14" rx="16" ry="10" fill="currentColor"/>
        <polygon points="34,14 44,4 44,24" fill="currentColor" fill-opacity="0.7"/>
        <circle cx="7" cy="11" r="3" fill="white" fill-opacity="0.5"/>
        <circle cx="7" cy="11" r="1.5" fill="var(--color-panel)" fill-opacity="0.8"/>
        <path d="M12,10 Q18,5 24,9" stroke="white" stroke-width="1" fill="none" stroke-opacity="0.4"/>
        <path d="M10,14 Q16,11 22,14" stroke="white" stroke-width="0.7" fill="none" stroke-opacity="0.3"/>
      </svg>`;
      section.appendChild(floatFish);

      // Works scroll strip
      const strip = document.createElement('div');
      strip.className = 'aqua-works-strip images-scroll';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'aqua-work-tile',
          alt: col.name + ' artwork ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi,
          fixedSize: false
        });
        tile.setAttribute('data-canvas-draggable', 'true');

        // Badge with work number
        const badge = document.createElement('div');
        badge.className = 'aqua-bubble-badge';
        badge.textContent = (wi + 1);
        tile.appendChild(badge);

        strip.appendChild(tile);
      });

      section.appendChild(strip);
      collectionsDiv.appendChild(section);
    });

    root.appendChild(collectionsDiv);

    // ---- SEABED ----
    const seabed = document.createElement('div');
    seabed.className = 'aqua-seabed';
    seabed.innerHTML = `<svg viewBox="0 0 1200 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
      <path d="M0,40 C100,25 200,55 350,38 C500,22 650,50 800,35 C950,20 1100,48 1200,32 L1200,80 L0,80 Z"
        fill="var(--color-panel)" fill-opacity="0.25"/>
      <path d="M0,55 C150,42 300,62 500,50 C700,38 900,60 1200,48 L1200,80 L0,80 Z"
        fill="var(--color-panel)" fill-opacity="0.4"/>
      <!-- Seabed bubbles -->
      <circle cx="100" cy="45" r="5" fill="white" fill-opacity="0.2"/>
      <circle cx="250" cy="38" r="3" fill="white" fill-opacity="0.25"/>
      <circle cx="450" cy="50" r="6" fill="white" fill-opacity="0.15"/>
      <circle cx="700" cy="42" r="4" fill="white" fill-opacity="0.2"/>
      <circle cx="900" cy="55" r="7" fill="white" fill-opacity="0.12"/>
      <circle cx="1100" cy="40" r="4" fill="white" fill-opacity="0.22"/>
    </svg>`;
    root.appendChild(seabed);
  }
};
