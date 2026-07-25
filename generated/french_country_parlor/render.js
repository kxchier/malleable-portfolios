window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts.french_country_parlor = {
  mount(root, ctx) {
    const { collections, helpers } = ctx;
    const shell = document.createElement('div');
    shell.className = 'room-root parlor-root';

    const stage = document.createElement('section');
    stage.className = 'room-stage parlor-stage';
    stage.setAttribute('aria-label', 'Interactive French country parlor');
    stage.innerHTML = `
      <p class="room-hint parlor-hint">Step into the parlor — click a piece to browse</p>
      <div class="room-scene parlor-scene">
        <svg class="room-svg parlor-svg" viewBox="90 0 620 500" role="img" aria-label="Muted nineteenth-century French country parlor">
          <defs>
            <pattern id="parlorWallpaper" width="36" height="40" patternUnits="userSpaceOnUse">
              <rect width="36" height="40" fill="#efe6df"/>
              <circle cx="18" cy="16" r="3.5" fill="#d4c0ba" opacity=".4"/>
              <circle cx="18" cy="16" r="1.2" fill="#b89896" opacity=".35"/>
            </pattern>
            <linearGradient id="parlorSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#c5d0d5"/>
              <stop offset="60%" stop-color="#b4c2c8"/>
              <stop offset="100%" stop-color="#a8b5a0"/>
            </linearGradient>
            <linearGradient id="parlorLightRay" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#f7f2ec" stop-opacity=".28"/>
              <stop offset="100%" stop-color="#f7f2ec" stop-opacity="0"/>
            </linearGradient>
            <radialGradient id="parlorFloorShade" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stop-color="#d6c4ae"/>
              <stop offset="100%" stop-color="#b89a82"/>
            </radialGradient>
            <clipPath id="parlorFloorClip">
              <polygon points="152,324 400,180 648,324 400,468"/>
            </clipPath>
          </defs>

          <polygon points="152,324 400,180 648,324 400,468" class="parlor-floor"/>
          <path d="M220 360 L400 256 L580 360" fill="none" stroke="#a8927c" stroke-width="1" opacity=".22"/>
          <path d="M260 390 L400 308 L540 390" fill="none" stroke="#a8927c" stroke-width="1" opacity=".18"/>

          <polygon points="152,324 400,180 400,4 152,148" class="parlor-wall parlor-wall--left"/>
          <polygon points="648,324 400,180 400,4 648,148" class="parlor-wall parlor-wall--right"/>

          <!-- Wainscot on the lower walls only (up from the floor junction) -->
          <polygon points="152,324 400,180 400,132 152,276" class="parlor-wainscot"/>
          <polygon points="648,324 400,180 400,132 648,276" class="parlor-wainscot parlor-wainscot--right"/>
          <path d="M152 324L400 180L648 324" class="parlor-trim parlor-trim--base"/>
          <path d="M152 276L400 132L648 276" class="parlor-trim parlor-trim--rail"/>
          <path d="M152 148L400 4L648 148" class="parlor-trim parlor-trim--cornice"/>

          <polygon points="492,90 590,148 510,360 380,300" class="parlor-light-ray" opacity=".3"/>

          <!-- Painting — left wall, clear of the chair -->
          <g class="parlor-decor parlor-frame" aria-hidden="true">
            <polygon points="188,248 214,232 214,264 188,280" fill="#cbb09a" stroke="#5c534c" stroke-width="1.5"/>
            <polygon points="192,252 210,242 210,260 192,270" fill="#d8cec6"/>
          </g>

          <g clip-path="url(#parlorFloorClip)">
            <!-- Isometric square: equal opposite sides -->
            <polygon points="400,282 474,324 400,366 326,324" class="parlor-rug"/>
            <path d="M400 295 L455 324 L400 353 L345 324 Z" fill="none" stroke="#f3ece4" stroke-width="3.5" opacity=".75"/>
          </g>
          <!-- Window -->
          <g class="parlor-object parlor-window">
            <polygon points="494,82 592,140 592,246 494,188" fill="#cbb09a" stroke="#5c534c" stroke-width="2"/>
            <polygon points="500,90 586,144 586,238 500,184" fill="url(#parlorSkyGrad)"/>
            <polygon points="500,168 586,210 586,238 500,184" class="parlor-window-view"/>
            <line x1="543" y1="116" x2="543" y2="210" stroke="#f3ece4" stroke-width="3"/>
            <line x1="500" y1="138" x2="586" y2="190" stroke="#f3ece4" stroke-width="3"/>
            <g class="parlor-curtain parlor-curtain--left">
              <polygon points="480,78 494,82 494,188 478,182" class="parlor-curtain-fill"/>
            </g>
            <g class="parlor-curtain parlor-curtain--right">
              <polygon points="592,140 606,148 606,242 592,246" class="parlor-curtain-fill"/>
            </g>
          </g>

          <!-- Armchair — faces the vanity (seat opens right) -->
          <g class="parlor-object parlor-chair">
            <polygon points="218,238 246,222 246,276 218,292" class="parlor-upholstery" stroke="var(--room-ink)" stroke-width="1.6"/>
            <polygon points="218,292 246,276 280,296 252,312" class="parlor-upholstery-rose" stroke="var(--room-ink)" stroke-width="1.6"/>
            <line x1="218" y1="292" x2="216" y2="340" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="246" y1="276" x2="248" y2="324" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="252" y1="312" x2="250" y2="358" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="280" y1="296" x2="282" y2="342" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
          </g>

          <!-- Vanity: box + 4 legs from bottom corners -->
          <g class="parlor-object parlor-vanity">
            <polygon points="372,278 430,246 472,272 414,304" class="room-furn room-furn--wood-mid"/>
            <polygon points="414,304 472,272 472,296 414,328" class="room-furn room-furn--wood"/>
            <polygon points="372,278 414,304 414,328 372,302" class="room-furn room-furn--wood-deep"/>
            <circle cx="392" cy="308" r="3" class="parlor-gold" stroke="var(--room-ink)" stroke-width="1.2"/>
            <line x1="372" y1="302" x2="370" y2="346" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="414" y1="328" x2="412" y2="372" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="472" y1="296" x2="474" y2="340" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="430" y1="270" x2="432" y2="314" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <ellipse cx="414" cy="248" rx="24" ry="30" class="parlor-gold" stroke="var(--room-ink)" stroke-width="1.8"/>
            <ellipse cx="414" cy="248" rx="16" ry="20" class="parlor-mirror"/>
          </g>

          <!-- Rocking chair — planted on the right floor, facing the vanity -->
          <g class="parlor-object parlor-rocker">
            <polygon points="548,290 520,274 520,328 548,344" class="parlor-upholstery-rose" stroke="var(--room-ink)" stroke-width="1.6"/>
            <polygon points="548,344 520,328 486,348 514,364" class="parlor-upholstery" stroke="var(--room-ink)" stroke-width="1.6"/>
            <line x1="548" y1="344" x2="550" y2="378" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="520" y1="328" x2="518" y2="362" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="514" y1="364" x2="516" y2="398" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <line x1="486" y1="348" x2="484" y2="382" stroke="var(--room-ink)" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M484 382 Q517 400 550 378" fill="none" stroke="var(--room-ink)" stroke-width="3" stroke-linecap="round"/>
          </g>

          <g class="room-captions"></g>
        </svg>
      </div>`;

    const svg = stage.querySelector('svg');
    const plans = [
      { selector: '.parlor-chair', label: [245, 370] },
      { selector: '.parlor-vanity', label: [420, 390] },
      { selector: '.parlor-rocker', label: [520, 420] },
      { selector: '.parlor-window', label: [545, 276] },
    ];
    const buttons = [];
    const captions = new Map();

    function svgEl(name, attrs = {}) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      return el;
    }

    const panel = document.createElement('aside');
    panel.className = 'room-panel parlor-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-label', 'Collection artwork');
    panel.innerHTML = `<div class="room-panel__head parlor-panel__head"><div><h2 class="room-panel__title"></h2><p class="room-panel__meta"></p></div><button class="room-panel__close" type="button" aria-label="Close collection">×</button></div><div class="room-panel__body"></div>`;
    const panelTitle = panel.querySelector('.room-panel__title');
    const panelMeta = panel.querySelector('.room-panel__meta');
    const panelBody = panel.querySelector('.room-panel__body');

    function closePanel() {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      buttons.forEach((button) => {
        button.classList.remove('is-active');
        button.setAttribute('aria-expanded', 'false');
        captions.get(button)?.classList.remove('is-visible');
      });
    }

    function openCollection(collection, collectionIndex, activeButton) {
      buttons.forEach((button) => {
        const active = button === activeButton;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-expanded', String(active));
        captions.get(button)?.classList.toggle('is-visible', active);
      });
      panelTitle.textContent = collection.name;
      panelTitle.dataset.textId = `collection.${collectionIndex}`;
      panelTitle.dataset.textRole = 'collection.title';
      panelTitle.dataset.textFallback = collection.name;
      panelMeta.textContent = `${collection.images.length} ${collection.images.length === 1 ? 'work' : 'works'}`;
      panelBody.replaceChildren();
      if (collection.images.length) {
        const grid = document.createElement('div');
        grid.className = 'room-panel__grid';
        collection.images.forEach((image, workIndex) => grid.appendChild(helpers.workTile(image, {
          className: 'room-work parlor-work',
          alt: `Artwork ${workIndex + 1} from ${collection.name}`,
          collectionIndex,
          workIndex,
        })));
        panelBody.appendChild(grid);
      } else {
        panelBody.innerHTML = '<p class="room-panel__empty">This collection is waiting for artwork.</p>';
      }
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      panel.querySelector('.room-panel__close').focus({ preventScroll: true });
    }

    collections.slice(0, plans.length).forEach((collection, index) => {
      const plan = plans[index];
      const collectionIndex = collection.originalIndex ?? index;
      const object = svg.querySelector(plan.selector);
      object.classList.add('room-hotspot', 'generated-collection', 'parlor-hotspot');
      object.setAttribute('role', 'button');
      object.setAttribute('tabindex', '0');
      object.setAttribute('aria-label', `Open ${collection.name} collection`);
      object.setAttribute('aria-expanded', 'false');
      object.dataset.collectionIndex = String(collectionIndex);
      object.dataset.modelKind = 'collection';
      object.dataset.modelPath = `collections.${collectionIndex}`;
      const caption = svgEl('g', { class: 'room-caption', 'aria-hidden': 'true' });
      const label = collection.name.length > 22 ? `${collection.name.slice(0, 20)}…` : collection.name;
      caption.append(
        svgEl('rect', { x: plan.label[0] - 58, y: plan.label[1] - 14, width: 116, height: 22, rx: 11, class: 'room-hotspot__caption-bg parlor-caption-bg' }),
        svgEl('text', { x: plan.label[0], y: plan.label[1] + 2, 'text-anchor': 'middle', class: 'room-hotspot__caption' }),
      );
      caption.lastChild.textContent = label;
      svg.querySelector('.room-captions').appendChild(caption);
      captions.set(object, caption);
      const activate = () => openCollection(collection, collectionIndex, object);
      object.addEventListener('click', activate);
      object.addEventListener('pointerenter', () => caption.classList.add('is-visible'));
      object.addEventListener('pointerleave', () => { if (!object.classList.contains('is-active')) caption.classList.remove('is-visible'); });
      object.addEventListener('focus', () => caption.classList.add('is-visible'));
      object.addEventListener('blur', () => { if (!object.classList.contains('is-active')) caption.classList.remove('is-visible'); });
      object.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
      buttons.push(object);
    });

    plans.forEach((plan, index) => {
      if (index >= collections.length) {
        svg.querySelector(plan.selector)?.classList.add('parlor-ambient');
      }
    });

    if (!collections.length) {
      const empty = document.createElement('p');
      empty.className = 'room-empty';
      empty.textContent = 'Add a collection to furnish this parlor.';
      stage.appendChild(empty);
    }
    panel.querySelector('.room-panel__close').addEventListener('click', closePanel);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
    });
    shell.append(stage, panel);
    root.appendChild(shell);
  },
};
