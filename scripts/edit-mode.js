/* Edit Mode JavaScript */
let currentVersion = 1;
let editedTheme = {};
let editedContent = { text: {} };
let previewIframe = null;

async function initEditMode() {
  const { manifest, theme, content } = await window.appData;
  editedTheme = JSON.parse(JSON.stringify(theme));
  editedContent = JSON.parse(JSON.stringify(content));

  const titleInput = document.getElementById('title-input');
  titleInput.value = PortfolioContent.getText(editedContent, 'portfolio.title', 'My Art Portfolio');

  document.getElementById('color-primary').value = editedTheme.colors.primary;
  document.getElementById('color-accent').value = editedTheme.colors.accent;

  const gridGapSlider = document.getElementById('grid-gap');
  const gridGapPx = Math.min(40, Math.max(8, Math.round(parseSpacingPx(editedTheme.spacing.gridGap))));
  gridGapSlider.value = gridGapPx;
  editedTheme.spacing.gridGap = gridGapPx + 'px';
  document.documentElement.style.setProperty('--space-gridGap', gridGapPx + 'px');
  document.getElementById('grid-gap-display').textContent = gridGapPx + 'px';

  applyLayoutMetadata();
  setupVersionButtons();
  setupPropertyListeners();
  setupPreview();
  setupTextEditBridge();
  setupAI();
  setupPublish();
  setupToggleProps();
  setupCreateModal();
  setupDeviceToggle();
}

function getCurrentVersionKey() {
  return getLayout(currentVersion)?.key || 'grid';
}

function ensureVersionTypographyObject(versionKey, token) {
  if (!editedTheme.versions) editedTheme.versions = {};
  if (!editedTheme.versions[versionKey]) editedTheme.versions[versionKey] = { typography: {} };
  if (!editedTheme.versions[versionKey].typography) {
    editedTheme.versions[versionKey].typography = {};
  }
  if (!editedTheme.versions[versionKey].typography[token]) {
    editedTheme.versions[versionKey].typography[token] = {};
  }
}

function handleTextEditChange({ id, role, scope, property, value }) {
  const versionKey = getCurrentVersionKey();

  if (property === 'content') {
    if (!editedContent.text[id]) editedContent.text[id] = {};
    editedContent.text[id].content = value;
    if (id === 'portfolio.title') {
      document.getElementById('title-input').value = value;
    }
  } else if (scope === 'this') {
    if (!editedContent.text[id]) editedContent.text[id] = {};
    if (!editedContent.text[id].versions) editedContent.text[id].versions = {};
    if (!editedContent.text[id].versions[versionKey]) editedContent.text[id].versions[versionKey] = {};
    editedContent.text[id].versions[versionKey][property] = value;
  } else {
    PortfolioContent.clearStyleOverrides(editedContent, scope, role, property, versionKey);
    if (scope === 'role') {
      const token = PortfolioContent.ROLE_TOKENS[role];
      ensureVersionTypographyObject(versionKey, token);
      editedTheme.versions[versionKey].typography[token][property] = value;
    } else if (scope === 'all-headings') {
      ['heading1', 'heading2'].forEach((token) => {
        ensureVersionTypographyObject(versionKey, token);
        editedTheme.versions[versionKey].typography[token][property] = value;
      });
    }
  }
  patchPreview();
}

function patchPreview() {
  if (previewIframe?.contentWindow) {
    previewIframe.contentWindow.postMessage({
      source: 'portfolio-editor',
      type: 'patch',
      theme: editedTheme,
      content: editedContent,
      versionKey: getCurrentVersionKey(),
    }, '*');
  }
}

function setupTextEditBridge() {
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'portfolio-text-edit') return;
    if (e.data.type === 'change') handleTextEditChange(e.data);
  });
}

function setupToggleProps() {
  const btn = document.getElementById('toggle-props-btn');
  const panel = document.getElementById('properties-panel');
  btn.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.classList.toggle('active', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
  });
}

function setupDeviceToggle() {
  const frame = document.getElementById('device-frame');
  const sizeLabel = document.getElementById('device-size');
  const desktopBtn = document.getElementById('device-desktop');
  const mobileBtn = document.getElementById('device-mobile');

  const set = (mode) => {
    const mobile = mode === 'mobile';
    frame.classList.toggle('mobile', mobile);
    frame.classList.toggle('desktop', !mobile);
    mobileBtn.classList.toggle('active', mobile);
    desktopBtn.classList.toggle('active', !mobile);
    sizeLabel.textContent = mobile ? '390 px' : 'Desktop';
    updatePreview();
  };

  desktopBtn.addEventListener('click', () => set('desktop'));
  mobileBtn.addEventListener('click', () => set('mobile'));
}

