/* Edit Mode JavaScript */
let currentVersion = 1;
let editedTheme = {};
let editedContent = { text: {} };
let contentModel = null;
let inspectController = null;
let previewIframe = null;
const DEFAULT_THEME_COLORS = {
  background: '#bdb6aa',
  secondary: '#ece6da',
  paper: '#f4f1ec',
};

async function initEditMode() {
  const { manifest, theme, content, contentModel: loadedContent } = await window.appData;
  contentModel = loadedContent;
  editedTheme = JSON.parse(JSON.stringify(theme));
  editedContent = JSON.parse(JSON.stringify(content));

  if (!editedTheme.colors.secondary) editedTheme.colors.secondary = DEFAULT_THEME_COLORS.secondary;
  if (!editedTheme.colors.background) editedTheme.colors.background = DEFAULT_THEME_COLORS.background;

  const gridGapSlider = document.getElementById('grid-gap');
  const gridGapPx = Math.min(40, Math.max(8, Math.round(parseSpacingPx(editedTheme.spacing.gridGap))));
  gridGapSlider.value = gridGapPx;
  editedTheme.spacing.gridGap = gridGapPx + 'px';
  document.documentElement.style.setProperty('--space-gridGap', gridGapPx + 'px');
  document.getElementById('grid-gap-display').textContent = gridGapPx + 'px';

  const artSizeSlider = document.getElementById('art-size');
  const artSizePx = Math.min(320, Math.max(120, Math.round(parseSpacingPx(editedTheme.spacing.artSize || '190px'))));
  artSizeSlider.value = artSizePx;
  editedTheme.spacing.artSize = artSizePx + 'px';
  document.documentElement.style.setProperty('--space-artSize', artSizePx + 'px');
  document.getElementById('art-size-display').textContent = artSizePx + 'px';

  applyLayoutMetadata();
  setupVersionButtons();
  setupGridGapListener();
  setupArtSizeListener();
  setupPaletteDrag();
  setupPreview();
  setupTextEditBridge();
  setupAI();
  setupPublish();
  setupCreateModal();
  setupDeviceToggle();
  setupInspectModel();
}

function getCurrentPresentationId() {
  const layout = getLayout(currentVersion);
  return layout?.presentationId || layout?.key || 'grid';
}

function refreshInspectModel() {
  inspectController?.refresh();
}

function setupInspectModel() {
  const panel = document.getElementById('inspect-panel');
  const toggleBtn = document.getElementById('inspect-btn');
  const container = document.getElementById('edit-container');
  if (!panel || !toggleBtn || !window.PortfolioInspect) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    container.classList.toggle('inspect-open', open);
    toggleBtn.classList.toggle('active', open);
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) refreshInspectModel();
  };

  inspectController = PortfolioInspect.mount(panel, {
    getState: () => ({
      contentModel,
      contentOverrides: editedContent,
      theme: editedTheme,
      presentationId: getCurrentPresentationId(),
    }),
  });

  toggleBtn.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('inspect-close', () => setOpen(false));
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
  refreshInspectModel();
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
      alert('Connect your Claude API key first — paste it in the toolbar at the top.');
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
      refreshInspectModel();
    });
  });
}

function setThemeColor(key, value, { rebuild = false } = {}) {
  if (!editedTheme.colors) editedTheme.colors = {};
  editedTheme.colors[key] = value;
  syncPaletteSwatches();
  if (rebuild) updatePreview();
  else patchPreviewColors();
  refreshInspectModel();
}

function patchPreviewColors() {
  if (!previewIframe?.contentWindow) return;
  previewIframe.contentWindow.postMessage({
    source: 'portfolio-editor',
    type: 'colors',
    colors: editedTheme.colors,
  }, '*');
}

function syncPaletteSwatches() {
  document.querySelectorAll('.palette-swatch').forEach((btn) => {
    const key = btn.dataset.colorKey;
    const fill = btn.querySelector('.palette-swatch-fill');
    const color = editedTheme.colors?.[key] || DEFAULT_THEME_COLORS[key];
    if (fill && color) fill.style.background = color;
  });
}

function patchPreviewColorFocus(key) {
  if (!previewIframe?.contentWindow) return;
  previewIframe.contentWindow.postMessage({
    source: 'portfolio-editor',
    type: 'color-focus',
    key: key || null,
  }, '*');
}

