/** Browser helpers for portfolio layouts and desk positioning. */
window.PORTFOLIO_LAYOUTS = [];

window.getLayout = (id) => window.PORTFOLIO_LAYOUTS.find((l) => l.id === id);

function canUseLocalPortfolioApi() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
}

async function loadStaticLayoutRegistry() {
  const [builtins, generatedRegistry] = await Promise.all([
    fetch('./models/builtin-layouts.json').then((r) => (r.ok ? r.json() : [])),
    fetch('./generated/registry.json')
      .then((r) => (r.ok ? r.json() : { layouts: [] }))
      .catch(() => ({ layouts: [] })),
  ]);
  const participantId = window.PortfolioSupabase?.participantIdFromLocation?.() || '';
  const layouts = [
    ...(Array.isArray(builtins) ? builtins : []),
    ...(Array.isArray(generatedRegistry?.layouts) ? generatedRegistry.layouts : []),
  ].filter((layout) => !participantId || !layout.ownerParticipantId || layout.ownerParticipantId === participantId);
  const byId = new Map();
  layouts.forEach((layout) => byId.set(layout.id, layout));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

window.loadPortfolioLayouts = async function loadPortfolioLayouts() {
  if (canUseLocalPortfolioApi()) {
    try {
      const url = window.PortfolioSupabase?.portfolioApiUrl?.('/api/layouts') || '/api/layouts';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.layouts) && data.layouts.length) {
          window.PORTFOLIO_LAYOUTS = data.layouts;
        }
      }
    } catch {
      // Static hosts do not provide /api/layouts.
    }
  }
  if (!window.PORTFOLIO_LAYOUTS.length) {
    try {
      window.PORTFOLIO_LAYOUTS = await loadStaticLayoutRegistry();
    } catch {
      window.PORTFOLIO_LAYOUTS = [];
    }
  }
  window.getLayout = (id) => window.PORTFOLIO_LAYOUTS.find((l) => l.id === id);
  return window.PORTFOLIO_LAYOUTS;
};

const DESK_PADDING = 32;
const DESK_ROTATION_SLACK = 36;
const DESK_MAX_COLS = 8;

/** Small nudges for a casual desk feel — not enough to pile prints on each other. */
const DESK_SCATTER_X = [0, 10, -8, 12, -6, 9, -10, 7, 5, -7, 8, -5];
const DESK_SCATTER_Y = [0, 8, -6, 10, 5, -8, 7, -5, 9, -6, 4, -4];
const DESK_ROTATIONS = [-6, 5, -4, 7, -3, 5, -5, 3, -4, 4, -3, 6];

function deskSteps(itemSize, gap) {
  return {
    hStep: itemSize + gap * 0.55,
    vStep: itemSize + gap * 0.45,
    maxScatterX: Math.max(...DESK_SCATTER_X.map(Math.abs)),
    maxScatterY: Math.max(...DESK_SCATTER_Y.map(Math.abs)),
  };
}

/** Fit as many columns as the desk width allows (respecting art size + gap). */
function deskColumnCount(innerWidth, itemSize, gap, imageCount, surfaceWidth) {
  const { hStep, maxScatterX } = deskSteps(itemSize, gap);
  const maxFit = Math.max(1, Math.floor((innerWidth - itemSize - maxScatterX) / hStep) + 1);
  const capped = Math.min(DESK_MAX_COLS, maxFit);
  if (surfaceWidth < 520) {
    return Math.max(1, Math.min(imageCount, Math.min(capped, 3)));
  }
  return Math.max(1, Math.min(imageCount, capped));
}

/** Parse theme spacing values (px or rem) to pixels. */
window.parseSpacingPx = (value, rootPx = 16) => {
  const str = String(value ?? '').trim();
  if (!str) return 24;
  const n = parseFloat(str);
  if (str.endsWith('px')) return n;
  if (str.endsWith('rem')) return n * rootPx;
  return Number.isFinite(n) ? n : 24;
};

/** Read grid gap from the active --space-gridGap CSS variable. */
window.getGridGapPx = () => {
  if (typeof document === 'undefined') return 24;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--space-gridGap').trim();
  return parseSpacingPx(raw || '24px');
};

/** Read artwork thumbnail size from the active --space-artSize CSS variable. */
window.getArtSizePx = () => {
  if (typeof document === 'undefined') return 190;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--space-artSize').trim();
  return parseSpacingPx(raw || '190px');
};