function getPreviewWidth() {
  const frame = document.getElementById('device-frame');
  return frame.classList.contains('mobile') ? 390 : 1100;
}

function applyLayoutMetadata() {
  PORTFOLIO_LAYOUTS.forEach((layout) => {
    const btn = document.querySelector(`.version-btn[data-version="${layout.id}"]`);
    if (btn) {
      btn.textContent = layout.name;
      btn.title = layout.examplePrompt;
    }
  });

  const examples = document.getElementById('prompt-examples');
  if (!examples) return;

  examples.innerHTML = '';
  PORTFOLIO_LAYOUTS.forEach((layout) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'prompt-example';
    chip.textContent = layout.name;
    chip.title = layout.examplePrompt;
    chip.addEventListener('click', () => {
      document.getElementById('ai-prompt').value = layout.examplePrompt;
    });
    examples.appendChild(chip);
  });
}

function setupCreateModal() {
  const modal = document.getElementById('create-modal');
  const open = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };

  document.querySelector('.create-btn').addEventListener('click', open);
  document.getElementById('create-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

const AI_KEY_STORE = 'portfolio.claudeApiKey';

function setupAI() {
  const keyInput = document.getElementById('api-key-input');
  const status = document.getElementById('ai-status');

  const setConnected = (connected) => {
    status.textContent = connected ? 'connected ✓' : 'not connected';
    status.className = 'ai-status ' + (connected ? 'ai-status--on' : 'ai-status--off');
  };

  const saved = localStorage.getItem(AI_KEY_STORE);
  if (saved) { keyInput.value = saved; setConnected(true); }

  document.getElementById('connect-ai-btn').addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) { setConnected(false); localStorage.removeItem(AI_KEY_STORE); return; }
    localStorage.setItem(AI_KEY_STORE, key);
    setConnected(true);
  });

  document.getElementById('generate-btn').addEventListener('click', () => {
    if (!localStorage.getItem(AI_KEY_STORE)) {
      alert('Connect your Claude API key first — open "⚙ Edit design" and paste it under Claude API key.');
      return;
    }
    const prompt = document.getElementById('ai-prompt').value.trim() || 'a new layout';
    document.getElementById('create-modal').hidden = true;
    alert(`[Mock] Claude would generate a new version from:\n\n  "${prompt}"\n\n…and add it as ver3.html alongside your existing views.`);
  });
}

function setupPublish() {
  const modal = document.getElementById('publish-modal');
  const result = document.getElementById('publish-result');
  const open = () => { result.hidden = true; modal.hidden = false; };
  const close = () => { modal.hidden = true; };

  document.getElementById('publish-btn').addEventListener('click', open);
  document.getElementById('publish-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('publish-confirm').addEventListener('click', () => {
    const url = document.getElementById('publish-url-text').textContent;
    result.hidden = false;
    result.textContent = `[Mock] Pushed to main. Your site will be live at ${url} in ~1 min.`;
  });
}

function setupVersionButtons() {
  document.querySelectorAll('.version-btn:not(.create-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.version-btn:not(.create-btn)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVersion = parseInt(btn.dataset.version);
      updatePreview();
    });
  });
}

function setupPropertyListeners() {
  document.getElementById('title-input').addEventListener('input', (e) => {
    if (!editedContent.text['portfolio.title']) editedContent.text['portfolio.title'] = {};
    editedContent.text['portfolio.title'].content = e.target.value;
    patchPreview();
  });

  document.getElementById('color-primary').addEventListener('change', (e) => {
    editedTheme.colors.primary = e.target.value;
    document.documentElement.style.setProperty('--color-primary', e.target.value);
    updatePreview();
  });

  document.getElementById('color-accent').addEventListener('change', (e) => {
    editedTheme.colors.accent = e.target.value;
    document.documentElement.style.setProperty('--color-accent', e.target.value);
    updatePreview();
  });

  document.getElementById('grid-gap').addEventListener('input', (e) => {
    const value = e.target.value;
    editedTheme.spacing.gridGap = value + 'px';
    document.documentElement.style.setProperty('--space-gridGap', value + 'px');
    document.getElementById('grid-gap-display').textContent = value + 'px';
    updatePreview();
  });
}

function getEditedGridGapPx() {
  const slider = document.getElementById('grid-gap');
  if (slider) return parseInt(slider.value, 10) || 24;
  return parseSpacingPx(editedTheme.spacing?.gridGap);
}