function setupPaletteDrag() {
  const strip = document.getElementById('palette-strip');
  if (!strip || !window.PaletteColors) return;

  const PAD_W = 220;
  const PAD_H = 100;

  const popover = document.createElement('div');
  popover.className = 'palette-popover';
  popover.hidden = true;
  popover.innerHTML = `
    <div class="palette-popover-head">
      <span class="palette-popover-title"></span>
      <button type="button" class="palette-popover-close" aria-label="Close">×</button>
    </div>
    <div class="palette-popover-body">
      <div class="palette-popover-preview-col">
        <div class="palette-popover-sample" data-sample></div>
        <div class="palette-popover-hex"></div>
      </div>
      <div class="palette-popover-pad-col">
        <div class="palette-pad" role="application" aria-label="Hue and lightness">
          <div class="palette-pad-hue"></div>
          <div class="palette-pad-val"></div>
          <div class="palette-pad-cursor"></div>
        </div>
        <div class="palette-sliders">
          <label class="palette-slider-row">Hue
            <input type="range" class="palette-hue" min="0" max="360" step="1">
            <span class="palette-slider-val palette-hue-val"></span>
          </label>
          <label class="palette-slider-row">Light
            <input type="range" class="palette-light" min="5" max="95" step="1">
            <span class="palette-slider-val palette-light-val"></span>
          </label>
        </div>
      </div>
    </div>
    <p class="palette-popover-hint"></p>
  `;
  document.body.appendChild(popover);

  const titleEl = popover.querySelector('.palette-popover-title');
  const hintEl = popover.querySelector('.palette-popover-hint');
  const hexEl = popover.querySelector('.palette-popover-hex');
  const sampleEl = popover.querySelector('[data-sample]');
  const pad = popover.querySelector('.palette-pad');
  const padHue = popover.querySelector('.palette-pad-hue');
  const cursor = popover.querySelector('.palette-pad-cursor');
  const hueInput = popover.querySelector('.palette-hue');
  const lightInput = popover.querySelector('.palette-light');
  const hueVal = popover.querySelector('.palette-hue-val');
  const lightVal = popover.querySelector('.palette-light-val');

  let activeKey = null;
  let activeSat = 0.65;
  let padDragging = false;

  function setPadSaturation(sat) {
    const pct = Math.round(Math.max(8, Math.min(100, sat * 100)));
    padHue.style.setProperty('--pad-sat', `${pct}%`);
  }

  function getThemeColor(key) {
    return editedTheme.colors[key] || DEFAULT_THEME_COLORS[key] || '#888888';
  }

  function updateSample(key, hex) {
    const colors = editedTheme.colors || {};
    sampleEl.dataset.sampleKey = key;
    sampleEl.style.setProperty('--sample-color', hex);
    sampleEl.style.setProperty('--sample-bg', getThemeColor('background'));
    sampleEl.style.setProperty('--sample-primary', colors.primary || '#2a2a2a');
    sampleEl.style.setProperty('--sample-secondary', getThemeColor('secondary'));
    sampleEl.style.setProperty('--sample-accent', colors.accent || '#cf9355');
    sampleEl.style.setProperty('--sample-paper', getThemeColor('paper'));
  }

  function refreshUI(hex) {
    const { h, s, l } = PaletteColors.hexToHsl(hex);
    hexEl.textContent = hex.toUpperCase();
    const pos = PaletteColors.padPosition(hex, PAD_W, PAD_H);
    cursor.style.transform = `translate(${pos.x - 7}px, ${pos.y - 7}px)`;
    hueInput.value = Math.round(h);
    lightInput.value = Math.round(l * 100);
    hueVal.textContent = `${Math.round(h)}°`;
    lightVal.textContent = `${Math.round(l * 100)}%`;
    if (activeKey) updateSample(activeKey, hex);
  }

  function applyColor(hex) {
    if (!activeKey) return;
    setThemeColor(activeKey, hex);
    refreshUI(hex);
  }

  function openPopover(key, anchorBtn) {
    const swatch = PaletteColors.SWATCHES.find((s) => s.key === key);
    activeKey = key;
    const hex = getThemeColor(key);
    const { s } = PaletteColors.hexToHsl(hex);
    activeSat = s < 0.08 ? 0.65 : s;
    setPadSaturation(activeSat);
    titleEl.textContent = swatch.label;
    hintEl.textContent = swatch.hint;
    refreshUI(hex);
    const rect = anchorBtn.getBoundingClientRect();
    popover.hidden = false;
    const left = Math.max(8, Math.min(window.innerWidth - 340, rect.left + rect.width / 2 - 170));
    popover.style.top = `${rect.bottom + 8}px`;
    popover.style.left = `${left}px`;
    document.querySelectorAll('.palette-swatch').forEach((b) => {
      b.classList.toggle('palette-swatch--open', b.dataset.colorKey === key);
    });
    patchPreviewColorFocus(key);
  }

  function closePopover() {
    popover.hidden = true;
    activeKey = null;
    document.querySelectorAll('.palette-swatch--open').forEach((b) => b.classList.remove('palette-swatch--open'));
    patchPreviewColorFocus(null);
  }

  function padFromEvent(e) {
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(PAD_W, e.clientX - rect.left));
    const y = Math.max(0, Math.min(PAD_H, e.clientY - rect.top));
    return PaletteColors.fromPad(x, y, PAD_W, PAD_H, activeSat);
  }

  pad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    padDragging = true;
    pad.setPointerCapture(e.pointerId);
    applyColor(padFromEvent(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (!padDragging) return;
    applyColor(padFromEvent(e));
  });
  const endPadDrag = (e) => {
    padDragging = false;
    if (pad.hasPointerCapture(e.pointerId)) pad.releasePointerCapture(e.pointerId);
  };
  pad.addEventListener('pointerup', endPadDrag);
  pad.addEventListener('pointercancel', endPadDrag);

  hueInput.addEventListener('input', () => {
    const { l } = PaletteColors.hexToHsl(editedTheme.colors[activeKey] || '#888888');
    applyColor(PaletteColors.hslToHex(+hueInput.value, activeSat, l));
  });
  lightInput.addEventListener('input', () => {
    const { h } = PaletteColors.hexToHsl(editedTheme.colors[activeKey] || '#888888');
    applyColor(PaletteColors.hslToHex(h, activeSat, +lightInput.value / 100));
  });

  popover.querySelector('.palette-popover-close').addEventListener('click', closePopover);

  PaletteColors.SWATCHES.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-swatch';
    btn.dataset.colorKey = key;
    btn.title = `${label} — click to fine-tune`;
    btn.innerHTML = `<span class="palette-swatch-fill"></span><span class="palette-swatch-label">${label}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeKey === key && !popover.hidden) closePopover();
      else openPopover(key, btn);
    });
    strip.appendChild(btn);
  });

  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('.palette-swatch')) {
      closePopover();
    }
  });

  syncPaletteSwatches();
}

function setupGridGapListener() {
  document.getElementById('grid-gap').addEventListener('input', (e) => {
    const value = e.target.value;
    editedTheme.spacing.gridGap = value + 'px';
    document.documentElement.style.setProperty('--space-gridGap', value + 'px');
    document.getElementById('grid-gap-display').textContent = value + 'px';
    updatePreview();
    refreshInspectModel();
  });
}

function setupArtSizeListener() {
  document.getElementById('art-size').addEventListener('input', (e) => {
    const value = e.target.value;
    editedTheme.spacing.artSize = value + 'px';
    document.documentElement.style.setProperty('--space-artSize', value + 'px');
    document.getElementById('art-size-display').textContent = value + 'px';
    updatePreview();
    refreshInspectModel();
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
    const rebuildData = await rebuildRes.json();
    const { collections, content } = rebuildData;
    if (content) contentModel = content;
    refreshInspectModel();
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

function buildPreviewNav(activeLayout) {
  const links = [
    { label: 'Home', file: 'index.html' },
    ...PORTFOLIO_LAYOUTS.map((layout) => ({ label: layout.name, file: layout.file, key: layout.key })),
    { label: 'Edit', file: 'edit.html' },
  ];

  const items = links.map((link) => {
    if (link.key && link.key === activeLayout.key) {
      return `<span class="active-view">${PortfolioContent.escapeHtml(link.label)}</span>`;
    }
    return `<a href="./${link.file}" data-preview-nav>${PortfolioContent.escapeHtml(link.label)}</a>`;
  }).join('');

  return `<p>${items}</p>`;
}

function buildPreviewHTML(manifest, version, previewWidth = 1100) {
  const layout = getLayout(version) || getLayout(1);
  const presentationId = layout.presentationId || layout.key;
  const titleHeading = buildTextHeading('h1', '', 'portfolio.title', 'portfolio.title', 'My Art Portfolio', editedTheme, editedContent, layout.key);
  const editState = JSON.stringify({ theme: editedTheme, content: editedContent, versionKey: layout.key }).replace(/</g, '\\u003c');
  const previewManifest = JSON.stringify(manifest).replace(/</g, '\\u003c');

  const deskScripts = layout.key === 'desk'
    ? `<script src="./scripts/layouts.js"><\/script><script src="./scripts/desk-drag.js"><\/script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="./styles.css">
  <style>
    :root {
      --color-primary: ${editedTheme.colors.primary};
      --color-accent: ${editedTheme.colors.accent};
      --color-background: ${editedTheme.colors.background};
      --color-secondary: ${editedTheme.colors.secondary || '#ece6da'};
      --color-paper: ${editedTheme.colors.paper || DEFAULT_THEME_COLORS.paper};
      --space-gridGap: ${editedTheme.spacing.gridGap};
      --space-artSize: ${editedTheme.spacing.artSize || '190px'};
    }
    h1[data-text-id], h2[data-text-id] { min-height: 1em; display: block; }
    [data-text-id] { cursor: text; }
    [data-text-id]:hover { outline: 2px dashed var(--color-accent); outline-offset: 3px; }
    [data-text-id]:empty::after { content: 'Click to add text'; opacity: 0.4; font-weight: 400; pointer-events: none; }
    .text-edit-selected { outline: 2px solid var(--color-primary) !important; outline-offset: 3px; }
    .text-edit-toolbar { position: absolute; z-index: 2000; background: #fff; border: 2px solid var(--color-primary); border-radius: 8px; padding: 0.65rem 0.75rem; min-width: 220px; font-size: 0.82rem; }
    .text-edit-props { display: flex; gap: 0.35rem; margin-bottom: 0.5rem; }
    .text-edit-props button { flex: 1; padding: 0.3rem 0.5rem; border: 1px solid var(--color-primary); background: #fff; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.75rem; }
    .text-edit-props button.active { background: var(--color-primary); color: #fff; }
    body.color-focus-background { outline: 4px solid var(--color-accent); outline-offset: -4px; }
    body.color-focus-primary header,
    body.color-focus-primary h1,
    body.color-focus-primary h2 { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    body.color-focus-accent [data-text-id] { outline: 2px dashed var(--color-accent); outline-offset: 3px; }
    body.color-focus-secondary .desk-surface { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    body.color-focus-paper .desk-item,
    body.color-focus-paper .grid-item,
    body.color-focus-paper .scroll-item { outline: 3px solid var(--color-accent); outline-offset: 3px; }
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
    ${buildPreviewNav(layout)}
  </header>
  <main class="container">
    <div id="preview-organization"></div>
    <div id="preview-content"></div>
  </main>
  <script>window.__EDIT_STATE__ = ${editState};<\/script>
  <script>window.__PREVIEW_MANIFEST__ = ${previewManifest}; window.__PREVIEW_PRESENTATION_ID__ = "${presentationId}"; window.__PREVIEW_WIDTH__ = ${previewWidth};<\/script>
  <script src="./scripts/content.js"><\/script>
  <script src="./scripts/organization.js"><\/script>
  <script src="./scripts/component-registry.js"><\/script>
  <script src="./scripts/model-loader.js"><\/script>
  ${deskScripts}
  <script src="./scripts/render.js"><\/script>
  <script>
  (async () => {
    const contentModel = PortfolioModels.manifestToContentStub(window.__PREVIEW_MANIFEST__);
    const models = await PortfolioModels.load(window.__PREVIEW_PRESENTATION_ID__, {
      theme: window.__EDIT_STATE__.theme,
      contentOverrides: window.__EDIT_STATE__.content,
      contentModel,
    });

    const previewRoot = document.getElementById('preview-content');
    const orgHost = document.getElementById('preview-organization');

    if (window.PortfolioOrganization && models.presentation.encounter?.organization_modes?.length) {
      const controls = PortfolioOrganization.createControls({
        manifest: models.manifest,
        content: models.contentOverrides,
        onChange: (collections) => {
          PortfolioRender.renderCollections(previewRoot, collections, models);
        },
      });
      orgHost.appendChild(controls);
    } else {
      PortfolioRender.renderCollections(
        previewRoot,
        models.manifest.collections.map((col, index) => ({
          id: PortfolioContent.collectionId(index),
          originalIndex: index,
          ...col,
        })),
        models
      );
    }
  })();

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'portfolio-editor') return;
    if (e.data.type === 'colors' && e.data.colors) {
      Object.entries(e.data.colors).forEach(([k, v]) => {
        document.documentElement.style.setProperty('--color-' + k, v);
      });
    }
    if (e.data.type === 'color-focus') {
      document.body.classList.remove('color-focus-background', 'color-focus-primary', 'color-focus-accent', 'color-focus-secondary', 'color-focus-paper');
      if (e.data.key) document.body.classList.add('color-focus-' + e.data.key);
    }
  });
  document.querySelectorAll('[data-preview-nav]').forEach((link) => {
    link.addEventListener('click', (e) => e.preventDefault());
  });
  <\/script>
  <script src="./scripts/text-edit.js"><\/script>
</body>
</html>`;
}

document.addEventListener('DOMContentLoaded', initEditMode);
