/* Edit Mode JavaScript */
let currentVersion = 1;
let editedTheme = {};

async function initEditMode() {
  const { manifest, theme } = await window.appData;
  editedTheme = JSON.parse(JSON.stringify(theme)); // Deep copy

  // Load title
  const titleInput = document.getElementById('title-input');
  titleInput.value = 'My Art Portfolio';

  // Load colors
  document.getElementById('color-primary').value = editedTheme.colors.primary;
  document.getElementById('color-accent').value = editedTheme.colors.accent;

  // Load grid gap (slider uses px; keep CSS var in sync for desk layout)
  const gridGapSlider = document.getElementById('grid-gap');
  const gridGapPx = Math.min(40, Math.max(8, Math.round(parseSpacingPx(editedTheme.spacing.gridGap))));
  gridGapSlider.value = gridGapPx;
  editedTheme.spacing.gridGap = gridGapPx + 'px';
  document.documentElement.style.setProperty('--space-gridGap', gridGapPx + 'px');
  document.getElementById('grid-gap-display').textContent = gridGapPx + 'px';

  applyLayoutMetadata();

  // Setup event listeners
  setupVersionButtons();
  setupPropertyListeners();
  setupPreview();
  setupAI();
  setupPublish();
  setupToggleProps();
  setupCreateModal();
  setupDeviceToggle();
}

// ---- Collapsible "Edit design" panel ----
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

// ---- Desktop / mobile preview width ----
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

// ---- "Create New" → generate modal (MOCK) ----
function setupCreateModal() {
  const modal = document.getElementById('create-modal');
  const open = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };

  document.querySelector('.create-btn').addEventListener('click', open);
  document.getElementById('create-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

// ---- AI access (MOCK) ----
// Real version would call the Claude API. For the study we just store the key in
// localStorage (stays in the browser, never written to the repo) and fake generation.
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
    localStorage.setItem(AI_KEY_STORE, key); // local-only; gitignored if ever written to disk
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

// ---- Publish flow (MOCK) ----
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
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.version-btn:not(.create-btn)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVersion = parseInt(btn.dataset.version);
      updatePreview();
    });
  });
  // "+ Create New" opens the generate modal — see setupCreateModal()
}

function setupPropertyListeners() {
  document.getElementById('title-input').addEventListener('input', (e) => {
    updatePreview();
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
  // Initial render
  updatePreview();

  document.getElementById('save-btn').addEventListener('click', saveChanges);

  document.getElementById('preview-btn').addEventListener('click', () => {
    const layout = getLayout(currentVersion);
    window.open(`./${layout?.file || 'ver1.html'}`, '_blank');
  });
}

// Save = write the static files (theme.json + manifest.json) that GitHub Pages serves.
// Requires the local server (scripts/serve.js). On a plain static host there's no
// backend to write to, so we tell the user to run the editor locally.
async function saveChanges() {
  const btn = document.getElementById('save-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const [themeRes, rebuildRes] = await Promise.all([
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedTheme)
      }),
      fetch('/api/rebuild', { method: 'POST' })
    ]);
    if (!themeRes.ok || !rebuildRes.ok) throw new Error('server error');
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
  const title = document.getElementById('title-input').value;
  const container = document.getElementById('preview-frame');

  // Create an iframe to sandbox the preview
  container.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.sandbox.add('allow-same-origin', 'allow-scripts');
  
  container.appendChild(iframe);

  // Inject content into iframe
  window.appData.then(({ manifest }) => {
    const iframeDoc = iframe.contentDocument;
    const html = buildPreviewHTML(title, manifest, currentVersion, getPreviewWidth());
    iframeDoc.write(html);
    iframeDoc.close();
  });
}

function buildPreviewHTML(title, manifest, version, previewWidth = 1100) {
  const layout = getLayout(version) || getLayout(1);
  let collectionsHTML = '';

  manifest.collections.forEach((collection) => {
    if (layout.key === 'grid') {
      let itemsHTML = '';
      collection.images.forEach((img) => {
        itemsHTML += `<div class="grid-item"><img src="${img}" alt="artwork" onerror="this.remove()"></div>`;
      });
      collectionsHTML += `<section><h2>${collection.name}</h2><div class="grid-view">${itemsHTML}</div></section>`;
      return;
    }

    if (layout.key === 'clothesline') {
      let itemsHTML = '';
      collection.images.forEach((img) => {
        itemsHTML += `<div class="scroll-item"><img src="${img}" alt="artwork" onerror="this.remove()"></div>`;
      });
      collectionsHTML += `<section class="collection-strip"><h2 class="strip-title">${collection.name}</h2><div class="images-scroll">${itemsHTML}</div></section>`;
      return;
    }

    const deskLayout = deskSurfaceLayout(collection.images.length, previewWidth - 48, getEditedGridGapPx());
    let itemsHTML = '';
    collection.images.forEach((img, index) => {
      itemsHTML += `<div class="desk-item" style="${deskItemStyleAttr(index, deskLayout)}"><img src="${img}" alt="artwork" draggable="false" onerror="this.remove()"></div>`;
    });
    collectionsHTML += `<section class="desk-collection"><h2 class="desk-title">${collection.name}</h2><div class="desk-surface" style="width: 100%; height: ${deskLayout.height}px; min-height: ${deskLayout.height}px; max-height: ${deskLayout.height}px; overflow: visible">${itemsHTML}</div></section>`;
  });

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
      --space-gridGap: ${editedTheme.spacing.gridGap};
    }
    body { font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif; background: var(--color-background); color: var(--color-primary); }
    header { padding: 2rem 1.5rem 1.5rem; border-bottom: 4px solid var(--color-primary); }
    h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; }
    h2 { font-size: 1.5rem; font-weight: 800; margin: 2rem 0 1rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
    .grid-view { display: grid; grid-template-columns: repeat(auto-fill, 220px); gap: var(--space-gridGap); padding: 0.5rem 0 2rem; }
    .grid-item, .scroll-item, .desk-item { aspect-ratio: 1; background: var(--color-accent); border: 3px solid var(--color-primary); overflow: hidden; }
    .grid-item, .scroll-item { width: 220px; height: 220px; flex: 0 0 220px; }
    .grid-item:nth-child(even), .scroll-item:nth-child(even), .desk-item:nth-child(even) { background: var(--color-green); }
    .grid-item img, .scroll-item img, .desk-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .collection-strip, .desk-collection { margin: 2rem 0; }
    .strip-title, .desk-title { font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem; }
    .images-scroll { display: flex; gap: var(--space-gridGap); overflow-x: auto; padding-bottom: 1rem; }
    .scroll-item { flex: 0 0 220px; }
    .desk-surface { position: relative; padding: 0; overflow: visible; background: var(--color-secondary); border: 4px solid var(--color-primary); }
    .desk-collection { overflow: visible; }
    .desk-item { position: absolute; cursor: grab; touch-action: none; user-select: none; box-shadow: 3px 5px 0 var(--color-primary); }
    .desk-item--dragging { cursor: grabbing; transition: none; transform: rotate(var(--desk-rotate, 0deg)) !important; z-index: 1000 !important; box-shadow: 5px 7px 0 var(--color-primary); }
    .desk-item img { pointer-events: none; -webkit-user-drag: none; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
  </header>
  <main class="container">
    ${collectionsHTML}
  </main>
  ${layout.key === 'desk' ? `<script src="./scripts/desk-drag.js"><\/script>
  <script>document.querySelectorAll('.desk-surface').forEach(bindDeskDragging);<\/script>` : ''}
</html>`;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initEditMode);