function setupPreview() {
  updatePreview();
  document.getElementById('save-btn').addEventListener('click', saveChanges);
  document.getElementById('preview-btn').addEventListener('click', () => {
    const layout = getLayout(currentVersion);
    window.open(`./${layout?.file || 'ver1.html'}`, '_blank');
  });
}

async function saveChanges() {
  const btn = document.getElementById('save-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    // Bundle text overrides into the theme POST so one endpoint persists everything
    // (older servers only had /api/theme; /api/content may still be unavailable)
    const themePayload = { ...editedTheme, content: editedContent };
    const [themeRes, rebuildRes] = await Promise.all([
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(themePayload),
      }),
      fetch('/api/rebuild', { method: 'POST' }),
    ]);
    if (!themeRes.ok || !rebuildRes.ok) throw new Error('server error');
    // Best-effort standalone content write for servers that support it
    fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedContent),
    }).catch(() => {});
    const { collections } = await rebuildRes.json();
    btn.textContent = `Saved ✓ (${collections.length} collections)`;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
  } catch (e) {
    btn.textContent = original;
    btn.disabled = false;
    alert('Could not save. Start the local editor first:\n\n    node scripts/serve.js\n\nthen open this page at http://localhost:8080/edit.html');
  }
}

function updatePreview() {
  const container = document.getElementById('preview-frame');
  container.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.sandbox.add('allow-same-origin', 'allow-scripts');
  container.appendChild(iframe);
  previewIframe = iframe;

  window.appData.then(({ manifest }) => {
    const html = buildPreviewHTML(manifest, currentVersion, getPreviewWidth());
    const iframeDoc = iframe.contentDocument;
    iframeDoc.write(html);
    iframeDoc.close();
  });
}

function buildTextHeading(tag, className, id, role, fallback, theme, content, versionKey) {
  const text = PortfolioContent.getText(content, id, fallback);
  const style = PortfolioContent.styleToCss(PortfolioContent.getElementStyle(theme, content, id, role, versionKey));
  const cls = className ? ` class="${className}"` : '';
  return `<${tag}${cls} data-text-id="${id}" data-text-role="${role}" data-text-fallback="${PortfolioContent.escapeHtml(fallback)}" style="${style}">${PortfolioContent.escapeHtml(text)}</${tag}>`;
}

