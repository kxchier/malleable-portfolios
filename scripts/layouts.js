/** Built-in portfolio layouts and example AI prompts for each. */
window.PORTFOLIO_LAYOUTS = [
  {
    id: 1,
    key: 'grid',
    name: 'Grid',
    file: 'ver1.html',
    examplePrompt:
      'A clean responsive grid of square thumbnails, grouped by collection, with even spacing and chunky borders.',
  },
  {
    id: 2,
    key: 'clothesline',
    name: 'Clothesline',
    file: 'ver2.html',
    examplePrompt:
      'Horizontal scroll strips per collection, like prints clipped on a clothesline — peek and swipe sideways.',
  },
  {
    id: 3,
    key: 'desk',
    name: 'Desk',
    file: 'ver3.html',
    examplePrompt:
      'A scattered desk layout — prints loosely piled on a flat surface with slight tilts and soft overlaps.',
  },
];

window.getLayout = (id) => window.PORTFOLIO_LAYOUTS.find((l) => l.id === id);

const DESK_COLS = 3;
const DESK_PADDING = 24;
const DESK_TILE_SIZE = 220;
const DESK_ROTATION_SLACK = 28;

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

/** Compute desk surface size. Grid gap controls horizontal and vertical spacing between tiles. */
window.deskSurfaceLayout = (imageCount, surfaceWidth = 1100, gridGapPx = getGridGapPx()) => {
  const gap = Math.max(0, gridGapPx);
  const cols = surfaceWidth < 520 ? 2 : DESK_COLS;
  const rows = Math.ceil(imageCount / cols) || 1;
  const innerWidth = Math.max(240, surfaceWidth - DESK_PADDING * 2);
  const itemSize = Math.min(DESK_TILE_SIZE, Math.max(80, Math.floor(innerWidth / cols)));
  const contentHeight = rows * itemSize + (rows - 1) * gap;
  const height = DESK_PADDING * 2 + contentHeight + DESK_ROTATION_SLACK;
  const contentWidth = cols * itemSize + (cols - 1) * gap;

  return { cols, rows, itemSize, innerWidth, contentWidth, height, padding: DESK_PADDING, gap };
};

window.deskSurfaceMinHeight = (imageCount, surfaceWidth, gridGapPx) =>
  deskSurfaceLayout(imageCount, surfaceWidth, gridGapPx).height;

window.deskItemStyle = (index, layout) => {
  const { cols, itemSize, padding, gap } = layout;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rotations = [-5, 4, -3, 6, -2, 5, -4, 3];

  const rotate = `${rotations[index % rotations.length]}deg`;
  return {
    left: `${padding + col * (itemSize + gap)}px`,
    top: `${padding + row * (itemSize + gap)}px`,
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
