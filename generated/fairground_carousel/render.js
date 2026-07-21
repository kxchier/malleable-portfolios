
window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['fairground_carousel'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    // ── Stage
    const stage = document.createElement('div');
    stage.className = 'fc-stage';

    // Sky
    const sky = document.createElement('div');
    sky.className = 'fc-sky';
    stage.appendChild(sky);

    // Stars canvas
    const starDiv = document.createElement('div');
    starDiv.className = 'fc-stars';
    starDiv.innerHTML = assets['stars.svg'] || '';
    stage.appendChild(starDiv);

    // Ground
    const ground = document.createElement('div');
    ground.className = 'fc-ground';
    stage.appendChild(ground);
    const sawdust = document.createElement('div');
    sawdust.className = 'fc-sawdust';
    stage.appendChild(sawdust);

    // ── Title
    const titleArea = document.createElement('div');
    titleArea.className = 'fc-title-area';
    const nameplate = document.createElement('div');
    nameplate.className = 'fc-nameplate';
    const portfolioTitleEl = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (portfolioTitleEl) {
      nameplate.appendChild(portfolioTitleEl);
    } else {
      nameplate.textContent = 'The Archive';
    }
    titleArea.appendChild(nameplate);
    const instr = document.createElement('div');
    instr.className = 'fc-instruction';
    instr.textContent = '— click a horse to catch it and open its collection —';
    titleArea.appendChild(instr);
    stage.appendChild(titleArea);

    // ── Carousel wrap
    const carouselWrap = document.createElement('div');
    carouselWrap.className = 'fc-carousel-wrap';

    const carouselRoot = document.createElement('div');
    carouselRoot.className = 'fc-carousel-root';
    carouselWrap.appendChild(carouselRoot);

    // Platform
    const platform = document.createElement('div');
    platform.className = 'fc-platform';
    carouselRoot.appendChild(platform);

    const ringOuter = document.createElement('div');
    ringOuter.className = 'fc-platform-ring fc-ring-outer';
    platform.appendChild(ringOuter);
    const ringInner = document.createElement('div');
    ringInner.className = 'fc-platform-ring fc-ring-inner';
    platform.appendChild(ringInner);

    // Decorative rim planks
    const plankSvg = assets['planks.svg'] || '';
    if (plankSvg) {
      const plankDiv = document.createElement('div');
      plankDiv.style.cssText = 'position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;opacity:0.18;';
      plankDiv.innerHTML = plankSvg;
      platform.appendChild(plankDiv);
    }

    // Center hub
    const hub = document.createElement('div');
    hub.className = 'fc-center-hub';
    const hubStar = document.createElement('span');
    hubStar.className = 'fc-hub-star';
    hubStar.innerHTML = assets['star.svg'] || '★';
    hub.appendChild(hubStar);
    carouselRoot.appendChild(hub);

    // Spin hint
    const spinHint = document.createElement('div');
    spinHint.className = 'fc-spin-hint';
    spinHint.textContent = '⟳ spinning…';
    carouselRoot.appendChild(spinHint);

    stage.appendChild(carouselWrap);

    // ── Ticket booth (collection index)
    const ticketBooth = document.createElement('div');
    ticketBooth.className = 'fc-ticket-booth';
    stage.appendChild(ticketBooth);

    // ── Panel overlay
    const overlay = document.createElement('div');
    overlay.className = 'fc-panel-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const panelBox = document.createElement('div');
    panelBox.className = 'fc-panel-box';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'fc-panel-header';
    const panelTitle = document.createElement('div');
    panelTitle.className = 'fc-panel-title';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fc-panel-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Close panel');
    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(closeBtn);

    const panelScroll = document.createElement('div');
    panelScroll.className = 'fc-panel-scroll';
    const worksGrid = document.createElement('div');
    worksGrid.className = 'fc-works-grid';
    panelScroll.appendChild(worksGrid);

    panelBox.appendChild(panelHeader);
    panelBox.appendChild(panelScroll);
    overlay.appendChild(panelBox);
    stage.appendChild(overlay);

    root.appendChild(stage);

    // ── Build hidden collection sections (for editor metadata)
    const hiddenSections = [];
    collections.forEach((col, ci) => {
      const section = helpers.collectionFrame(col, col.originalIndex ?? ci, { className: 'fc-collection-section' });
      section.style.display = 'none';
      hiddenSections.push(section);
      root.appendChild(section);
    });

    // ── Animation state
    let angle = 0;
    let spinning = true;
    let speed = 0.004; // rad per frame
    let raf = null;
    let activeColIndex = null;

    const colCount = collections.length;
    const horseUnits = [];
    const tickets = [];

    // ── Horse SVG factory (uses assets or inline)
    function makeHorseSvg(color, idx) {
      const svgAsset = assets['horse.svg'];
      if (svgAsset) {
        const div = document.createElement('div');
        div.innerHTML = svgAsset;
        const svg = div.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '72');
          svg.setAttribute('height', '90');
          svg.style.color = color;
          svg.style.display = 'block';
          svg.classList.add('fc-horse-svg');
          return svg;
        }
      }
      // Fallback inline horse
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 72 90');
      svg.setAttribute('width', '72');
      svg.setAttribute('height', '90');
      svg.classList.add('fc-horse-svg');
      svg.innerHTML = `
        <g fill="none" stroke="none">
          <!-- pole -->
          <rect x="33" y="0" width="5" height="90" rx="2" fill="${color}" opacity="0.6"/>
          <!-- body -->
          <ellipse cx="36" cy="55" rx="18" ry="11" fill="${color}"/>
          <!-- neck -->
          <path d="M44 49 Q52 38 50 28" stroke="${color}" stroke-width="8" stroke-linecap="round" fill="none"/>
          <!-- head -->
          <ellipse cx="51" cy="24" rx="9" ry="6" transform="rotate(-20 51 24)" fill="${color}"/>
          <!-- ear -->
          <path d="M55 18 L58 13 L61 18" fill="${color}"/>
          <!-- eye -->
          <circle cx="54" cy="23" r="1.5" fill="#1a0f05"/>
          <!-- nostril -->
          <ellipse cx="57" cy="26" rx="1.2" ry="0.8" fill="rgba(0,0,0,0.3)"/>
          <!-- mane -->
          <path d="M44 49 Q47 40 45 30 Q47 35 50 28" stroke="rgba(255,220,120,0.5)" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- front legs -->
          <path d="M30 63 Q28 72 26 80" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M38 64 Q38 73 37 82" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <!-- back legs -->
          <path d="M22 62 Q20 72 18 80" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M15 60 Q14 70 13 79" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <!-- tail -->
          <path d="M18 58 Q10 65 12 75" stroke="rgba(255,220,120,0.5)" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- saddle -->
          <ellipse cx="30" cy="52" rx="8" ry="4" fill="rgba(200,134,10,0.6)" stroke="rgba(245,230,200,0.3)" stroke-width="0.8"/>
        </g>`;
      return svg;
    }

    // ── Bulbs on platform rim
    const bulbCount = 24;
    for (let b = 0; b < bulbCount; b++) {
      const ba = (b / bulbCount) * Math.PI * 2;
      const bx = 50 + 47 * Math.cos(ba);
      const by = 50 + 47 * Math.sin(ba);
      const bulb = document.createElement('div');
      bulb.className = 'fc-bulb' + (b % 3 === 1 ? ' dim' : '');
      bulb.style.left = bx + '%';
      bulb.style.top = by + '%';
      bulb.style.transform = 'translate(-50%, -50%)';
      carouselRoot.appendChild(bulb);
    }

    // Horse color palette
    const horseColors = [
      '#c8a86e', '#a0785c', '#d4b896', '#8c6b4a', '#b89060'
    ];

    // ── Build horse units
    collections.forEach((col, ci) => {
      const unit = document.createElement('div');
      unit.className = 'fc-horse-unit';
      unit.dataset.colIndex = ci;
      unit.setAttribute('data-canvas-draggable', 'false');

      const hsvg = makeHorseSvg(horseColors[ci % horseColors.length], ci);
      unit.appendChild(hsvg);

      const label = document.createElement('div');
      label.className = 'fc-horse-label';
      label.textContent = col.name;
      unit.appendChild(label);

      carouselRoot.appendChild(unit);
      horseUnits.push(unit);

      // Ticket
      const ticket = document.createElement('button');
      ticket.className = 'fc-ticket';
      ticket.dataset.colIndex = ci;
      ticket.textContent = col.name + ' (' + col.images.length + ')';
      ticketBooth.appendChild(ticket);
      tickets.push(ticket);

      ticket.addEventListener('click', () => {
        openPanel(ci);
      });

      unit.addEventListener('click', () => {
        openPanel(ci);
      });
    });

    // ── Open panel
    function openPanel(ci) {
      if (!spinning) {
        // If already stopped on another, allow switching
      }
      spinning = false;
      spinHint.textContent = '— caught —';
      activeColIndex = ci;
      horseUnits.forEach((u, i) => u.classList.toggle('fc-stopped', i === ci));
      tickets.forEach((t, i) => t.classList.toggle('active', i === ci));

      const col = collections[ci];
      panelTitle.textContent = col.name;

      // Inject editable title from helper into panelTitle area
      // Use the hidden section's h2 text for the title label (editor edits it there)
      const hiddenSec = hiddenSections[ci];
      const hiddenH2 = hiddenSec ? hiddenSec.querySelector('h2') : null;
      if (hiddenH2) {
        panelTitle.innerHTML = '';
        panelTitle.appendChild(hiddenH2.cloneNode(true));
      }

      worksGrid.innerHTML = '';
      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'fc-work-tile',
          alt: col.name + ' work ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi,
          fixedSize: false
        });
        worksGrid.appendChild(tile);
      });

      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => {
        spinning = true;
        spinHint.textContent = '⟳ spinning…';
        horseUnits.forEach(u => u.classList.remove('fc-stopped'));
        tickets.forEach(t => t.classList.remove('active'));
        activeColIndex = null;
      }, 350);
    }

    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closePanel();
    });

    // ── Animation loop
    let lastTime = null;
    const bobAmplitude = 14; // px
    const bobFreq = 1.5;

    function getRadius() {
      const rect = carouselRoot.getBoundingClientRect();
      return rect.width * 0.34;
    }

    function positionHorses(t) {
      const N = collections.length;
      const baseRadius = getRadius();
      horseUnits.forEach((unit, i) => {
        const phaseOffset = (i / N) * Math.PI * 2;
        const theta = angle + phaseOffset;
        const x = Math.cos(theta) * baseRadius;
        const y = Math.sin(theta) * baseRadius;
        const bob = Math.sin(t * bobFreq + phaseOffset) * bobAmplitude;
        // Position relative to center of carouselRoot
        const rootWidth = carouselRoot.offsetWidth || 400;
        const rootHeight = carouselRoot.offsetHeight || 400;
        const pct_x = 50 + (x / rootWidth) * 100;
        const pct_y = 50 + ((y + bob) / rootHeight) * 100;
        unit.style.left = pct_x + '%';
        unit.style.top = pct_y + '%';
        unit.style.transform = 'translate(-50%, -50%)';
        // Depth: horses behind are smaller
        const depthScale = 0.7 + 0.3 * ((Math.sin(theta) + 1) / 2);
        unit.style.zIndex = Math.round(depthScale * 20) + 5 + '';
        const unitSize = 72 * depthScale;
        const horseSvg = unit.querySelector('svg, img');
        if (horseSvg) {
          horseSvg.setAttribute && horseSvg.setAttribute('width', Math.round(unitSize) + '');
          horseSvg.setAttribute && horseSvg.setAttribute('height', Math.round(unitSize * 90 / 72) + '');
        }
        unit.style.opacity = (0.5 + 0.5 * depthScale).toFixed(2);
      });
    }

    function animate(ts) {
      if (!lastTime) lastTime = ts;
      const dt = (ts - lastTime) / 1000;
      lastTime = ts;
      if (spinning) {
        angle += speed * (dt * 60);
      }
      positionHorses(ts / 1000);
      raf = requestAnimationFrame(animate);
    }

    raf = requestAnimationFrame(animate);

    // Cleanup on unmount (if supported)
    root._fcCleanup = () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }
};