/** Compute desk surface size. Grid gap controls horizontal and vertical spacing between tiles. */
window.deskSurfaceLayout = (imageCount, surfaceWidth = 1100, gridGapPx = getGridGapPx(), artSizePx = getArtSizePx()) => {
  const gap = Math.max(0, gridGapPx);
  const innerWidth = Math.max(240, surfaceWidth - DESK_PADDING * 2);
  const itemSize = Math.max(80, Math.min(artSizePx, innerWidth));
  const { hStep, vStep, maxScatterX, maxScatterY } = deskSteps(itemSize, gap);
  const cols = deskColumnCount(innerWidth, itemSize, gap, imageCount, surfaceWidth);
  const rows = Math.ceil(imageCount / cols) || 1;
  const contentWidth = (cols - 1) * hStep + itemSize + maxScatterX;
  const contentHeight = (rows - 1) * vStep + itemSize + maxScatterY;
  const layoutOffsetX = Math.max(0, (innerWidth - contentWidth) / 2);
  const height = DESK_PADDING * 2 + contentHeight + DESK_ROTATION_SLACK;

  return {
    cols,
    rows,
    itemSize,
    innerWidth,
    contentWidth,
    contentHeight,
    height,
    padding: DESK_PADDING,
    gap,
    hStep,
    vStep,
    maxScatterX,
    maxScatterY,
    layoutOffsetX,
  };
};

window.deskSurfaceMinHeight = (imageCount, surfaceWidth, gridGapPx) =>
  deskSurfaceLayout(imageCount, surfaceWidth, gridGapPx).height;

window.deskItemStyle = (index, layout) => {
  const { cols, itemSize, padding, hStep, vStep, layoutOffsetX = 0 } = layout;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const scatterX = DESK_SCATTER_X[index % DESK_SCATTER_X.length];
  const scatterY = DESK_SCATTER_Y[index % DESK_SCATTER_Y.length];
  const rotate = `${DESK_ROTATIONS[index % DESK_ROTATIONS.length]}deg`;

  return {
    left: `${padding + layoutOffsetX + col * hStep + scatterX}px`,
    top: `${padding + row * vStep + scatterY}px`,
    width: `${itemSize}px`,
    height: `${itemSize}px`,
    '--desk-rotate': rotate,
    transform: `rotate(${rotate})`,
    zIndex: String(index + 1),
  };
};

window.deskItemStyleAttr = (index, layout) => {
  const s = deskItemStyle(index, layout);
  return `left: ${s.left}; top: ${s.top}; width: ${s.width}; height: ${s.height}; --desk-rotate: ${s['--desk-rotate']}; transform: ${s.transform}; z-index: ${s.zIndex}`;
};

/** Fill a desk surface so every image in the collection fits inside. */
window.layoutDeskSurface = (surface, images) => {
  if (!images.length) {
    surface.style.minHeight = '120px';
    surface.style.height = '120px';
    surface.innerHTML = '';
    return;
  }

  const saved = typeof saveDeskPositions === 'function' ? saveDeskPositions(surface) : new Map();
  const fallbackWidth = Math.min(1152, window.innerWidth - 48);
  const width = surface.clientWidth || fallbackWidth;
  const layout = deskSurfaceLayout(images.length, width, getGridGapPx());

  surface.style.width = '100%';
  surface.style.minWidth = '';
  surface.style.height = `${layout.height}px`;
  surface.style.minHeight = `${layout.height}px`;
  surface.style.maxHeight = `${layout.height}px`;
  surface.style.overflow = 'hidden';
  surface.innerHTML = '';

  images.forEach((img, index) => {
    const item = document.createElement('div');
    item.className = 'desk-item';
    const style = deskItemStyle(index, layout);
    item.style.left = style.left;
    item.style.top = style.top;
    item.style.width = style.width;
    item.style.height = style.height;
    item.style.transform = style.transform;
    item.style.zIndex = style.zIndex;
    item.style.setProperty('--desk-rotate', style['--desk-rotate']);
    const savedPos = saved.get(img);
    if (savedPos) {
      item.style.left = savedPos.left;
      item.style.top = savedPos.top;
      if (savedPos.zIndex) item.style.zIndex = savedPos.zIndex;
      item.dataset.dragged = '1';
    }
    item.innerHTML = `<img src="${img}" alt="artwork" draggable="false" onerror="this.remove()">`;
    surface.appendChild(item);
  });

  if (typeof bindDeskDragging === 'function') {
    bindDeskDragging(surface);
  }
};
