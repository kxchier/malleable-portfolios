window.GeneratedLayouts = window.GeneratedLayouts || {};
window.GeneratedLayouts['dream_pages'] = {
  mount(root, ctx) {
    const { collections, helpers, assets } = ctx;
    const svgNode = (name) => {
      const source = assets && assets[name];
      if (!source) return null;
      const tmp = document.createElement('div');
      tmp.innerHTML = source;
      const svg = tmp.querySelector('svg');
      if (!svg) return null;
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      return svg;
    };
    const appendAsset = (parent, name, className, style = {}, text = '') => {
      const el = document.createElement(text ? 'span' : 'div');
      el.className = className;
      Object.assign(el.style, style);
      if (text) {
        el.textContent = text;
      } else {
        const svg = svgNode(name);
        if (!svg) return null;
        el.appendChild(svg);
      }
      parent.appendChild(el);
      return el;
    };

    // ── Watercolor wash background ──
    const wash = document.createElement('div');
    wash.className = 'dp-watercolor-wash';
    document.body.appendChild(wash);

    const collageField = document.createElement('div');
    collageField.className = 'dp-collage-field';
    [
      ['butterfly.svg', 'dp-collage-piece dp-collage-piece--butterfly', { top: '4%', left: '4%', width: '150px', transform: 'rotate(-18deg)' }],
      ['tiny-friend.svg', 'dp-collage-piece dp-collage-piece--friend', { top: '7%', left: '39%', width: '86px', transform: 'rotate(7deg)' }],
      ['butterfly.svg', 'dp-collage-piece dp-collage-piece--butterfly', { top: '7%', right: '7%', width: '128px', transform: 'rotate(18deg)' }],
      ['mushroom.svg', 'dp-collage-piece dp-collage-piece--mushroom', { top: '21%', right: '28%', width: '96px', transform: 'rotate(-7deg)' }],
      ['apple.svg', 'dp-collage-piece dp-collage-piece--apple', { top: '27%', left: '18%', width: '58px', transform: 'rotate(5deg)' }],
      ['sketch-star.svg', 'dp-collage-piece dp-collage-piece--star', { top: '34%', left: '5%', width: '82px', transform: 'rotate(-9deg)' }],
      ['flower.svg', 'dp-collage-piece dp-collage-piece--flower', { top: '41%', left: '47%', width: '132px', transform: 'rotate(12deg)' }],
      ['bow.svg', 'dp-collage-piece dp-collage-piece--bow', { top: '58%', right: '24%', width: '128px', transform: 'rotate(-4deg)' }],
      ['drink-cup.svg', 'dp-collage-piece dp-collage-piece--drink', { top: '62%', left: '5%', width: '150px', transform: 'rotate(-9deg)' }],
      ['flower.svg', 'dp-collage-piece dp-collage-piece--flower', { top: '73%', right: '8%', width: '160px', transform: 'rotate(16deg)' }],
      ['butterfly.svg', 'dp-collage-piece dp-collage-piece--butterfly', { top: '77%', right: '28%', width: '110px', transform: 'rotate(-16deg)' }],
    ].forEach(([name, className, style]) => appendAsset(collageField, name, className, style));
    [
      { text: 'you are home', top: '31%', left: '10%', transform: 'rotate(-6deg)' },
      { text: 'take care of yourself', top: '35%', left: '11%', transform: 'rotate(-5deg)' },
      { text: 'soft little archive', top: '69%', right: '11%', transform: 'rotate(8deg)' },
    ].forEach((note) => appendAsset(collageField, '', 'dp-hand-note', note, note.text));
    document.body.appendChild(collageField);

    const grain = document.createElement('div');
    grain.className = 'dp-paper-grain';
    document.body.appendChild(grain);

    // ── Floating motifs layer ──
    const motifsLayer = document.createElement('div');
    motifsLayer.className = 'dp-motifs-layer';

    const motifDefs = [
      { key: 'butterfly.svg',  cls: 'dp-butterfly', positions: [{top:'8%',left:'5%',size:74}, {top:'26%',right:'3%',size:54}, {top:'58%',left:'13%',size:48}, {top:'80%',right:'8%',size:68}] },
      { key: 'sparkle.svg',    cls: 'dp-sparkle',   positions: [{top:'5%',left:'28%',size:34}, {top:'18%',right:'22%',size:28}, {top:'38%',left:'31%',size:22}, {top:'45%',left:'56%',size:22}, {top:'70%',left:'65%',size:32}, {top:'88%',left:'35%',size:25}, {top:'55%',right:'15%',size:30}] },
      { key: 'sketch-star.svg', cls: 'dp-sketch-star', positions: [{top:'29%',left:'4%',size:62}, {top:'31%',left:'12%',size:42}, {top:'68%',right:'2%',size:54}] },
      { key: 'cloud.svg',      cls: 'dp-cloud',     positions: [{top:'3%',right:'14%',size:112}, {top:'50%',left:'2%',size:88}, {top:'74%',left:'30%',size:76}] },
      { key: 'flower.svg',     cls: 'dp-flower',    positions: [{top:'14%',left:'72%',size:56}, {top:'46%',left:'66%',size:78}, {top:'75%',left:'80%',size:52}, {top:'40%',left:'88%',size:45}] },
      { key: 'bow.svg',        cls: 'dp-bow',       positions: [{top:'58%',right:'26%',size:90}, {top:'77%',right:'36%',size:60}] },
      { key: 'mushroom.svg',   cls: 'dp-mushroom',  positions: [{top:'22%',right:'30%',size:70}] }
    ];

    motifDefs.forEach(def => {
      const svgSrc = assets && assets[def.key];
      if (!svgSrc) return;
      def.positions.forEach((pos, pi) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dp-motif ' + def.cls;
        const s = pos.size || 40;
        Object.assign(wrapper.style, {
          width: s + 'px',
          height: s + 'px',
          top:  pos.top    || 'auto',
          left: pos.left   || 'auto',
          right:pos.right  || 'auto',
          bottom:pos.bottom|| 'auto',
          animationDelay: (pi * 0.8) + 's'
        });
        const tmp = document.createElement('div');
        tmp.innerHTML = svgSrc;
        const svgEl = tmp.querySelector('svg');
        if (svgEl) {
          svgEl.setAttribute('width', '100%');
          svgEl.setAttribute('height', '100%');
          wrapper.appendChild(svgEl);
        }
        motifsLayer.appendChild(wrapper);
      });
    });

    document.body.appendChild(motifsLayer);

    // ── Page wrapper ──
    const page = document.createElement('div');
    page.className = 'dp-page';

    // ── Portfolio title area ──
    const titleDeco = document.createElement('div');
    titleDeco.className = 'dp-title-deco';
    if (assets && assets['sparkle.svg']) {
      const tmp = document.createElement('div');
      tmp.innerHTML = assets['sparkle.svg'];
      const s1 = tmp.querySelector('svg');
      if (s1) { s1.style.width='20px'; s1.style.height='20px'; s1.style.opacity='0.7'; titleDeco.appendChild(s1); }
    }
    if (assets && assets['flower.svg']) {
      const tmp2 = document.createElement('div');
      tmp2.innerHTML = assets['flower.svg'];
      const f1 = tmp2.querySelector('svg');
      if (f1) { f1.style.width='24px'; f1.style.height='24px'; f1.style.opacity='0.75'; titleDeco.appendChild(f1); }
    }
    if (assets && assets['sparkle.svg']) {
      const tmp3 = document.createElement('div');
      tmp3.innerHTML = assets['sparkle.svg'];
      const s2 = tmp3.querySelector('svg');
      if (s2) { s2.style.width='20px'; s2.style.height='20px'; s2.style.opacity='0.7'; titleDeco.appendChild(s2); }
    }
    page.appendChild(titleDeco);

    const titleEl = helpers.portfolioTitle ? helpers.portfolioTitle() : null;
    if (titleEl) {
      titleEl.className = (titleEl.className || '') + ' dp-portfolio-title';
      page.appendChild(titleEl);
    } else {
      const h1 = document.createElement('h1');
      h1.className = 'dp-portfolio-title';
      h1.dataset.textId = 'portfolio-title';
      h1.dataset.textRole = 'portfolio_title';
      h1.dataset.textFallback = 'Dream Pages';
      h1.textContent = 'Dream Pages';
      page.appendChild(h1);
    }

    // ── Collections ──
    collections.forEach((col, ci) => {
      const section = helpers.collectionSection(col, col.originalIndex);
      section.className = (section.className || '') + ' dp-collection vellum-collage-collection';
      section.style.animationDelay = (ci * 0.15) + 's';

      // Wrap the h2 inside a hand-drawn frame header
      const existingH2 = section.querySelector('h2');
      if (existingH2) {
        const headerWrap = document.createElement('div');
        headerWrap.className = 'dp-collection-header';
        existingH2.parentNode.insertBefore(headerWrap, existingH2);
        headerWrap.appendChild(existingH2);

        // add a tiny flower motif next to title
        if (assets && assets['flower.svg']) {
          const tmp = document.createElement('span');
          tmp.innerHTML = assets['flower.svg'];
          const fl = tmp.querySelector('svg');
          if (fl) {
            fl.style.width = '18px';
            fl.style.height = '18px';
            fl.style.verticalAlign = 'middle';
            fl.style.marginLeft = '8px';
            fl.style.opacity = '0.75';
            fl.style.display = 'inline-block';
            headerWrap.appendChild(fl);
          }
        }
      }

      // Scroll strip
      const strip = document.createElement('div');
      strip.className = 'dp-works-scroll images-scroll';

      col.images.forEach((img, wi) => {
        const tile = helpers.workTile(img, {
          className: 'dp-work',
          alt: col.name + ' work ' + (wi + 1),
          collectionIndex: col.originalIndex,
          workIndex: wi,
          fixedSize: false
        });
        tile.setAttribute('data-canvas-draggable', 'true');
        tile.style.setProperty('--dp-tilt', `${[-2.4, 1.6, -0.8, 2.7, -1.5][wi % 5]}deg`);

        // Wrap img in vellum mat
        const imgEl = tile.querySelector('img');
        if (imgEl) {
          const mat = document.createElement('div');
          mat.className = 'dp-vellum-mat';

          // washi tape pin
          const pin = document.createElement('div');
          pin.className = 'dp-pin';
          tile.appendChild(pin);

          imgEl.parentNode.insertBefore(mat, imgEl);
          mat.appendChild(imgEl);

          // corner decoration bottom-right
          const cornerBR = document.createElement('div');
          cornerBR.className = 'dp-corner-br';
          mat.appendChild(cornerBR);

          const tape = svgNode('washi-tape.svg');
          if (tape) {
            const tapeWrap = document.createElement('div');
            tapeWrap.className = 'dp-washi-strip';
            tapeWrap.appendChild(tape);
            tile.appendChild(tapeWrap);
          }
        }

        strip.appendChild(tile);
      });

      section.appendChild(strip);

      // Divider
      if (ci < collections.length - 1) {
        const divider = document.createElement('hr');
        divider.className = 'dp-divider';
        section.appendChild(divider);
      }

      page.appendChild(section);
    });

    root.appendChild(page);
  }
};
