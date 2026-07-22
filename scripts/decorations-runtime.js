/** Shared decorative asset overlay for built-in and generated layouts. */
window.PortfolioDecorations = (() => {
  function ensureStyles() {
    if (document.getElementById('portfolio-decoration-styles')) return;
    const style = document.createElement('style');
    style.id = 'portfolio-decoration-styles';
    style.textContent = `
      .portfolio-decorations {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 8;
        overflow: hidden;
      }
      .portfolio-decoration {
        position: absolute;
        display: block;
        width: var(--decoration-size, 76px);
        height: var(--decoration-size, 76px);
        left: var(--decoration-x, 12%);
        top: var(--decoration-y, 12%);
        opacity: var(--decoration-opacity, 0.72);
        color: var(--color-accent);
        transform: translate(-50%, -50%) rotate(var(--decoration-rotate, 0deg));
        filter: drop-shadow(0 4px 14px color-mix(in srgb, var(--color-primary) 15%, transparent));
      }
      .portfolio-decoration img,
      .portfolio-decoration svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function decorationsFor(content, versionKey) {
    const all = Array.isArray(content?.decorations?.all) ? content.decorations.all : [];
    const version = Array.isArray(content?.decorations?.versions?.[versionKey])
      ? content.decorations.versions[versionKey]
      : [];
    return [...all, ...version];
  }

  function mount(root, content, versionKey) {
    if (!root) return;
    root.querySelectorAll(':scope > .portfolio-decorations').forEach((el) => el.remove());
    const decorations = decorationsFor(content, versionKey);
    if (!decorations.length) return;
    ensureStyles();

    const host = document.createElement('div');
    host.className = 'portfolio-decorations';
    host.setAttribute('aria-hidden', 'true');

    decorations.forEach((decoration) => {
      const src = String(decoration.src || '').trim();
      if (!src || !(/^(generated|layout-assets)\//.test(src) || /^data:image\/svg\+xml(?:;charset=utf-8)?,/i.test(src))) return;
      const item = document.createElement('span');
      item.className = 'portfolio-decoration';
      item.style.setProperty('--decoration-x', `${Number(decoration.x) || 12}%`);
      item.style.setProperty('--decoration-y', `${Number(decoration.y) || 12}%`);
      item.style.setProperty('--decoration-size', `${Math.max(24, Math.min(220, Number(decoration.size) || 76))}px`);
      item.style.setProperty('--decoration-rotate', `${Math.max(-45, Math.min(45, Number(decoration.rotate) || 0))}deg`);
      item.style.setProperty('--decoration-opacity', String(Math.max(0.12, Math.min(1, Number(decoration.opacity) || 0.72))));

      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.draggable = false;
      image.onerror = () => item.remove();
      item.appendChild(image);
      host.appendChild(item);
    });

    if (!host.children.length) return;
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.appendChild(host);
  }

  return { mount };
})();
