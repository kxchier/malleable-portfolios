/** In-preview click-to-edit toolbar (edit mode iframe only). */
(function () {
  if (!document.body.dataset.editMode) return;

  const PC = window.PortfolioContent;
  let toolbar = null;
  let selected = null;
  let activeProperty = 'text';
  let activeScope = 'this';

  function post(msg) {
    window.parent.postMessage({ source: 'portfolio-text-edit', ...msg }, '*');
  }

  function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'text-edit-toolbar';
    toolbar.hidden = true;
    toolbar.innerHTML = `
      <div class="text-edit-props">
        <button type="button" data-prop="text" class="active">Text</button>
        <button type="button" data-prop="font">Font</button>
        <button type="button" data-prop="size">Size</button>
      </div>
      <div class="text-edit-panel" data-panel="text">
        <p class="text-edit-hint">Click the text to edit, or type here:</p>
        <input type="text" class="text-edit-input">
      </div>
      <div class="text-edit-panel" data-panel="font" hidden>
        <label>Font family</label>
        <select class="text-edit-font"></select>
      </div>
      <div class="text-edit-panel" data-panel="size" hidden>
        <label>Size <span class="text-edit-size-val"></span></label>
        <input type="range" class="text-edit-size" min="12" max="64" step="1">
      </div>
      <fieldset class="text-edit-scope">
        <legend>Apply to</legend>
      </fieldset>
    `;
    document.body.appendChild(toolbar);

    PC.FONT_OPTIONS.forEach((font) => {
      const opt = document.createElement('option');
      opt.value = font;
      opt.textContent = font;
      toolbar.querySelector('.text-edit-font').appendChild(opt);
    });

    toolbar.querySelectorAll('[data-prop]').forEach((btn) => {
      btn.addEventListener('click', () => setProperty(btn.dataset.prop));
    });

    toolbar.querySelector('.text-edit-input').addEventListener('input', (e) => {
      if (!selected) return;
      selected.textContent = e.target.value;
      emitChange('content', e.target.value, 'this');
    });

    toolbar.querySelector('.text-edit-font').addEventListener('change', (e) => {
      if (!selected) return;
      emitChange('fontFamily', e.target.value, activeScope);
    });

    const sizeInput = toolbar.querySelector('.text-edit-size');
    sizeInput.addEventListener('input', (e) => {
      if (!selected) return;
      const px = e.target.value;
      toolbar.querySelector('.text-edit-size-val').textContent = px + 'px';
      emitChange('fontSize', px + 'px', activeScope);
    });

    document.addEventListener('click', (e) => {
      if (toolbar.contains(e.target)) return;
      const el = e.target.closest('[data-text-id]');
      if (el) {
        e.preventDefault();
        selectElement(el);
        return;
      }
      if (!e.target.closest('[data-text-id]')) deselect();
    });
  }

  function setProperty(prop) {
    activeProperty = prop;
    toolbar.querySelectorAll('[data-prop]').forEach((b) => {
      b.classList.toggle('active', b.dataset.prop === prop);
    });
    toolbar.querySelectorAll('[data-panel]').forEach((p) => {
      p.hidden = p.dataset.panel !== prop;
    });
  }

  function scopeOptions(role) {
    const opts = [{ value: 'this', label: 'This text only' }];
    if (role === 'collection.title') {
      opts.push({ value: 'role', label: 'All section titles' });
    }
    if (role === 'portfolio.title' || role === 'collection.title') {
      opts.push({ value: 'all-headings', label: 'All headings' });
    }
    return opts;
  }

  function reapplyStyleControls() {
    if (!selected) return;
    if (activeProperty === 'font') {
      emitChange('fontFamily', toolbar.querySelector('.text-edit-font').value, activeScope);
    } else if (activeProperty === 'size') {
      const px = toolbar.querySelector('.text-edit-size').value;
      emitChange('fontSize', `${px}px`, activeScope);
    }
  }

  function renderScope(role) {
    const fieldset = toolbar.querySelector('.text-edit-scope');
    fieldset.innerHTML = '<legend>Apply to</legend>';
    scopeOptions(role).forEach((opt, i) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'text-scope';
      radio.value = opt.value;
      if (i === 0) radio.checked = true;
      radio.addEventListener('change', () => {
        activeScope = opt.value;
        reapplyStyleControls();
      });
      label.appendChild(radio);
      label.appendChild(document.createTextNode(' ' + opt.label));
      fieldset.appendChild(label);
    });
    activeScope = 'this';
  }

  function syncToolbarFromSelected() {
    if (!selected || !toolbar || toolbar.hidden) return;
    const style = PC.getElementStyle(
      window.__EDIT_STATE__.theme,
      window.__EDIT_STATE__.content,
      selected.dataset.textId,
      selected.dataset.textRole
    );
    toolbar.querySelector('.text-edit-input').value = selected.textContent;
    toolbar.querySelector('.text-edit-font').value = style.fontFamily;
    const px = parseInt(style.fontSize, 10) || 24;
    toolbar.querySelector('.text-edit-size').value = px;
    toolbar.querySelector('.text-edit-size-val').textContent = px + 'px';
  }

  function selectElement(el) {
    selected = el;
    document.querySelectorAll('[data-text-id].text-edit-selected').forEach((n) => {
      n.classList.remove('text-edit-selected');
    });
    el.classList.add('text-edit-selected');

    const rect = el.getBoundingClientRect();
    toolbar.hidden = false;
    toolbar.style.top = `${rect.bottom + window.scrollY + 8}px`;
    toolbar.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;

    renderScope(el.dataset.textRole);
    syncToolbarFromSelected();
    post({ type: 'select', id: el.dataset.textId, role: el.dataset.textRole });
  }

  function deselect() {
    selected = null;
    document.querySelectorAll('.text-edit-selected').forEach((n) => n.classList.remove('text-edit-selected'));
    if (toolbar) toolbar.hidden = true;
  }

  function emitChange(property, value, scope) {
    if (!selected) return;
    post({
      type: 'change',
      id: selected.dataset.textId,
      role: selected.dataset.textRole,
      scope,
      property,
      value,
    });
  }

  function applyPatch(msg) {
    const { theme, content } = msg;
    if (theme) window.__EDIT_STATE__.theme = theme;
    if (content) window.__EDIT_STATE__.content = content;

    document.querySelectorAll('[data-text-id]').forEach((el) => {
      PC.applyToElement(el, window.__EDIT_STATE__.theme, window.__EDIT_STATE__.content);
    });

    syncToolbarFromSelected();
  }

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'portfolio-editor') return;
    if (e.data.type === 'patch') applyPatch(e.data);
  });

  createToolbar();
})();
