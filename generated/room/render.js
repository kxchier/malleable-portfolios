window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts.room = {
  mount(root, ctx) {
    const { collections, helpers } = ctx;

    // Shared isometric grid: u = back→right, v = back→left
    const F = [400, 468];
    const R = [648, 324];
    const B = [400, 180];
    const L = [152, 324];
    const wallH = 176;
    const LT = [L[0], L[1] - wallH];
    const BT = [B[0], B[1] - wallH];
    const RT = [R[0], R[1] - wallH];

    // Original studio pieces (not tied to any reference sketch)
    const furniturePlan = [
      { kind: 'bookshelf', u0: 0.04, v0: 0.10, u1: 0.28, v1: 0.42, h: 128 },
      { kind: 'easel', u0: 0.34, v0: 0.18, u1: 0.52, v1: 0.40, h: 96 },
      { kind: 'plant', u0: 0.70, v0: 0.12, u1: 0.86, v1: 0.28, h: 28 },
      { kind: 'table', u0: 0.48, v0: 0.52, u1: 0.82, v1: 0.82, topH: 8, legH: 30 },
    ];

    const shell = document.createElement('div');
    shell.className = 'room-root';

    const stage = document.createElement('section');
    stage.className = 'room-stage';
    stage.setAttribute('aria-label', 'Interactive studio room');

    const hint = document.createElement('p');
    hint.className = 'room-hint';
    hint.textContent = 'Click something in the room to browse a collection';
    stage.appendChild(hint);

    const scene = document.createElement('div');
    scene.className = 'room-scene';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'room-svg');
    svg.setAttribute('viewBox', '130 0 540 500');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Isometric studio room');

    function floorPt(u, v) {
      return [
        B[0] + (R[0] - B[0]) * u + (L[0] - B[0]) * v,
        B[1] + (R[1] - B[1]) * u + (L[1] - B[1]) * v,
      ];
    }

    function raise(p, h) {
      return [p[0], p[1] - h];
    }

    function wallRightPt(u, elev) {
      return [
        B[0] + (R[0] - B[0]) * u,
        B[1] + (R[1] - B[1]) * u - elev,
      ];
    }

    function wallLeftPt(v, elev) {
      return [
        B[0] + (L[0] - B[0]) * v,
        B[1] + (L[1] - B[1]) * v - elev,
      ];
    }

    function poly(points, className) {
      const el = document.createElementNS(svgNS, 'polygon');
      el.setAttribute('points', points.map((p) => `${p[0]},${p[1]}`).join(' '));
      if (className) el.setAttribute('class', className);
      return el;
    }

    function line(a, b, className) {
      const el = document.createElementNS(svgNS, 'line');
      el.setAttribute('x1', a[0]);
      el.setAttribute('y1', a[1]);
      el.setAttribute('x2', b[0]);
      el.setAttribute('y2', b[1]);
      if (className) el.setAttribute('class', className);
      return el;
    }

    function path(d, className) {
      const el = document.createElementNS(svgNS, 'path');
      el.setAttribute('d', d);
      if (className) el.setAttribute('class', className);
      return el;
    }

    function text(x, y, value, className) {
      const el = document.createElementNS(svgNS, 'text');
      el.setAttribute('x', x);
      el.setAttribute('y', y);
      el.setAttribute('text-anchor', 'middle');
      if (className) el.setAttribute('class', className);
      el.textContent = value;
      return el;
    }

    function rect(x, y, w, h, className, extra = {}) {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', x);
      el.setAttribute('y', y);
      el.setAttribute('width', w);
      el.setAttribute('height', h);
      if (className) el.setAttribute('class', className);
      Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    }

    function isoBox(u0, v0, u1, v1, h, faceClasses) {
      const b00 = floorPt(u0, v0);
      const b10 = floorPt(u1, v0);
      const b11 = floorPt(u1, v1);
      const b01 = floorPt(u0, v1);
      const t00 = raise(b00, h);
      const t10 = raise(b10, h);
      const t11 = raise(b11, h);
      const t01 = raise(b01, h);
      const g = document.createElementNS(svgNS, 'g');
      g.appendChild(poly([b01, b11, t11, t01], faceClasses.left || faceClasses.side));
      g.appendChild(poly([b10, b11, t11, t10], faceClasses.right || faceClasses.side));
      g.appendChild(poly([t00, t10, t11, t01], faceClasses.top));
      return { g, b00, b10, b11, b01, t00, t10, t11, t01 };
    }

    function liftGroup(g, amount) {
      [...g.querySelectorAll('polygon, line, path, rect')].forEach((el) => {
        if (el.tagName === 'polygon') {
          const pts = el.getAttribute('points').split(/\s+/).map((pair) => {
            const [x, y] = pair.split(',').map(Number);
            return `${x},${y - amount}`;
          });
          el.setAttribute('points', pts.join(' '));
        } else if (el.tagName === 'line') {
          el.setAttribute('y1', Number(el.getAttribute('y1')) - amount);
          el.setAttribute('y2', Number(el.getAttribute('y2')) - amount);
        } else if (el.tagName === 'rect') {
          el.setAttribute('y', Number(el.getAttribute('y')) - amount);
        }
      });
    }

    // ---- Room shell + décor ----
    const shellGroup = document.createElementNS(svgNS, 'g');
    shellGroup.append(
      poly([L, B, R, F], 'room-floor-fill room-shell'),
      poly([L, B, BT, LT], 'room-wall-left-fill room-shell'),
      poly([R, B, BT, RT], 'room-wall-right-fill room-shell'),
    );

    const grid = document.createElementNS(svgNS, 'g');
    grid.setAttribute('aria-hidden', 'true');
    for (let i = 1; i <= 4; i += 1) {
      const t = i / 5;
      grid.append(
        line(floorPt(t, 0), floorPt(t, 1), 'room-floor-grid'),
        line(floorPt(0, t), floorPt(1, t), 'room-floor-grid'),
      );
    }
    shellGroup.appendChild(grid);

    // Rug
    const rug = [
      floorPt(0.32, 0.42),
      floorPt(0.78, 0.42),
      floorPt(0.78, 0.88),
      floorPt(0.32, 0.88),
    ];
    shellGroup.appendChild(poly(rug, 'room-rug-fill room-shell'));

    // Window on right wall
    const win = [
      wallRightPt(0.22, 132),
      wallRightPt(0.58, 132),
      wallRightPt(0.58, 48),
      wallRightPt(0.22, 48),
    ];
    shellGroup.appendChild(poly(win, 'room-window-fill room-shell'));
    shellGroup.append(
      line(wallRightPt(0.40, 132), wallRightPt(0.40, 48), 'room-window-pane'),
      line(wallRightPt(0.22, 90), wallRightPt(0.58, 90), 'room-window-pane'),
    );

    // Soft left-wall picture lean (non-interactive décor)
    shellGroup.appendChild(poly(
      [wallLeftPt(0.55, 110), wallLeftPt(0.78, 110), wallLeftPt(0.78, 55), wallLeftPt(0.55, 55)],
      'room-furn room-furn--wood-deep',
    ));
    shellGroup.appendChild(poly(
      [wallLeftPt(0.58, 104), wallLeftPt(0.75, 104), wallLeftPt(0.75, 61), wallLeftPt(0.58, 61)],
      'room-furn room-furn--canvas',
    ));

    svg.appendChild(shellGroup);

    // ---- Furniture ----
    function drawBookshelf(plan) {
      const box = isoBox(plan.u0, plan.v0, plan.u1, plan.v1, plan.h, {
        left: 'room-furn room-furn--shelf-side',
        right: 'room-furn room-furn--shelf',
        top: 'room-furn room-furn--shelf-top',
      });
      // shelves
      [0.28, 0.52, 0.76].forEach((t) => {
        const a = raise(floorPt(plan.u0 + 0.02, plan.v1 - 0.01), plan.h * t);
        const b = raise(floorPt(plan.u1 - 0.02, plan.v1 - 0.01), plan.h * t);
        box.g.appendChild(line(a, b, 'room-furn room-furn--none'));
      });
      // books as spines across the shelf width (relative to this piece, not the room)
      const bookColors = ['room-furn--book-a', 'room-furn--book-b', 'room-furn--book-c', 'room-furn--book-d'];
      const span = plan.u1 - plan.u0;
      const placeBook = (along, width, y0, y1, color) => {
        const uA = plan.u0 + span * along;
        const uB = plan.u0 + span * Math.min(0.96, along + width);
        const v = plan.v1 - 0.012;
        box.g.appendChild(poly(
          [
            raise(floorPt(uA, v), plan.h * y0),
            raise(floorPt(uB, v), plan.h * y0),
            raise(floorPt(uB, v), plan.h * y1),
            raise(floorPt(uA, v), plan.h * y1),
          ],
          `room-furn ${color}`,
        ));
      };
      for (let i = 0; i < 4; i += 1) placeBook(0.08 + i * 0.22, 0.14, 0.56, 0.74, bookColors[i]);
      for (let i = 0; i < 3; i += 1) placeBook(0.12 + i * 0.26, 0.16, 0.32, 0.48, bookColors[(i + 1) % 4]);
      return box;
    }

    function drawEasel(plan) {
      const g = document.createElementNS(svgNS, 'g');
      const footL = floorPt(plan.u0 + 0.04, plan.v1 - 0.04);
      const footR = floorPt(plan.u1 - 0.04, plan.v1 - 0.04);
      const footB = floorPt((plan.u0 + plan.u1) / 2, plan.v0 + 0.06);
      const apex = raise(floorPt((plan.u0 + plan.u1) / 2, (plan.v0 + plan.v1) / 2), plan.h);
      g.append(
        line(footL, apex, 'room-furn room-furn--none'),
        line(footR, apex, 'room-furn room-furn--none'),
        line(footB, apex, 'room-furn room-furn--none'),
        line(footL, footR, 'room-furn room-furn--none'),
      );
      // canvas board
      const c0 = raise(floorPt(plan.u0 + 0.05, plan.v1 - 0.10), plan.h * 0.28);
      const c1 = raise(floorPt(plan.u1 - 0.05, plan.v1 - 0.10), plan.h * 0.28);
      const c2 = raise(floorPt(plan.u1 - 0.05, plan.v1 - 0.10), plan.h * 0.82);
      const c3 = raise(floorPt(plan.u0 + 0.05, plan.v1 - 0.10), plan.h * 0.82);
      g.append(
        poly([c0, c1, c2, c3], 'room-furn room-furn--wood-deep'),
        poly(
          [
            raise(floorPt(plan.u0 + 0.08, plan.v1 - 0.10), plan.h * 0.34),
            raise(floorPt(plan.u1 - 0.08, plan.v1 - 0.10), plan.h * 0.34),
            raise(floorPt(plan.u1 - 0.08, plan.v1 - 0.10), plan.h * 0.76),
            raise(floorPt(plan.u0 + 0.08, plan.v1 - 0.10), plan.h * 0.76),
          ],
          'room-furn room-furn--canvas',
        ),
      );
      const b01 = floorPt(plan.u0, plan.v1);
      const b11 = floorPt(plan.u1, plan.v1);
      const b10 = floorPt(plan.u1, plan.v0);
      const b00 = floorPt(plan.u0, plan.v0);
      return {
        g,
        b00,
        b10,
        b11,
        b01,
        t00: raise(b00, plan.h),
        t10: raise(b10, plan.h),
        t11: raise(b11, plan.h),
        t01: raise(b01, plan.h),
      };
    }

    function drawPlant(plan) {
      const pot = isoBox(plan.u0 + 0.04, plan.v0 + 0.04, plan.u1 - 0.04, plan.v1 - 0.04, plan.h, {
        left: 'room-furn room-furn--pot',
        right: 'room-furn room-furn--pot',
        top: 'room-furn room-furn--pot-rim',
      });
      const cx = (plan.u0 + plan.u1) / 2;
      const cy = (plan.v0 + plan.v1) / 2;
      const base = raise(floorPt(cx, cy), plan.h);
      // leafy blobs
      const leaves = [
        [0, -42, 22],
        [-16, -28, 18],
        [16, -30, 18],
        [-10, -18, 14],
        [12, -16, 14],
      ];
      leaves.forEach(([dx, dy, r], i) => {
        const el = document.createElementNS(svgNS, 'ellipse');
        el.setAttribute('cx', base[0] + dx);
        el.setAttribute('cy', base[1] + dy);
        el.setAttribute('rx', r);
        el.setAttribute('ry', r * 0.72);
        el.setAttribute('class', `room-furn ${i % 2 ? 'room-furn--plant-deep' : 'room-furn--plant'}`);
        pot.g.appendChild(el);
      });
      pot.g.appendChild(line(base, [base[0], base[1] - 36], 'room-furn room-furn--none'));
      return pot;
    }

    function drawTable(plan) {
      const g = document.createElementNS(svgNS, 'g');
      const legH = plan.legH;
      const topH = plan.topH;
      [
        [plan.u0 + 0.05, plan.v0 + 0.05],
        [plan.u1 - 0.05, plan.v0 + 0.05],
        [plan.u0 + 0.05, plan.v1 - 0.05],
        [plan.u1 - 0.05, plan.v1 - 0.05],
      ].forEach(([u, v]) => {
        const foot = floorPt(u, v);
        g.appendChild(line(foot, raise(foot, legH), 'room-furn room-furn--none'));
      });

      const desk = isoBox(plan.u0, plan.v0, plan.u1, plan.v1, topH, {
        left: 'room-furn room-furn--wood-deep',
        right: 'room-furn room-furn--wood',
        top: 'room-furn room-furn--wood-mid',
      });
      liftGroup(desk.g, legH);
      g.appendChild(desk.g);

      const surface = legH + topH;
      const uSpan = plan.u1 - plan.u0;
      const vSpan = plan.v1 - plan.v0;
      // single sheet, well inset on the desktop
      g.appendChild(poly(
        [
          raise(floorPt(plan.u0 + uSpan * 0.22, plan.v0 + vSpan * 0.28), surface + 1),
          raise(floorPt(plan.u0 + uSpan * 0.55, plan.v0 + vSpan * 0.28), surface + 1),
          raise(floorPt(plan.u0 + uSpan * 0.60, plan.v0 + vSpan * 0.62), surface + 1),
          raise(floorPt(plan.u0 + uSpan * 0.27, plan.v0 + vSpan * 0.62), surface + 1),
        ],
        'room-furn room-furn--paper',
      ));

      const b00 = floorPt(plan.u0, plan.v0);
      const b10 = floorPt(plan.u1, plan.v0);
      const b11 = floorPt(plan.u1, plan.v1);
      const b01 = floorPt(plan.u0, plan.v1);
      return {
        g,
        b00,
        b10,
        b11,
        b01,
        t00: raise(b00, surface),
        t10: raise(b10, surface),
        t11: raise(b11, surface),
        t01: raise(b01, surface),
      };
    }

    const drawers = {
      bookshelf: drawBookshelf,
      easel: drawEasel,
      plant: drawPlant,
      table: drawTable,
    };

    const furnitureLayer = document.createElementNS(svgNS, 'g');
    furnitureLayer.setAttribute('class', 'room-furniture');
    const captionsLayer = document.createElementNS(svgNS, 'g');
    captionsLayer.setAttribute('class', 'room-captions');
    svg.append(furnitureLayer, captionsLayer);

    const buttons = [];
    const captionByButton = new Map();

    collections.slice(0, furniturePlan.length).forEach((collection, index) => {
      const collectionIndex = collection.originalIndex ?? index;
      const plan = furniturePlan[index];
      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('class', `room-hotspot room-hotspot--${plan.kind} generated-collection`);
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.dataset.collectionIndex = String(collectionIndex);
      group.dataset.modelKind = 'collection';
      group.dataset.modelPath = `collections.${collectionIndex}`;
      group.dataset.collectionId = `collection_${collectionIndex}`;
      group.dataset.modelLabel = collection.name;
      group.setAttribute('aria-label', `Open ${collection.name} collection`);
      group.setAttribute('aria-expanded', 'false');

      const drawn = drawers[plan.kind](plan);
      let hitPts = [drawn.b01, drawn.b11, drawn.t11, drawn.t01, drawn.t00, drawn.t10, drawn.b10];
      if (plan.kind === 'easel') {
        // Wider hover target — the easel drawing is skinny
        hitPts = [
          floorPt(plan.u0 - 0.05, plan.v1 + 0.05),
          floorPt(plan.u1 + 0.05, plan.v1 + 0.05),
          raise(floorPt(plan.u1 + 0.05, plan.v0 - 0.04), plan.h + 10),
          raise(floorPt(plan.u0 - 0.05, plan.v0 - 0.04), plan.h + 10),
        ];
      }

      let captionAt;
      if (plan.kind === 'easel') {
        // Sit beside the easel so the desk doesn’t cover the label
        const leftX = Math.min(drawn.b00[0], drawn.b01[0], drawn.t00[0], drawn.t01[0]);
        const midY = (Math.min(drawn.t00[1], drawn.t11[1]) + Math.max(drawn.b01[1], drawn.b11[1])) / 2;
        captionAt = [leftX - 64, midY];
      } else {
        captionAt = [
          (drawn.b01[0] + drawn.b11[0]) / 2,
          Math.max(drawn.b01[1], drawn.b11[1]) + 24,
        ];
      }

      group.appendChild(poly(hitPts, 'room-hotspot__hit'));
      group.appendChild(drawn.g);

      const label = collection.name.length > 22 ? `${collection.name.slice(0, 20)}…` : collection.name;
      const captionGroup = document.createElementNS(svgNS, 'g');
      captionGroup.setAttribute('class', `room-caption room-caption--${plan.kind}`);
      captionGroup.setAttribute('aria-hidden', 'true');
      captionGroup.append(
        rect(captionAt[0] - 58, captionAt[1] - 12, 116, 20, 'room-hotspot__caption-bg', { rx: 10, ry: 10 }),
        text(captionAt[0], captionAt[1] + 3, label, 'room-hotspot__caption'),
      );
      captionsLayer.appendChild(captionGroup);
      captionByButton.set(group, captionGroup);

      const showCaption = () => captionGroup.classList.add('is-visible');
      const hideCaption = () => {
        if (!group.classList.contains('is-active')) captionGroup.classList.remove('is-visible');
      };

      const activate = () => openCollection(collection, collectionIndex, group);
      group.addEventListener('click', activate);
      group.addEventListener('pointerenter', showCaption);
      group.addEventListener('pointerleave', hideCaption);
      group.addEventListener('focus', showCaption);
      group.addEventListener('blur', hideCaption);
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });

      furnitureLayer.appendChild(group);
      buttons.push(group);
    });

    scene.appendChild(svg);
    stage.appendChild(scene);

    const panel = document.createElement('aside');
    panel.className = 'room-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-label', 'Collection artwork');

    const panelHead = document.createElement('div');
    panelHead.className = 'room-panel__head';
    const panelTitle = document.createElement('h2');
    panelTitle.className = 'room-panel__title';
    const panelMeta = document.createElement('p');
    panelMeta.className = 'room-panel__meta';
    const close = document.createElement('button');
    close.className = 'room-panel__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close collection');
    close.textContent = '×';
    panelHead.append(panelTitle, panelMeta, close);
    const panelBody = document.createElement('div');
    panelBody.className = 'room-panel__body';
    panel.append(panelHead, panelBody);

    if (!collections.length) {
      const empty = document.createElement('p');
      empty.className = 'room-empty';
      empty.textContent = 'Add a collection to furnish this room.';
      stage.appendChild(empty);
    }

    function openCollection(collection, collectionIndex, activeButton) {
      buttons.forEach((button) => {
        const active = button === activeButton;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-expanded', String(active));
        const caption = captionByButton.get(button);
        caption?.classList.toggle('is-visible', active);
      });
      panelTitle.textContent = collection.name;
      panelTitle.dataset.textId = `collection.${collectionIndex}`;
      panelTitle.dataset.textRole = 'collection.title';
      panelTitle.dataset.textFallback = collection.name;
      panelMeta.textContent = `${collection.images.length} ${collection.images.length === 1 ? 'work' : 'works'}`;
      panelBody.replaceChildren();
      const gridEl = document.createElement('div');
      gridEl.className = 'room-panel__grid';
      collection.images.forEach((image, workIndex) => {
        gridEl.appendChild(helpers.workTile(image, {
          className: 'room-work',
          alt: `Artwork ${workIndex + 1} from ${collection.name}`,
          collectionIndex,
          workIndex,
        }));
      });
      if (collection.images.length) panelBody.appendChild(gridEl);
      else {
        const empty = document.createElement('p');
        empty.className = 'room-panel__empty';
        empty.textContent = 'This collection is waiting for artwork.';
        panelBody.appendChild(empty);
      }
      shell.classList.add('room-panel-open');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      close.focus({ preventScroll: true });
    }

    function closePanel(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const active = buttons.find((button) => button.classList.contains('is-active'));
      shell.classList.remove('room-panel-open');
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      buttons.forEach((button) => {
        button.classList.remove('is-active');
        button.setAttribute('aria-expanded', 'false');
        captionByButton.get(button)?.classList.remove('is-visible');
      });
      try {
        active?.focus?.({ preventScroll: true });
      } catch {
        /* SVG focus can fail in some browsers */
      }
    }

    close.addEventListener('click', closePanel);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) closePanel(event);
    });

    shell.append(stage, panel);
    root.appendChild(shell);
  },
};
