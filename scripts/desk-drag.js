/** Pointer drag for freely positioned desk prints. */
window.saveDeskPositions = (surface) => {
  const saved = new Map();
  surface.querySelectorAll('.desk-item').forEach((item) => {
    const src = item.querySelector('img')?.getAttribute('src');
    if (src && item.dataset.dragged === '1') {
      saved.set(src, {
        left: item.style.left,
        top: item.style.top,
        zIndex: item.style.zIndex,
      });
    }
  });
  return saved;
};

window.bindDeskDragging = (surface) => {
  surface.querySelectorAll('.desk-item').forEach((item) => {
    item.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseFloat(item.style.left) || 0;
      const startTop = parseFloat(item.style.top) || 0;

      item.classList.add('desk-item--dragging');
      item.style.zIndex = '1000';

      const onMove = (ev) => {
        item.style.left = `${startLeft + ev.clientX - startX}px`;
        item.style.top = `${startTop + ev.clientY - startY}px`;
      };

      const onUp = () => {
        item.classList.remove('desk-item--dragging');
        item.dataset.dragged = '1';
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
  });
};
