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
        <svg class="room-svg parlor-svg" viewBox="90 0 620 500" role="img" aria-label="Pastel nineteenth-century French country parlor">
          <defs>
            <pattern id="parlorWallpaper" width="36" height="40" patternUnits="userSpaceOnUse">
              <rect width="36" height="40" fill="#f7ebf0"/>
              <path d="M18 6c-4 3.5-5 8-2.5 12.5C13 22 10 25 10 29c0 4 3.5 7 8 7s8-3 8-7c0-4-3-7-5.5-10.5C23 14 22 9.5 18 6z" fill="#e8c4d4" opacity=".85"/>
              <circle cx="18" cy="20" r="2.4" fill="#c9a0b4"/>
              <path d="M18 27v9M14.5 32.5l3.5-2.5 3.5 2.5" fill="none" stroke="#b9cdb4" stroke-width="1.2" stroke-linecap="round"/>
              <circle cx="8" cy="8" r="1.3" fill="#b9cdb4" opacity=".7"/>
              <circle cx="28" cy="34" r="1.3" fill="#b9cdb4" opacity=".7"/>
            </pattern>
            <pattern id="parlorRugFloral" width="28" height="24" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="12" r="3.2" fill="#e2bfd0" opacity=".55"/>
              <circle cx="14" cy="12" r="1.2" fill="#b9cdb4" opacity=".7"/>
              <circle cx="4" cy="4" r="1.5" fill="#dce8d5" opacity=".5"/>
              <circle cx="24" cy="20" r="1.5" fill="#dce8d5" opacity=".5"/>
            </pattern>
            <linearGradient id="parlorSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#d4eaf3"/>
              <stop offset="55%" stop-color="#c5dceb"/>
              <stop offset="100%" stop-color="#b8d1ad"/>
            </linearGradient>
            <linearGradient id="parlorLightRay" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#fff8e8" stop-opacity=".35"/>
              <stop offset="100%" stop-color="#fff8e8" stop-opacity="0"/>
            </linearGradient>
            <radialGradient id="parlorFloorShade" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stop-color="#e6d2ba"/>
              <stop offset="55%" stop-color="#d4b896"/>
              <stop offset="100%" stop-color="#b89574"/>
            </radialGradient>
            <filter id="parlorSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- Floor -->
          <polygon points="152,324 400,180 648,324 400,468" class="parlor-floor"/>
          <path d="M220 360 L400 256 L580 360" fill="none" stroke="#b99b80" stroke-width="1" opacity=".28"/>
          <path d="M190 340 L400 220 L610 340" fill="none" stroke="#b99b80" stroke-width="1" opacity=".2"/>
          <path d="M260 390 L400 308 L540 390" fill="none" stroke="#b99b80" stroke-width="1" opacity=".22"/>
          <path d="M300 410 L400 352 L500 410" fill="none" stroke="#b99b80" stroke-width="1" opacity=".16"/>

          <!-- Walls -->
          <polygon points="152,324 400,180 400,4 152,148" class="parlor-wall parlor-wall--left"/>
          <polygon points="648,324 400,180 400,4 648,148" class="parlor-wall parlor-wall--right"/>

          <!-- Wainscoting (lower third of walls only) -->
          <polygon points="152,324 400,180 400,232 152,376" class="parlor-wainscot"/>
          <polygon points="648,324 400,180 400,232 648,376" class="parlor-wainscot parlor-wainscot--right"/>
          <path d="M152 324L400 180L648 324" class="parlor-trim parlor-trim--base"/>
          <path d="M152 282L400 138L648 282" class="parlor-trim parlor-trim--rail"/>
          <path d="M152 148L400 4L648 148" class="parlor-trim parlor-trim--cornice"/>

          <!-- Soft light from window -->
          <polygon points="492,90 590,148 520,380 380,310" class="parlor-light-ray" opacity=".4"/>

          <!-- Left wall: decorative frame (ambient) -->
          <g class="parlor-decor parlor-frame" aria-hidden="true">
            <polygon points="208,92 280,50 280,152 208,194" fill="#c9a58d" stroke="#5f5362" stroke-width="2"/>
            <polygon points="214,98 274,60 274,144 214,182" fill="#fffaf2" stroke="#9f7d72" stroke-width="1.5"/>
            <polygon points="220,104 268,72 268,136 220,168" fill="#e5cfc0"/>
            <ellipse cx="238" cy="122" rx="10" ry="14" fill="#c9d9c8" opacity=".75"/>
            <ellipse cx="250" cy="128" rx="7" ry="10" fill="#dfbcc8" opacity=".8"/>
            <path d="M230 145 Q244 132 258 148" fill="none" stroke="#b786a4" stroke-width="1.8" opacity=".7"/>
          </g>

          <!-- Rug -->
          <polygon points="248,368 400,282 556,372 402,458" class="parlor-rug"/>
          <polygon points="268,368 400,298 536,370 402,440" class="parlor-rug-inner"/>
          <path d="M284 368L400 310L520 368L402 428Z" fill="none" stroke="#fff5e9" stroke-width="5" opacity=".9"/>

          <!-- Side table + flowers (ambient) -->
          <g class="parlor-decor parlor-sidetable" aria-hidden="true">
            <polygon points="175,300 215,277 245,294 205,318" class="room-furn room-furn--wood-mid"/>
            <polygon points="205,318 245,294 245,318 205,342" class="room-furn room-furn--wood"/>
            <polygon points="175,300 205,318 205,342 175,324" class="room-furn room-furn--wood-deep"/>
            <line x1="182" y1="328" x2="178" y2="368" class="room-furn room-furn--none"/>
            <line x1="238" y1="312" x2="242" y2="348" class="room-furn room-furn--none"/>
            <ellipse cx="210" cy="288" rx="7" ry="5" fill="#dce8d5" stroke="#5f5362" stroke-width="1.2"/>
            <path d="M210 283 Q200 260 208 248 Q214 258 218 248 Q222 262 210 283" class="parlor-leaf"/>
            <circle cx="204" cy="252" r="4" class="parlor-floral"/>
            <circle cx="214" cy="246" r="3.5" fill="#e8c4d4"/>
            <circle cx="220" cy="254" r="3" class="parlor-floral"/>
          </g>

          <!-- Window (hotspot) -->
          <g class="parlor-object parlor-window">
            <polygon points="488,72 598,136 598,258 488,194" class="parlor-window-frame" stroke="#5f5362" stroke-width="3.5"/>
            <polygon points="494,80 592,140 592,250 494,190" fill="url(#parlorSkyGrad)"/>
            <!-- countryside hills -->
            <path d="M494 175 Q530 155 560 168 Q580 178 592 172 L592 250 L494 190Z" class="parlor-window-view"/>
            <ellipse cx="545" cy="118" rx="18" ry="10" fill="#fffaf2" opacity=".75" class="parlor-cloud"/>
            <line x1="543" y1="110" x2="543" y2="220" stroke="#fffaf2" stroke-width="5"/>
            <line x1="494" y1="135" x2="592" y2="192" stroke="#fffaf2" stroke-width="5"/>
            <g class="parlor-curtain parlor-curtain--left">
              <path d="M476 64 Q502 100 484 200 Q472 228 486 252 L508 228 Q494 140 512 84Z" class="parlor-curtain-fill"/>
              <path d="M490 90 Q498 140 492 200" fill="none" stroke="#d4a8b8" stroke-width="1.5" opacity=".5"/>
            </g>
            <g class="parlor-curtain parlor-curtain--right">
              <path d="M610 138 Q592 168 608 248 L588 252 Q596 190 582 124Z" class="parlor-curtain-fill"/>
            </g>
            <!-- sill -->
            <polygon points="482,194 598,258 610,250 494,186" fill="#dfc5ad" stroke="#5f5362" stroke-width="1.5"/>
          </g>

          <!-- Armchair (hotspot) -->
          <g class="parlor-object parlor-chair">
            <!-- back -->
            <path d="M198 285 Q185 230 215 208 Q255 218 272 262 L268 318 L210 348Z" class="room-furn parlor-upholstery"/>
            <!-- back cushion detail -->
            <path d="M210 235 Q232 218 255 242 L258 280 L218 300Z" fill="#dce8d5" stroke="#5f5362" stroke-width="1.8"/>
            <!-- seat -->
            <polygon points="208,300 262,272 295,290 240,322" class="room-furn parlor-upholstery-rose"/>
            <!-- arm -->
            <path d="M268 270 Q290 268 298 292 Q285 305 270 300Z" class="room-furn parlor-upholstery"/>
            <!-- legs -->
            <line x1="216" y1="318" x2="208" y2="362" class="room-furn room-furn--none" stroke-width="3"/>
            <line x1="285" y1="298" x2="292" y2="338" class="room-furn room-furn--none" stroke-width="3"/>
            <line x1="238" y1="328" x2="234" y2="368" class="room-furn room-furn--none" stroke-width="2.5"/>
            <!-- floral tufts -->
            <circle cx="230" cy="258" r="4.5" class="parlor-floral"/>
            <circle cx="244" cy="250" r="3.5" fill="#e8c4d4"/>
            <circle cx="238" cy="268" r="3" class="parlor-floral"/>
            <!-- skirt fringe hint -->
            <path d="M215 315 Q235 325 255 308" fill="none" stroke="#b786a4" stroke-width="2" opacity=".45"/>
          </g>

          <!-- Vanity (hotspot) -->
          <g class="parlor-object parlor-vanity">
            <!-- table body first so mirror sits on top -->
            <polygon points="348,278 430,232 478,260 394,308" class="room-furn room-furn--wood-mid"/>
            <polygon points="394,308 478,260 478,292 394,340" class="room-furn room-furn--wood"/>
            <polygon points="348,278 394,308 394,340 348,310" class="room-furn room-furn--wood-deep"/>
            <path d="M358 296 L390 320" fill="none" stroke="#9f7d72" stroke-width="1.5" opacity=".45"/>
            <circle cx="376" cy="310" r="2.8" fill="#d3b77b" stroke="#5f5362" stroke-width="1"/>
            <line x1="358" y1="320" x2="352" y2="368" class="room-furn room-furn--none" stroke-width="3"/>
            <line x1="468" y1="288" x2="474" y2="336" class="room-furn room-furn--none" stroke-width="3"/>
            <!-- mirror rising from table -->
            <line x1="400" y1="248" x2="400" y2="268" stroke="#c9a58d" stroke-width="4" stroke-linecap="round"/>
            <ellipse cx="400" cy="188" rx="46" ry="60" class="parlor-gold" stroke="#5f5362" stroke-width="3.5"/>
            <ellipse cx="400" cy="188" rx="37" ry="50" class="parlor-mirror" stroke="#fffaf2" stroke-width="3.5"/>
            <ellipse cx="390" cy="175" rx="12" ry="24" fill="#fffaf2" opacity=".32"/>
            <path d="M382 130 Q400 116 418 130" fill="none" stroke="#d3b77b" stroke-width="2.8"/>
            <circle cx="400" cy="126" r="3.5" class="parlor-gold" stroke="#5f5362" stroke-width="1.2"/>
            <!-- vanity top objects -->
            <ellipse cx="442" cy="258" rx="9" ry="5.5" class="parlor-porcelain" stroke="#5f5362" stroke-width="1.4"/>
            <path d="M442 252 Q442 242 445 242 Q447 242 447 248" fill="none" stroke="#b786a4" stroke-width="1.8"/>
            <path d="M372 286 Q396 272 418 286" fill="none" stroke="#b786a4" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M396 272 Q392 266 398 262 Q404 266 396 272" fill="#e8c4d4" stroke="#b786a4" stroke-width="1"/>
          </g>

          <!-- Rocking chair (hotspot) -->
          <g class="parlor-object parlor-rocker">
            <g class="parlor-rocker-body">
              <path d="M508 348 Q516 288 552 268 Q580 288 574 335 L552 375Z" class="room-furn parlor-upholstery-rose"/>
              <polygon points="502,348 552,318 590,340 538,372" class="room-furn parlor-upholstery"/>
              <path d="M548 305 Q568 302 572 322 Q560 332 548 328Z" fill="#d4e0d2" stroke="#5f5362" stroke-width="1.6"/>
              <line x1="510" y1="358" x2="498" y2="408" class="room-furn room-furn--none" stroke-width="3"/>
              <line x1="575" y1="350" x2="588" y2="392" class="room-furn room-furn--none" stroke-width="3"/>
              <path d="M482 412 Q540 438 602 396" fill="none" stroke="#5f5362" stroke-width="4.5" stroke-linecap="round"/>
              <path d="M492 398 Q544 418 592 386" fill="none" stroke="#9f7d72" stroke-width="5" stroke-linecap="round"/>
              <circle cx="545" cy="305" r="4" class="parlor-floral"/>
              <circle cx="556" cy="298" r="2.8" fill="#e8c4d4"/>
            </g>
          </g>

          <!-- Ceiling rose / soft chandelier hint (offset so it doesn't fuse with vanity) -->
          <g class="parlor-decor parlor-chandelier" aria-hidden="true">
            <line x1="318" y1="28" x2="318" y2="62" stroke="#c9a58d" stroke-width="1.5"/>
            <ellipse cx="318" cy="70" rx="18" ry="6" fill="#d3b77b" stroke="#5f5362" stroke-width="1.4" opacity=".85"/>
            <path d="M304 70 Q318 86 332 70" fill="none" stroke="#d3b77b" stroke-width="1.8"/>
            <circle cx="308" cy="74" r="2.5" fill="#fffaf2" stroke="#c9a58d" stroke-width="1" class="parlor-lamp-glow"/>
            <circle cx="318" cy="78" r="3" fill="#fffaf2" stroke="#c9a58d" stroke-width="1" class="parlor-lamp-glow"/>
            <circle cx="328" cy="74" r="2.5" fill="#fffaf2" stroke="#c9a58d" stroke-width="1" class="parlor-lamp-glow"/>
          </g>

          <g class="room-captions"></g>
        </svg>
      </div>`;

    const svg = stage.querySelector('svg');
    const plans = [
      { selector: '.parlor-chair', label: [235, 385] },
      { selector: '.parlor-vanity', label: [415, 395] },
      { selector: '.parlor-rocker', label: [550, 448] },
      { selector: '.parlor-window', label: [545, 278] },
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

    // Mark unused furniture as ambient so it doesn't look clickable
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
