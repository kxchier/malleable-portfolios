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

  // Load grid gap
  const gridGapSlider = document.getElementById('grid-gap');
  const gridGapValue = parseInt(editedTheme.spacing.gridGap);
  gridGapSlider.value = gridGapValue;
  document.getElementById('grid-gap-display').textContent = gridGapValue + 'px';

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
  };

  desktopBtn.addEventListener('click', () => set('desktop'));
  mobileBtn.addEventListener('click', () => set('mobile'));
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
    editedTheme.spacing.gridGap = value + 'rem';
    document.documentElement.style.setProperty('--space-gridGap', value + 'px');
    document.getElementById('grid-gap-display').textContent = value + 'px';
    updatePreview();
  });
}

function setupPreview() {
  // Initial render
  updatePreview();

  document.getElementById('save-btn').addEventListener('click', saveChanges);

  document.getElementById('preview-btn').addEventListener('click', () => {
    const url = currentVersion === 1 ? './ver1.html' : './ver2.html';
    window.open(url, '_blank');
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

  // Render HTML directly into preview
  const versionFile = currentVersion === 1 ? 'ver1.html' : 'ver2.html';
  
  // Create an iframe to sandbox the preview
  container.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.sandbox.add('allow-same-origin');
  
  container.appendChild(iframe);

  // Inject content into iframe
  window.appData.then(({ manifest }) => {
    const iframeDoc = iframe.contentDocument;
    const html = buildPreviewHTML(title, manifest, currentVersion);
    iframeDoc.write(html);
    iframeDoc.close();
  });
}

function buildPreviewHTML(title, manifest, version) {
  const isGrid = version === 1;
  const viewClass = isGrid ? 'grid-view' : 'images-scroll';
  const containerClass = isGrid ? 'grid-view' : 'collection-strip';

  let collectionsHTML = '';
  manifest.collections.forEach(collection => {
    const sectionClass = isGrid ? '' : 'class="collection-strip"';
    const titleHtml = `<h2${isGrid ? '' : ' class="strip-title"'}>${collection.name}</h2>`;
    
    let itemsHTML = '';
    collection.images.forEach(img => {
      const itemClass = isGrid ? 'grid-item' : 'scroll-item';
      itemsHTML += `<div class="${itemClass}"><img src="${img}" alt="artwork" onerror="this.remove()"></div>`;
    });

    const scrollOrGridHTML = `<div class="${viewClass}">${itemsHTML}</div>`;
    collectionsHTML += `<section ${sectionClass}>${titleHtml}${scrollOrGridHTML}</section>`;
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
    .grid-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-gridGap); padding: 0.5rem 0 2rem; }
    .grid-item, .scroll-item { aspect-ratio: 1; background: var(--color-accent); border: 3px solid var(--color-primary); overflow: hidden; }
    .grid-item:nth-child(even), .scroll-item:nth-child(even) { background: var(--color-green); }
    .grid-item img, .scroll-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .collection-strip { margin: 2rem 0; }
    .strip-title { font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem; }
    .images-scroll { display: flex; gap: var(--space-gridGap); overflow-x: auto; padding-bottom: 1rem; }
    .scroll-item { flex: 0 0 220px; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
  </header>
  <main class="container">
    ${collectionsHTML}
  </main>
</body>
</html>`;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initEditMode);