function buildPreviewHTML(manifest, version, previewWidth = 1100) {
  const layout = getLayout(version) || getLayout(1);
  let collectionsHTML = '';

  manifest.collections.forEach((collection, index) => {
    const cid = PortfolioContent.collectionId(index);
    const heading = buildTextHeading('h2', layout.key === 'clothesline' ? 'strip-title' : layout.key === 'desk' ? 'desk-title' : '', cid, 'collection.title', collection.name, editedTheme, editedContent, layout.key);

    if (layout.key === 'grid') {
      let itemsHTML = '';
      collection.images.forEach((img) => {
        itemsHTML += `<div class="grid-item"><img src="${img}" alt="artwork" onerror="this.remove()"></div>`;
      });
      collectionsHTML += `<section>${heading}<div class="grid-view">${itemsHTML}</div></section>`;
      return;
    }

    if (layout.key === 'clothesline') {
      let itemsHTML = '';
      collection.images.forEach((img) => {
        itemsHTML += `<div class="scroll-item"><img src="${img}" alt="artwork" onerror="this.remove()"></div>`;
      });
      collectionsHTML += `<section class="collection-strip">${heading}<div class="images-scroll">${itemsHTML}</div></section>`;
      return;
    }

    const deskLayout = deskSurfaceLayout(collection.images.length, previewWidth - 48, getEditedGridGapPx());
    let itemsHTML = '';
    collection.images.forEach((img, imgIndex) => {
      itemsHTML += `<div class="desk-item" style="${deskItemStyleAttr(imgIndex, deskLayout)}"><img src="${img}" alt="artwork" draggable="false" onerror="this.remove()"></div>`;
    });
    collectionsHTML += `<section class="desk-collection">${heading}<div class="desk-surface" style="width: 100%; height: ${deskLayout.height}px; min-height: ${deskLayout.height}px; max-height: ${deskLayout.height}px; overflow: hidden">${itemsHTML}</div></section>`;
  });

  const titleHeading = buildTextHeading('h1', '', 'portfolio.title', 'portfolio.title', 'My Art Portfolio', editedTheme, editedContent, layout.key);
  const editState = JSON.stringify({ theme: editedTheme, content: editedContent, versionKey: layout.key }).replace(/</g, '\\u003c');

  const deskScripts = layout.key === 'desk'
    ? `<script src="./scripts/desk-drag.js"><\/script>
  <script>document.querySelectorAll('.desk-surface').forEach(bindDeskDragging);<\/script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --color-primary: ${editedTheme.colors.primary};
      --color-accent: ${editedTheme.colors.accent};
      --color-green: ${editedTheme.colors.green || '#9aab84'};
      --color-background: ${editedTheme.colors.background};
      --color-secondary: ${editedTheme.colors.secondary || '#ece6da'};
      --space-gridGap: ${editedTheme.spacing.gridGap};
    }
    body { font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif; background: var(--color-background); color: var(--color-primary); }
    header { padding: 2rem 1.5rem 1.5rem; border-bottom: 4px solid var(--color-primary); }
    h1 { letter-spacing: -0.02em; }
    h2 { margin: 2rem 0 1rem; }
    .strip-title, .desk-title { margin-bottom: 1rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
    .grid-view { display: grid; grid-template-columns: repeat(auto-fill, 220px); gap: var(--space-gridGap); padding: 0.5rem 0 2rem; }
    .grid-item, .scroll-item, .desk-item { aspect-ratio: 1; background: var(--color-accent); border: 3px solid var(--color-primary); overflow: hidden; }
    .grid-item, .scroll-item { width: 220px; height: 220px; flex: 0 0 220px; }
    .grid-item:nth-child(even), .scroll-item:nth-child(even), .desk-item:nth-child(even) { background: var(--color-green); }
    .grid-item img, .scroll-item img, .desk-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .collection-strip, .desk-collection { margin: 2rem 0; }
    .images-scroll { display: flex; gap: var(--space-gridGap); overflow-x: auto; padding-bottom: 1rem; }
    .scroll-item { flex: 0 0 220px; }
    .desk-surface { position: relative; padding: 0; overflow: hidden; background: var(--color-secondary); border: 4px solid var(--color-primary); }
    .desk-item { position: absolute; cursor: grab; touch-action: none; user-select: none; box-shadow: 3px 5px 0 var(--color-primary); }
    .desk-item--dragging { cursor: grabbing; transition: none; transform: rotate(var(--desk-rotate, 0deg)) !important; z-index: 1000 !important; box-shadow: 5px 7px 0 var(--color-primary); }
    .desk-item img { pointer-events: none; -webkit-user-drag: none; }
    [data-text-id] { cursor: text; }
    [data-text-id]:hover { outline: 2px dashed var(--color-accent); outline-offset: 3px; }
    .text-edit-selected { outline: 2px solid var(--color-primary) !important; outline-offset: 3px; }
    .text-edit-toolbar { position: absolute; z-index: 2000; background: #fff; border: 2px solid var(--color-primary); border-radius: 8px; padding: 0.65rem 0.75rem; min-width: 220px; box-shadow: 4px 4px 0 var(--color-primary); font-size: 0.82rem; }
    .text-edit-props { display: flex; gap: 0.35rem; margin-bottom: 0.5rem; }
    .text-edit-props button { flex: 1; padding: 0.3rem 0.5rem; border: 1px solid var(--color-primary); background: #fff; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.75rem; }
    .text-edit-props button.active { background: var(--color-accent); color: #fff; }
    .text-edit-panel label { display: block; font-weight: 600; margin-bottom: 0.25rem; }
    .text-edit-hint { font-size: 0.72rem; color: #666; margin-bottom: 0.35rem; }
    .text-edit-input, .text-edit-font { width: 100%; padding: 0.35rem 0.5rem; border: 1px solid var(--color-primary); border-radius: 4px; font: inherit; font-size: 0.85rem; }
    .text-edit-size { width: 100%; }
    .text-edit-scope { border: none; margin-top: 0.5rem; padding: 0; }
    .text-edit-scope legend { font-weight: 600; font-size: 0.75rem; margin-bottom: 0.25rem; }
    .text-edit-scope label { display: block; font-size: 0.75rem; margin: 0.15rem 0; cursor: pointer; }
  </style>
</head>
<body data-edit-mode="1">
  <header>
    ${titleHeading}
  </header>
  <main class="container">
    ${collectionsHTML}
  </main>
  <script>window.__EDIT_STATE__ = ${editState};<\/script>
  <script src="./scripts/content.js"><\/script>
  <script src="./scripts/text-edit.js"><\/script>
  ${deskScripts}
</body>
</html>`;
}

document.addEventListener('DOMContentLoaded', initEditMode);
