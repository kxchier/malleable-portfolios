/** Safe, version-scoped content blocks created by the page-level assistant. */
window.PortfolioPageBlocks = (() => {
  function blocksFor(content, versionKey) {
    const blocks = content?.pageBlocks?.versions?.[versionKey];
    return Array.isArray(blocks) ? blocks : [];
  }

  function ensureStyles() {
    if (document.getElementById('portfolio-page-block-styles')) return;
    const style = document.createElement('style');
    style.id = 'portfolio-page-block-styles';
    style.textContent = `
      .portfolio-page-block {
        box-sizing: border-box;
        width: min(100% - 2rem, var(--page-block-max-width, 52rem));
        margin: 1.25rem auto;
        padding: .75rem 1rem;
        position: relative;
        z-index: 20;
        color: var(--color-primary);
        font-family: var(--font-body-family);
        font-size: var(--font-body);
        line-height: 1.55;
        text-align: var(--page-block-align, left);
      }
      .portfolio-page-block p { margin: 0; }
    `;
    document.head.appendChild(style);
  }

  function mount(root, content, versionKey) {
    if (!root) return;
    ensureStyles();
    root.querySelectorAll('[data-page-block-runtime="true"]').forEach((node) => node.remove());

    const before = [];
    const after = [];
    blocksFor(content, versionKey).forEach((block) => {
      if (!block || block.kind !== 'text' || !block.id) return;
      const wrapper = document.createElement('section');
      wrapper.className = 'portfolio-page-block portfolio-page-block--text';
      wrapper.dataset.pageBlockRuntime = 'true';
      wrapper.dataset.pageBlockId = block.id;
      wrapper.style.setProperty('--page-block-align', block.align || 'left');
      wrapper.style.setProperty('--page-block-max-width', block.width || '52rem');

      const text = document.createElement('p');
      const textId = `page-block.${block.id}`;
      text.dataset.textId = textId;
      text.dataset.textRole = 'body';
      text.dataset.textFallback = block.content || 'Write something…';
      text.dataset.modelKind = 'text';
      text.dataset.modelPath = `content.text.${textId}`;
      text.dataset.modelLabel = String(block.content || 'Text block').slice(0, 48);
      text.textContent = window.PortfolioContent?.getText(
        content,
        textId,
        block.content || 'Write something…',
        versionKey
      ) || block.content || 'Write something…';
      wrapper.appendChild(text);

      if (block.placement === 'after-content') after.push(wrapper);
      else before.push(wrapper);
    });

    before.reverse().forEach((block) => root.prepend(block));
    after.forEach((block) => root.append(block));
  }

  return { mount };
})();
