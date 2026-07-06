window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['signal_tower'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;

    // ── Root shell ──────────────────────────────────────────
    const shell = document.createElement('div');
    shell.className = 'st-root';

    // ── Console Header ──────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'st-header';

    const callsign = document.createElement('span');
    callsign.className = 'st-callsign';
    callsign.textContent = 'SIG-TWR';
    header.appendChild(callsign);

    const ptitle = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (ptitle) {
      ptitle.className = (ptitle.className || '') + ' st-title';
      header.appendChild(ptitle);
    } else {
      const t = document.createElement('span');
      t.className = 'st-title';
      t.textContent = 'Living Archive';
      header.appendChild(t);
    }

    // signal bars
    const bars = document.createElement('div');
    bars.className = 'st-signal-bars';
    for (let i = 0; i < 5; i++) { const s = document.createElement('span'); bars.appendChild(s); }
    header.appendChild(bars);

    // scanline
    const scan = document.createElement('div');
    scan.className = 'st-scanline';
    header.appendChild(scan);

    shell.appendChild(header);

    // frequency counter seed
    const freqBase = [88.7, 92.1, 97.4, 103.8, 106.2, 110.0];

    // ── Per-collection console rows ──────────────────────────
    collections.forEach((col, ci) => {
      const freq = freqBase[ci % freqBase.length];
      const colIdx = col.originalIndex !== undefined ? col.originalIndex : ci;

      // outer console row
      const row = document.createElement('div');
      row.className = 'st-console-row';
      row.setAttribute('data-col-index', colIdx);

      // ── Frequency bar (clickable header) ────────────────
      const freqBar = document.createElement('div');
      freqBar.className = 'st-freq-bar';
      freqBar.setAttribute('tabindex', '0');
      freqBar.setAttribute('role', 'button');
      freqBar.setAttribute('aria-expanded', 'false');

      // dial SVG
      const dialWrap = document.createElement('div');
      dialWrap.className = 'st-dial-wrap';
      if (assets && assets['dial.svg']) {
        dialWrap.innerHTML = assets['dial.svg'];
        const svg = dialWrap.querySelector('svg');
        if (svg) svg.className = 'st-dial-svg';
      } else {
        // fallback inline dial
        dialWrap.innerHTML = `<svg class="st-dial-svg" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="15" fill="var(--color-panel)" stroke="var(--color-accent)" stroke-width="1.5"/>
          <circle cx="18" cy="18" r="11" fill="none" stroke="var(--color-paper)" stroke-width="1"/>
          <circle cx="18" cy="18" r="3" fill="var(--color-accent)"/>
          <line x1="18" y1="18" x2="18" y2="6" stroke="var(--color-secondary)" stroke-width="2" stroke-linecap="round"/>
          <circle cx="18" cy="5" r="2" fill="var(--color-secondary)"/>
        </svg>`;
      }
      freqBar.appendChild(dialWrap);

      // editable collection title via collectionFrame later — for now label
      const freqLabel = document.createElement('span');
      freqLabel.className = 'st-freq-label';
      freqLabel.textContent = col.name || 'Channel';
      freqBar.appendChild(freqLabel);

      const freqNum = document.createElement('span');
      freqNum.className = 'st-freq-num';
      freqNum.textContent = freq.toFixed(1) + ' MHz';
      freqBar.appendChild(freqNum);

      // waveform SVG
      const wfWrap = document.createElement('div');
      if (assets && assets['waveform.svg']) {
        wfWrap.innerHTML = assets['waveform.svg'];
        const svg = wfWrap.querySelector('svg');
        if (svg) { svg.className = 'st-waveform'; }
      } else {
        // generate a simple waveform
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const x = i * 4;
          const y = 12 + Math.sin(i * 0.9 + ci * 1.3) * 10;
          pts.push(`${x},${y.toFixed(1)}`);
        }
        wfWrap.innerHTML = `<svg class="st-waveform" viewBox="0 0 64 24" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <polyline points="${pts.join(' ')}" fill="none" stroke="var(--color-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      }
      freqBar.appendChild(wfWrap);

      const btn = document.createElement('button');
      btn.className = 'st-intercept-btn';
      btn.textContent = 'INTERCEPT';
      btn.setAttribute('aria-label', 'Tune in to ' + (col.name || 'collection'));
      freqBar.appendChild(btn);

      row.appendChild(freqBar);

      // ── Static + Resolved panel ─────────────────────────
      const staticField = document.createElement('div');
      staticField.className = 'st-static-field';

      const staticInner = document.createElement('div');
      staticInner.className = 'st-static-inner';

      // static canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'st-static-canvas';
      canvas.width = 600;
      canvas.height = 160;
      staticInner.appendChild(canvas);

      // resolved band — use collectionFrame for editability on visible outer wrapper
      const section = helpers.collectionFrame(col, colIdx, { className: 'st-resolved-band', tagName: 'div' });

      // remove any auto-generated h2 from collectionFrame for frequency bar layout
      // (the title is already in freqLabel above; hide any duplicate h2)
      const autoH2 = section.querySelector('h2');
      if (autoH2) {
        autoH2.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;margin:0;padding:0;';
      }

      const collLabel = document.createElement('div');
      collLabel.className = 'st-collection-label';
      collLabel.textContent = '▶ TRANSMISSION RESOLVED — ' + (col.name || 'channel').toUpperCase();
      section.appendChild(collLabel);

      const grid = document.createElement('div');
      grid.className = 'st-work-grid';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'st-work',
          alt: (col.name || 'artwork') + ' ' + (wi + 1),
          collectionIndex: colIdx,
          workIndex: wi,
        });
        tile.setAttribute('data-canvas-draggable', 'true');
        grid.appendChild(tile);
      });

      section.appendChild(grid);
      staticInner.appendChild(section);
      staticField.appendChild(staticInner);
      row.appendChild(staticField);

      // ── Expand/collapse logic ────────────────────────────
      let staticAnim = null;
      let resolved = false;

      function drawStatic(cvs) {
        const ctx2 = cvs.getContext('2d');
        if (!ctx2) return;
        const w = cvs.width, h = cvs.height;
        const id = ctx2.createImageData(w, h);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const hot = Math.random() > 0.55;
          const v = hot ? 190 : 18;
          const alpha = Math.random() > 0.7 ? 175 : 55;
          d[i] = hot ? 112 : v;
          d[i+1] = hot ? 255 : v * 1.8;
          d[i+2] = hot ? 196 : v * 2.4;
          d[i+3] = alpha;
        }
        ctx2.putImageData(id, 0, 0);
      }

      function startStatic() {
        let frame = 0;
        function tick() {
          if (frame % 3 === 0) drawStatic(canvas);
          frame++;
          staticAnim = requestAnimationFrame(tick);
        }
        tick();
      }

      function stopStatic() {
        if (staticAnim) { cancelAnimationFrame(staticAnim); staticAnim = null; }
      }

      function openRow() {
        resolved = true;
        row.classList.add('resolved');
        freqBar.setAttribute('aria-expanded', 'true');
        btn.textContent = 'TUNED';
        bars.classList.add('active');
        startStatic();
        // measure and set height
        staticField.style.height = 'auto';
        const h = staticInner.scrollHeight;
        staticField.style.height = '0';
        requestAnimationFrame(() => {
          staticField.style.height = h + 'px';
        });
        // after transition stop static
        setTimeout(stopStatic, 1100);
      }

      function closeRow() {
        resolved = false;
        row.classList.remove('resolved');
        freqBar.setAttribute('aria-expanded', 'false');
        btn.textContent = 'INTERCEPT';
        const h = staticInner.scrollHeight;
        staticField.style.height = h + 'px';
        requestAnimationFrame(() => {
          staticField.style.height = '0';
        });
        stopStatic();
      }

      function toggle() {
        if (resolved) { closeRow(); } else { openRow(); }
      }

      freqBar.addEventListener('click', toggle);
      freqBar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });

      // transition end: remove explicit height so grid can reflow
      staticField.addEventListener('transitionend', () => {
        if (resolved) staticField.style.height = 'auto';
      });

      shell.appendChild(row);
    });

    // ── Footer ──────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'st-footer';
    footer.textContent = '— · · · —   LIVING ARCHIVE BROADCAST   — · · · —';
    shell.appendChild(footer);

    root.appendChild(shell);
  }
};
