/** Cursor-tied point-and-prompt assistant (edit mode iframe only). */
(function () {
  if (!document.body.dataset.editMode) return;
  if (window.__PORTFOLIO_CURSOR_ASSISTANT_READY__) return;
  window.__PORTFOLIO_CURSOR_ASSISTANT_READY__ = true;

  let bubble = null;
  let activeTarget = null;
  let activeElement = null;
  let mode = 'peek';

  function post(msg) {
    window.parent.postMessage({ source: 'portfolio-cursor-assistant', ...msg }, '*');
  }

  function targetFromElement(el) {
    const modelEl = el.closest('[data-model-kind]');
    const textEl = el.closest('[data-text-id]');
    if (textEl && (!modelEl || textEl.contains(el))) {
      const style = window.getComputedStyle(textEl);
      return {
        kind: 'text',
        id: textEl.dataset.textId,
        role: textEl.dataset.textRole,
        path: `content.text.${textEl.dataset.textId}`,
        label: textEl.dataset.textFallback || textEl.textContent.trim() || 'Text',
        currentStyle: {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textAlign: style.textAlign,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          opacity: style.opacity,
          transform: style.transform === 'none' ? '' : style.transform,
        },
      };
    }
    if (!modelEl) return null;
    const parentCollection = modelEl.dataset.modelKind === 'work'
      ? modelEl.parentElement?.closest('[data-model-kind="collection"]')
      : null;
    return {
      kind: modelEl.dataset.modelKind,
      path: modelEl.dataset.modelPath,
      label: modelEl.dataset.modelLabel || modelEl.getAttribute('aria-label') || modelEl.textContent.trim().slice(0, 48),
      collectionIndex: modelEl.dataset.collectionIndex,
      workIndex: modelEl.dataset.workIndex,
      collectionId: modelEl.dataset.collectionId,
      workId: modelEl.dataset.workId,
      presentationId: modelEl.dataset.presentationId || window.__PREVIEW_PRESENTATION_ID__,
      parentCollection: parentCollection ? {
        kind: 'collection',
        path: parentCollection.dataset.modelPath,
        label: parentCollection.dataset.modelLabel || parentCollection.getAttribute('aria-label') || parentCollection.textContent.trim().slice(0, 48),
        collectionIndex: parentCollection.dataset.collectionIndex,
        collectionId: parentCollection.dataset.collectionId,
        presentationId: parentCollection.dataset.presentationId || window.__PREVIEW_PRESENTATION_ID__,
      } : undefined,
    };
  }

  function targetTitle(target) {
    if (!target) return '';
    if (target.kind === 'text') return `Text: ${target.label}`;
    if (target.kind === 'collection') return `Collection: ${target.label}`;
    if (target.kind === 'work') return `Work: ${target.label}`;
    if (target.kind === 'presentation') return `View: ${window.__PREVIEW_PRESENTATION_ID__ || 'current'}`;
    return target.label || target.kind;
  }

  function scopeOptions(target) {
    if (target?.kind === 'text') {
      const options = [{ value: 'this', label: 'this text only' }];
      if (target.role === 'collection.title') {
        options.push({ value: 'role', label: 'all section titles' });
      }
      if (target.role === 'portfolio.title' || target.role === 'collection.title') {
        options.push({ value: 'all-headings', label: 'all headings' });
      }
      return options;
    }
    if (target?.kind === 'work') {
      return [
        { value: 'this', label: 'this image only' },
        { value: 'all-images', label: 'all images' },
      ];
    }
    if (target?.kind === 'collection') {
      return [
        { value: 'this', label: 'this section only' },
        { value: 'all-sections', label: 'all sections' },
      ];
    }
    return [{ value: 'this', label: 'this only' }];
  }

  function renderScopeOptions(target) {
    const scope = bubble.querySelector('.cursor-assistant-scope');
    scope.innerHTML = '';
    scopeOptions(target).forEach((option, index) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'cursor-scope';
      input.value = option.value;
      input.checked = index === 0;
      label.append(input, document.createTextNode(` ${option.label}`));
      scope.appendChild(label);
    });
    scope.hidden = scope.children.length <= 1;
  }

  function createBubble() {
    bubble = document.createElement('div');
    bubble.className = 'cursor-assistant';
    bubble.hidden = true;
    bubble.innerHTML = `
      <div class="cursor-assistant-title"></div>
      <div class="cursor-assistant-peek">
        <button type="button" class="cursor-assistant-open" aria-label="Ask AI to change this" title="Ask AI to change this">✦</button>
      </div>
      <form class="cursor-assistant-form" hidden>
        <textarea rows="2" placeholder="What should change here?"></textarea>
        <div class="cursor-assistant-scope"></div>
        <div class="cursor-assistant-actions">
          <button type="button" class="cursor-assistant-cancel">Cancel</button>
          <button type="submit">Propose</button>
        </div>
      </form>
      <div class="cursor-assistant-proposal" hidden>
        <p></p>
        <div class="cursor-assistant-actions">
          <button type="button" class="cursor-assistant-adjust">Adjust</button>
          <button type="button" class="cursor-assistant-apply">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(bubble);

    bubble.querySelector('.cursor-assistant-open').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPrompt();
    });

    bubble.querySelector('.cursor-assistant-cancel').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBubble();
    });

    bubble.querySelector('.cursor-assistant-adjust').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPrompt();
    });

    bubble.querySelector('.cursor-assistant-apply').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const op = bubble.__proposalOperation;
      if (!op) return;
      post({ type: 'apply', operation: op });
      hideBubble();
    });

    bubble.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const prompt = bubble.querySelector('textarea').value.trim();
      if (!prompt || !activeTarget) return;
      const scope = bubble.querySelector('input[name="cursor-scope"]:checked')?.value || 'this';
      bubble.classList.add('is-busy');
      post({
        type: 'request',
        target: activeTarget,
        prompt,
        scope,
        presentationId: window.__PREVIEW_PRESENTATION_ID__ || window.__EDIT_STATE__?.versionKey,
      });
    });

    bubble.addEventListener('pointerdown', (e) => e.stopPropagation());
    bubble.addEventListener('click', (e) => e.stopPropagation());
  }

  function positionBubbleFor(el, target) {
    const rect = el.getBoundingClientRect();
    const bubbleWidth = mode === 'peek' ? 34 : (bubble.offsetWidth || 280);
    const bubbleHeight = mode === 'peek' ? 34 : (bubble.offsetHeight || 120);
    let top = Math.max(8, rect.top + window.scrollY + Math.min(rect.height, 18));
    let left = Math.max(8, Math.min(window.innerWidth - bubbleWidth - 8, rect.left + window.scrollX + Math.min(rect.width, 28)));

    // Text already opens the direct-manip typography toolbar below the clicked
    // heading, so put the cursor assistant beside/above the text instead.
    if (target?.kind === 'text') {
      top = Math.max(8, rect.top + window.scrollY);
      left = rect.right + window.scrollX + 12;
      if (left + bubbleWidth > window.scrollX + window.innerWidth - 8) {
        left = rect.left + window.scrollX - bubbleWidth - 12;
      }
      if (left < window.scrollX + 8) {
        left = Math.max(8, rect.left + window.scrollX);
        top = Math.max(8, rect.top + window.scrollY - bubbleHeight - 12);
      }
    }

    if (mode === 'prompt' || mode === 'proposal') {
      top = rect.bottom + window.scrollY + 10;
      left = rect.left + window.scrollX;
      if (left + bubbleWidth > window.scrollX + window.innerWidth - 8) {
        left = window.scrollX + window.innerWidth - bubbleWidth - 8;
      }
      if (left < window.scrollX + 8) left = window.scrollX + 8;

      const viewportBottom = window.scrollY + window.innerHeight - 8;
      if (top + bubbleHeight > viewportBottom) {
        top = Math.max(window.scrollY + 8, rect.top + window.scrollY - bubbleHeight - 10);
      }
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  }

  function showPeek(el, target) {
    if (activeElement && activeElement !== el) {
      activeElement.classList.remove('cursor-assistant-target');
    }
    mode = 'peek';
    activeTarget = target;
    activeElement = el;
    activeElement.classList.add('cursor-assistant-target');
    bubble.hidden = false;
    bubble.classList.add('is-peek');
    bubble.classList.remove('is-busy');
    bubble.querySelector('.cursor-assistant-title').textContent = targetTitle(target);
    renderScopeOptions(target);
    bubble.querySelector('.cursor-assistant-peek').hidden = false;
    bubble.querySelector('.cursor-assistant-form').hidden = true;
    bubble.querySelector('.cursor-assistant-proposal').hidden = true;
    positionBubbleFor(el, target);
  }

  function openPrompt() {
    if (!activeTarget) return;
    mode = 'prompt';
    bubble.classList.remove('is-peek');
    document.dispatchEvent(new CustomEvent('cursor-assistant-open-prompt'));
    bubble.querySelector('.cursor-assistant-peek').hidden = true;
    bubble.querySelector('.cursor-assistant-form').hidden = false;
    bubble.querySelector('.cursor-assistant-proposal').hidden = true;
    if (activeElement) positionBubbleFor(activeElement, activeTarget);
    const textarea = bubble.querySelector('textarea');
    textarea.value = '';
    textarea.focus();
  }

  function showProposal(proposal) {
    mode = 'proposal';
    bubble.classList.remove('is-peek');
    bubble.classList.remove('is-busy');
    bubble.__proposalOperation = proposal.operation;
    bubble.querySelector('.cursor-assistant-peek').hidden = true;
    bubble.querySelector('.cursor-assistant-form').hidden = true;
    bubble.querySelector('.cursor-assistant-proposal').hidden = false;
    bubble.querySelector('.cursor-assistant-proposal p').textContent = proposal.message;
    if (activeElement) positionBubbleFor(activeElement, activeTarget);
  }

  function hideBubble() {
    mode = 'peek';
    activeTarget = null;
    if (activeElement) activeElement.classList.remove('cursor-assistant-target');
    activeElement = null;
    if (bubble) bubble.hidden = true;
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      [data-model-kind]:hover { outline: 1px dashed color-mix(in srgb, var(--color-accent) 45%, transparent); outline-offset: 3px; }
      .cursor-assistant-target { outline: 2px solid var(--color-accent) !important; outline-offset: 3px; }
      .cursor-assistant {
        --cursor-assistant-ink: #111111;
        --cursor-assistant-muted: #5f5f5f;
        --cursor-assistant-paper: #ffffff;
        --cursor-assistant-panel: #f7f5ef;
        --cursor-assistant-line: rgba(17, 17, 17, 0.22);
        --cursor-assistant-hover: #eee8dc;
        position: absolute;
        z-index: 2600;
        width: min(280px, calc(100vw - 16px));
        padding: 0.55rem;
        border: 1px solid var(--cursor-assistant-line);
        border-radius: 8px;
        background: var(--cursor-assistant-paper);
        color: var(--cursor-assistant-ink) !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
        font-family: system-ui, sans-serif;
        font-size: 0.78rem;
        line-height: 1.3;
      }
      .cursor-assistant,
      .cursor-assistant * {
        color: var(--cursor-assistant-ink) !important;
        text-shadow: none !important;
      }
      .cursor-assistant[hidden] { display: none; }
      .cursor-assistant.is-peek {
        width: auto;
        padding: 0;
        border: none;
        border-radius: 999px;
        background: transparent;
        box-shadow: none;
      }
      .cursor-assistant.is-peek .cursor-assistant-title { display: none; }
      .cursor-assistant.is-peek .cursor-assistant-open {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: 999px;
        border: 1px solid var(--cursor-assistant-line);
        background: var(--cursor-assistant-paper);
        color: var(--cursor-assistant-ink) !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        font-size: 1rem;
        line-height: 1;
      }
      .cursor-assistant.is-peek .cursor-assistant-open:hover {
        transform: translateY(-1px);
        background: var(--cursor-assistant-hover);
      }
      .cursor-assistant-title { font-weight: 700; margin-bottom: 0.35rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cursor-assistant button {
        border: 1px solid var(--cursor-assistant-line);
        border-radius: 5px;
        background: var(--cursor-assistant-panel);
        color: var(--cursor-assistant-ink) !important;
        cursor: pointer;
        font: inherit;
        font-weight: 650;
        padding: 0.28rem 0.45rem;
      }
      .cursor-assistant button:hover { background: var(--cursor-assistant-hover); }
      .cursor-assistant textarea {
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        border: 1px solid var(--cursor-assistant-line);
        border-radius: 6px;
        padding: 0.4rem;
        font: inherit;
        color: var(--cursor-assistant-ink) !important;
        background: var(--cursor-assistant-paper) !important;
        -webkit-text-fill-color: var(--cursor-assistant-ink) !important;
        caret-color: var(--cursor-assistant-ink);
      }
      .cursor-assistant textarea::placeholder { color: var(--cursor-assistant-muted) !important; opacity: 1; -webkit-text-fill-color: var(--cursor-assistant-muted) !important; }
      .cursor-assistant-scope { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.4rem; font-size: 0.68rem; }
      .cursor-assistant-scope label { display: inline-flex; gap: 0.2rem; align-items: center; cursor: pointer; }
      .cursor-assistant input { accent-color: var(--cursor-assistant-ink); }
      .cursor-assistant-actions { display: flex; justify-content: flex-end; gap: 0.35rem; margin-top: 0.45rem; }
      .cursor-assistant-proposal p { margin: 0; }
      .cursor-assistant.is-busy::after { content: 'Thinking...'; display: block; margin-top: 0.35rem; opacity: 0.68; }
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'portfolio-editor') return;
    if (e.data.type === 'cursor-proposal') showProposal(e.data.proposal);
  });

  document.addEventListener('click', (e) => {
    if (!bubble) return;
    if (bubble.contains(e.target)) return;
    const target = targetFromElement(e.target);
    if (!target) {
      hideBubble();
      return;
    }
    const el = e.target.closest('[data-text-id], [data-model-kind]');
    if (el) showPeek(el, target);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideBubble();
  });

  injectStyles();
  createBubble();
})();
