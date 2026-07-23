/* Edit Mode JavaScript */
let currentVersion = 1;
let editedTheme = {};
let editedContent = { text: {} };
let contentModel = null;
let sourceManifest = null;
let inspectController = null;
let previewIframe = null;
let previewResizeObserver = null;
let closePalettePopover = null;
let renderPaletteForLayout = null;
const DESKTOP_PREVIEW_WIDTH = 1280;
const DEFAULT_THEME_COLORS = {
  background: '#f8f6f3',
  secondary: '#e8e4de',
  paper: '#ffffff',
  panel: '#f0ede8',
};
const DESIGN_SPACE_DEFAULT = { x: 0.5, y: 0.5 };
const DESIGN_SPACE_COLORS = ['#2f3437', '#9b7a4d', '#4f7f78', '#b45c47', '#6f6aa8', '#5f8a4f'];
const DESIGN_SCAFFOLD_MARKER = 'Design-space scaffold:';
const DESIGN_DIRECTION_MARKER = 'Design direction:';
const DESIGN_AXES_STORE = 'portfolio.designAxes';
const DESIGN_SIDEBAR_HIDDEN_STORE = 'portfolio.designSidebarHidden';
const METADATA_DISPLAY_VALUES = ['none', 'below', 'side', 'overlay'];
const SOCIAL_PROTOTYPE_VALUES = ['none', 'likes', 'comments', 'likes-comments', 'notes', 'all'];
let selectedDesignSpace = { ...DESIGN_SPACE_DEFAULT };
let designSpacePointSelected = false;
let customDesignAxes = [];
let designAxesRemoteSaveTimer = null;
let draggingAxisNote = null;
let activeDesignDirectionPrompt = '';
let pendingGeneratePrompt = '';
let pendingGenerateQuestion = null;
let pendingGenerateAnswers = [];
let pendingGenerateReady = false;
let openAssetAssistant = () => {};
let cursorUndoSnapshot = null;
let collectionWorkDrag = null;

function isLocalPortfolioHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
}

function requireLocalPortfolioApi(feature) {
  if (isLocalPortfolioHost()) return;
  throw new Error(`${feature} requires the local authoring server. Run node scripts/serve.js and open the localhost editor.`);
}

function hydratePublicLayouts() {
  const stored = Array.isArray(editedContent.publicLayouts) ? editedContent.publicLayouts : [];
  if (!stored.length) return;
  const byKey = new Map((window.PORTFOLIO_LAYOUTS || []).map((layout) => [layout.key, layout]));
  stored.forEach((layout) => {
    if (!layout?.key || (!layout?.publicSpec && !layout?.publicBundle)) return;
    byKey.set(layout.key, { ...layout, generated: true, publicGenerated: true });
  });
  window.PORTFOLIO_LAYOUTS = [...byKey.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

function createPublicGeneratedLayout(data, prompt, designSpace, referenceImage = null) {
  if (!data?.bundle || !data?.name || !data?.key) throw new Error('The public generator returned an invalid layout bundle.');
  const suffix = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  const sourceKey = String(data.key).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'study';
  const keyBase = sourceKey.slice(0, 28);
  const key = `public_${keyBase}_${suffix}`;
  const ids = (window.PORTFOLIO_LAYOUTS || []).map((layout) => Number(layout.id)).filter(Number.isFinite);
  const replaceKey = (value) => String(value || '').split(sourceKey).join(key).split('KEY').join(key);
  const bundle = {
    ...data.bundle,
    presentation: { ...(data.bundle.presentation || {}), id: key, metaphor: data.metaphor || data.bundle.presentation?.metaphor || key },
    css: replaceKey(data.bundle.css),
    renderScript: replaceKey(data.bundle.renderScript).replace(
      /(GeneratedLayouts\s*\[\s*['"])[^'"]+(['"]\s*\])/g,
      `$1${key}$2`
    ),
  };
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(referenceImage?.image || ''))) {
    bundle.assets = { ...(bundle.assets || {}), 'reference-image': referenceImage.image };
  }
  return {
    id: (ids.length ? Math.max(...ids) : 0) + 1,
    key,
    presentationId: key,
    name: String(data.name).slice(0, 40),
    metaphor: String(data.metaphor || 'custom portfolio').slice(0, 80),
    generated: true,
    publicGenerated: true,
    prompt,
    examplePrompt: prompt,
    colorKeys: ['background', 'primary', 'accent', 'paper', 'panel', 'secondary'],
    designSpace: designSpace || null,
    publicBundle: bundle,
    createdAt: new Date().toISOString(),
  };
}

function publicLayoutTheme(layout) {
  if (layout.publicBundle) {
    return {
      colors: { ...(layout.publicBundle.themeColors || {}) },
      typography: { ...(layout.publicBundle.themeTypography || {}) },
      spacing: { ...(layout.publicBundle.themeSpacing || {}) },
    };
  }
  const spec = layout.publicSpec || {};
  const fonts = {
    serif: "'Playfair Display', Georgia, serif",
    sans: "'Space Grotesk', system-ui, sans-serif",
    display: "'Bungee', 'Arial Black', sans-serif",
    handwritten: "'Caveat', cursive",
    mono: "'Space Mono', monospace",
  };
  const family = fonts[spec.headingStyle] || fonts.sans;
  return {
    colors: { ...(spec.colors || {}) },
    typography: {
      heading1: { fontFamily: family, fontSize: '3rem', fontWeight: '700' },
      heading2: { fontFamily: family, fontSize: '1.4rem', fontWeight: '700' },
      body: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '1rem', fontWeight: '400' },
    },
    spacing: {
      gridGap: `${spec.spacing?.gridGap || 24}px`,
      artSize: `${spec.spacing?.artSize || 210}px`,
      imagePadding: `${spec.spacing?.imagePadding || 12}px`,
    },
  };
}

async function initEditMode() {
  const loadingTitle = document.getElementById('editor-loading-title');
  const participantId = window.PortfolioSupabase?.participantIdFromLocation?.() || '';
  if (loadingTitle && participantId) loadingTitle.textContent = `Loading participant session ${participantId}…`;

  if (window.loadPortfolioLayouts) await window.loadPortfolioLayouts();

  const { manifest, theme, content, contentModel: loadedContent } = await window.appData;
  sourceManifest = manifest;
  contentModel = loadedContent;
  editedTheme = JSON.parse(JSON.stringify(theme));
  editedContent = JSON.parse(JSON.stringify(content));
  hydratePublicLayouts();

  const firstLayout = (window.PORTFOLIO_LAYOUTS || [])[0];
  if (firstLayout) currentVersion = firstLayout.id;

  if (!editedTheme.colors.secondary) editedTheme.colors.secondary = DEFAULT_THEME_COLORS.secondary;
  if (!editedTheme.colors.background) editedTheme.colors.background = DEFAULT_THEME_COLORS.background;
  if (!editedTheme.colors.paper) editedTheme.colors.paper = DEFAULT_THEME_COLORS.paper;
  if (!editedTheme.colors.panel) editedTheme.colors.panel = DEFAULT_THEME_COLORS.panel;

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
  syncSpacingControlsForCurrentVersion();
  syncMetadataDisplayControl();
  syncSocialPrototypeControl();

  applyLayoutMetadata();
  renderVersionButtons();
  setupGridGapListener();
  setupArtSizeListener();
  setupMetadataDisplayListener();
  setupSocialPrototypeListener();
  setupPaletteDrag();
  setupPreview();
  setupCollectionArranger();
  setupTextEditBridge();
  setupCursorUndoToast();
  setupAssetAssistant();
  setupSupabaseControls();
  setupDesignDirectionCard();
  setupAI();
  setupDeleteLayout();
  setupCreatePanel();
  setupInspectModel();

  const loading = document.getElementById('editor-loading');
  if (loading) {
    loading.classList.add('is-ready');
    window.setTimeout(() => loading.remove(), 220);
  }
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
  if (!editedTheme.versions[versionKey]) editedTheme.versions[versionKey] = {};
  if (!editedTheme.versions[versionKey].typography) {
    editedTheme.versions[versionKey].typography = {};
  }
  if (!editedTheme.versions[versionKey].typography[token]) {
    editedTheme.versions[versionKey].typography[token] = {};
  }
}

function ensureVersionColorsObject(versionKey) {
  if (!editedTheme.versions) editedTheme.versions = {};
  if (!editedTheme.versions[versionKey]) editedTheme.versions[versionKey] = {};
  if (!editedTheme.versions[versionKey].colors) {
    editedTheme.versions[versionKey].colors = {};
  }
}

function ensureVersionSpacingObject(versionKey) {
  if (!editedTheme.versions) editedTheme.versions = {};
  if (!editedTheme.versions[versionKey]) editedTheme.versions[versionKey] = {};
  if (!editedTheme.versions[versionKey].spacing) {
    editedTheme.versions[versionKey].spacing = {};
  }
}

function getVersionColorsForKey(versionKey) {
  return PortfolioContent.getVersionColors(editedTheme, versionKey);
}

function getVersionTypographyForKey(versionKey) {
  return {
    heading1: PortfolioContent.getVersionTypography(editedTheme, versionKey, 'heading1'),
    heading2: PortfolioContent.getVersionTypography(editedTheme, versionKey, 'heading2'),
    body: PortfolioContent.getVersionTypography(editedTheme, versionKey, 'body'),
  };
}

function getVersionSpacingForKey(versionKey) {
  return {
    ...(editedTheme.spacing || {}),
    ...(editedTheme.versions?.[versionKey]?.spacing || {}),
  };
}

function setCurrentVersionSpacingValue(key, value) {
  const versionKey = getCurrentVersionKey();
  ensureVersionSpacingObject(versionKey);
  editedTheme.versions[versionKey].spacing[key] = value;
  document.documentElement.style.setProperty(`--space-${key}`, value);
}

function syncSpacingControlsForCurrentVersion() {
  const spacing = getVersionSpacingForKey(getCurrentVersionKey());
  const gridGap = Math.min(40, Math.max(8, Math.round(parseSpacingPx(spacing.gridGap))));
  const artSize = Math.min(320, Math.max(120, Math.round(parseSpacingPx(spacing.artSize || '190px'))));
  const gridGapSlider = document.getElementById('grid-gap');
  const artSizeSlider = document.getElementById('art-size');
  if (gridGapSlider) gridGapSlider.value = gridGap;
  if (artSizeSlider) artSizeSlider.value = artSize;
  document.documentElement.style.setProperty('--space-gridGap', gridGap + 'px');
  document.documentElement.style.setProperty('--space-artSize', artSize + 'px');
  const gridGapDisplay = document.getElementById('grid-gap-display');
  const artSizeDisplay = document.getElementById('art-size-display');
  if (gridGapDisplay) gridGapDisplay.textContent = gridGap + 'px';
  if (artSizeDisplay) artSizeDisplay.textContent = artSize + 'px';
}

function getCurrentMetadataDisplay() {
  const value = editedContent.layoutOverrides?.[getCurrentVersionKey()]?.metadataDisplay;
  return METADATA_DISPLAY_VALUES.includes(value) ? value : 'none';
}

function syncMetadataDisplayControl() {
  const select = document.getElementById('metadata-display');
  if (select) select.value = getCurrentMetadataDisplay();
}

function getCurrentSocialPrototypeMode() {
  const value = editedContent.layoutOverrides?.[getCurrentVersionKey()]?.socialPrototype;
  return SOCIAL_PROTOTYPE_VALUES.includes(value) ? value : 'none';
}

function syncSocialPrototypeControl() {
  const select = document.getElementById('social-prototype');
  if (select) select.value = getCurrentSocialPrototypeMode();
}

function getCurrentVersionColors() {
  return getVersionColorsForKey(getCurrentVersionKey());
}

function handleTextEditChange({ id, role, scope, property, value }) {
  const versionKey = getCurrentVersionKey();

  if (property === 'content') {
    if (!editedContent.text[id]) editedContent.text[id] = {};
    if (!editedContent.text[id].versions) editedContent.text[id].versions = {};
    if (!editedContent.text[id].versions[versionKey]) editedContent.text[id].versions[versionKey] = {};
    editedContent.text[id].versions[versionKey].content = value;
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

function patchPreview({ remount = false } = {}) {
  if (previewIframe?.contentWindow) {
    previewIframe.contentWindow.postMessage({
      source: 'portfolio-editor',
      type: 'patch',
      theme: editedTheme,
      content: editedContent,
      versionKey: getCurrentVersionKey(),
      remount,
    }, '*');
  }
}

function syncEditChromeAfterLocalEdit() {
  syncPaletteVisibility();
  syncPaletteSwatches();
  syncSpacingControlsForCurrentVersion();
  syncMetadataDisplayControl();
  syncSocialPrototypeControl();
  renderVersionButtons();
  renderCollectionArranger();
  syncDeleteLayoutButton();
  syncPreviewReferenceChip();
  refreshInspectModel();
}

function setupTextEditBridge() {
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (previewIframe?.contentWindow && e.source !== previewIframe.contentWindow) return;
    if (e.data.source === 'portfolio-preview-nav') {
      const layout = PORTFOLIO_LAYOUTS.find((item) => item.key === e.data.key || item.presentationId === e.data.key);
      if (layout) selectVersion(layout.id);
      return;
    }
    if (e.data.source === 'portfolio-text-edit') {
      if (e.data.type === 'change') handleTextEditChange(e.data);
      return;
    }
    if (e.data.source === 'portfolio-cursor-assistant') {
      handleCursorAssistantMessage(e.data);
      return;
    }
    if (e.data.source === 'portfolio-page-assistant' && e.data.type === 'open') {
      openAssetAssistant(e.data.anchor);
    }
  });
}

function handleCursorAssistantMessage(msg) {
  if (msg.type === 'request') {
    proposeCursorOperation(msg)
      .then((proposal) => {
        if (previewIframe?.contentWindow) {
          previewIframe.contentWindow.postMessage({
            source: 'portfolio-editor',
            type: 'cursor-proposal',
            proposal,
          }, '*');
        }
      })
      .catch((error) => {
        if (previewIframe?.contentWindow) {
          previewIframe.contentWindow.postMessage({
            source: 'portfolio-editor',
            type: 'cursor-proposal',
            proposal: proposalFor({ type: 'noop' }, error.message),
          }, '*');
        }
      });
  }
  if (msg.type === 'apply') {
    if (!msg.operation || msg.operation.type === 'noop' || msg.operation.type === 'needsGeneration') {
      applyCursorOperation(msg.operation);
      return;
    }
    cursorUndoSnapshot = cloneEditState();
    applyCursorOperation(msg.operation);
    syncEditChromeAfterLocalEdit();
    showCursorUndoToast();
  }
}

function proposalFor(operation, message) {
  return { operation, message };
}

function cloneEditState() {
  return {
    theme: JSON.parse(JSON.stringify(editedTheme)),
    content: JSON.parse(JSON.stringify(editedContent)),
  };
}

function undoCursorOperation() {
  if (!cursorUndoSnapshot) return;
  editedTheme = cursorUndoSnapshot.theme;
  editedContent = cursorUndoSnapshot.content;
  cursorUndoSnapshot = null;
  syncEditChromeAfterLocalEdit();
  updatePreview();
  hideCursorUndoToast();
}

function showCursorUndoToast() {
  const toast = document.getElementById('cursor-undo-toast');
  if (!toast) return;
  toast.hidden = false;
}

function hideCursorUndoToast() {
  const toast = document.getElementById('cursor-undo-toast');
  if (!toast) return;
  toast.hidden = true;
}

function setupCursorUndoToast() {
  const undoBtn = document.getElementById('cursor-undo-btn');
  const doneBtn = document.getElementById('cursor-done-btn');
  undoBtn?.addEventListener('click', undoCursorOperation);
  doneBtn?.addEventListener('click', () => {
    cursorUndoSnapshot = null;
    hideCursorUndoToast();
  });
}

function normalizeCursorScope(scope) {
  return ['this', 'role', 'all-headings', 'all-images', 'all-sections'].includes(scope) ? scope : 'this';
}

async function proposeCursorOperation({ target, prompt, scope, presentationId }) {
  scope = normalizeCursorScope(scope);
  const versionKey = getCurrentVersionKey();
  const currentPresentation = presentationId || getCurrentPresentationId();

  return parseOperationWithAI({ target, prompt, scope, presentationId: currentPresentation, versionKey });
}

async function parseOperationWithAI({ target, prompt, scope, presentationId, versionKey }) {
  if (!isLocalPortfolioHost() && !participantIdValue()) {
    throw new Error('Begin a participant session before using AI-assisted editing.');
  }
  const payload = { target, prompt, scope, presentationId };
  const result = isLocalPortfolioHost()
    ? await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/operation') || '/api/operation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    : await window.PortfolioSupabase.invoke('ai-assisted-edit', {
      mode: 'cursor', ...payload,
      context: { theme: getVersionColorsForKey(versionKey) },
    });

  const operation = validateCursorOperation(result.operation, { target, scope, prompt, presentationId, versionKey });
  return proposalFor(operation, operation.type === 'noop' ? messageForOperation(operation) : (result.message || messageForOperation(operation)));
}

const TEXT_STYLE_VALUE_PATTERNS = {
  fontFamily: /^[a-zA-Z0-9 ,'"-]{1,80}$/,
  fontSize: /^(\d{1,3}(\.\d+)?)(px|rem|em|%)$/,
  fontWeight: /^(normal|bold|[1-9]00)$/,
  fontStyle: /^(normal|italic|oblique)$/,
  textAlign: /^(left|center|right)$/,
  letterSpacing: /^-?\d{1,2}(\.\d+)?(px|em|rem)$/,
  lineHeight: /^(\d(\.\d{1,2})?|\d{1,3}%)$/,
  textDecoration: /^(none|underline|line-through|overline)$/,
  transform: /^((rotate\(-?\d{1,3}(\.\d+)?deg\)|scale\(\d(\.\d{1,2})?\)|translate\(-?\d{1,3}px,\s?-?\d{1,3}px\))\s*){1,3}$/,
  transformOrigin: /^(left|center|right|top|bottom)( (left|center|right|top|bottom))?$/,
  opacity: /^(0(\.\d{1,2})?|1(\.0{1,2})?)$/,
};

const SPACING_VALUE_PATTERN = /^(\d{1,4}(\.\d+)?(px|rem|em|%)|0|auto)$/;
const SPACING_SHORTHAND_PATTERN = /^((\d{1,4}(\.\d+)?(px|rem|em|%)|0|auto)(\s+|$)){1,4}$/;

const ELEMENT_STYLE_VALUE_PATTERNS = {
  aspectRatio: /^(\d{1,3}(\.\d+)?\/\d{1,3}(\.\d+)?|auto)$/,
  background: /^(transparent|#[0-9a-fA-F]{3,8}|rgba?\([0-9.,\s%]+\)|color-mix\(in srgb, var\(--color-[a-z-]+\) \d{1,3}%, (black|white|transparent|var\(--color-[a-z-]+\))\))$/,
  border: /^(\d{1,2}px)\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8}|currentColor|var\(--color-[a-z-]+\))$/,
  borderColor: /^(#[0-9a-fA-F]{3,8}|currentColor|var\(--color-[a-z-]+\))$/,
  borderRadius: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|9999px)(\s+\d{1,4}(\.\d+)?(px|rem|em|%)){0,3}$/,
  borderStyle: /^(solid|dashed|dotted|none)$/,
  borderWidth: /^\d{1,2}px$/,
  boxShadow: /^(none|0\s+\d{1,2}px\s+\d{1,3}px\s+rgba?\([0-9.,\s%]+\))$/,
  clipPath: /^(circle\(\d{1,3}%\)|ellipse\(\d{1,3}%\s+\d{1,3}%\)|inset\(\d{1,3}%\s+round\s+\d{1,3}(px|%)\))$/,
  filter: /^(none|grayscale\(\d{1,3}%\)|sepia\(\d{1,3}%\)|blur\(\d{1,2}px\)|contrast\(\d(\.\d{1,2})?\)|saturate\(\d(\.\d{1,2})?\)|brightness\(\d(\.\d{1,2})?\))$/,
  gap: SPACING_VALUE_PATTERN,
  height: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|auto|var\(--space-artSize\)|calc\(var\(--space-artSize\) \+ \d{1,3}px\))$/,
  margin: SPACING_SHORTHAND_PATTERN,
  marginBottom: SPACING_VALUE_PATTERN,
  marginLeft: SPACING_VALUE_PATTERN,
  marginRight: SPACING_VALUE_PATTERN,
  marginTop: SPACING_VALUE_PATTERN,
  maxHeight: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|none|100%)$/,
  maxWidth: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|none|100%)$/,
  objectFit: /^(contain|cover|fill|none|scale-down)$/,
  objectPosition: /^(center|top|bottom|left|right|center center|top center|bottom center|left center|right center)$/,
  opacity: /^(0(\.\d{1,2})?|1(\.0{1,2})?)$/,
  outline: /^(none|\d{1,2}px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8}|currentColor|var\(--color-[a-z-]+\)))$/,
  overflow: /^(hidden|visible|clip|auto)$/,
  padding: /^(\d{1,3}(\.\d+)?(px|rem|em|%)|0|var\(--space-imagePadding\))(\s+(\d{1,3}(\.\d+)?(px|rem|em|%)|0)){0,3}$/,
  paddingBottom: SPACING_VALUE_PATTERN,
  paddingLeft: SPACING_VALUE_PATTERN,
  paddingRight: SPACING_VALUE_PATTERN,
  paddingTop: SPACING_VALUE_PATTERN,
  rowGap: SPACING_VALUE_PATTERN,
  columnGap: SPACING_VALUE_PATTERN,
  transform: TEXT_STYLE_VALUE_PATTERNS.transform,
  transformOrigin: TEXT_STYLE_VALUE_PATTERNS.transformOrigin,
  width: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|auto|var\(--space-artSize\)|calc\(var\(--space-artSize\) \+ \d{1,3}px\))$/,
};

function normalizeStylePatch(patch) {
  const normalized = { ...(patch || {}) };

  const rotationValue = normalized.rotate ?? normalized.rotation ?? normalized.rotateDegrees ?? normalized.rotationDegrees ?? normalized.tilt;
  if (rotationValue != null && normalized.transform == null) {
    const str = String(rotationValue).trim();
    const number = parseFloat(str);
    if (Number.isFinite(number)) {
      normalized.transform = `rotate(${Math.max(-45, Math.min(45, number))}deg)`;
    } else if (/^rotate\(/.test(str)) {
      normalized.transform = str;
    }
  }

  const translateX = normalized.translateX ?? normalized.moveX ?? normalized.x ?? normalized.leftRight;
  const translateY = normalized.translateY ?? normalized.moveY ?? normalized.y ?? normalized.upDown;
  if ((translateX != null || translateY != null) && normalized.transform == null) {
    const x = Number.parseFloat(String(translateX ?? 0));
    const y = Number.parseFloat(String(translateY ?? 0));
    if (Number.isFinite(x) || Number.isFinite(y)) {
      const safeX = Math.max(-80, Math.min(80, Number.isFinite(x) ? x : 0));
      const safeY = Math.max(-80, Math.min(80, Number.isFinite(y) ? y : 0));
      normalized.transform = `translate(${safeX}px, ${safeY}px)`;
    }
  }

  if (normalized.translate != null && normalized.transform == null) {
    const str = String(normalized.translate).trim();
    if (/^-?\d{1,3}(\.\d+)?px,\s?-?\d{1,3}(\.\d+)?px$/.test(str)) {
      normalized.transform = `translate(${str})`;
    } else if (/^translate\(/.test(str)) {
      normalized.transform = str;
    }
  }

  if (normalized.align != null && normalized.textAlign == null) {
    normalized.textAlign = normalized.align;
  }

  if (normalized.spacing != null && normalized.letterSpacing == null) {
    normalized.letterSpacing = normalized.spacing;
  }

  if (normalized.transform && normalized.transformOrigin == null && /rotate\(/.test(String(normalized.transform))) {
    normalized.transformOrigin = 'left center';
  }

  return normalized;
}

function sanitizeStylePatch(patch) {
  const clean = {};
  const allowed = PortfolioContent.TEXT_STYLE_PROPS || [];
  Object.entries(normalizeStylePatch(patch)).forEach(([prop, value]) => {
    if (!allowed.includes(prop)) return;
    const str = String(value).trim();
    const pattern = TEXT_STYLE_VALUE_PATTERNS[prop];
    if (!pattern || !pattern.test(str)) return;
    clean[prop] = str;
  });
  return clean;
}

function normalizeElementStylePatch(patch) {
  const normalized = { ...(patch || {}) };

  if ((normalized.shape === 'circle' || normalized.circle === true) && normalized.borderRadius == null) {
    normalized.borderRadius = '9999px';
    normalized.aspectRatio = normalized.aspectRatio || '1/1';
    normalized.overflow = normalized.overflow || 'hidden';
  }

  if (normalized.roundness != null && normalized.borderRadius == null) {
    const value = String(normalized.roundness).trim();
    normalized.borderRadius = /^\d/.test(value) ? value : '9999px';
  }

  return normalized;
}

function sanitizeElementStylePatch(patch) {
  const clean = {};
  const allowed = PortfolioContent.ELEMENT_STYLE_PROPS || [];
  Object.entries(normalizeElementStylePatch(patch)).forEach(([prop, value]) => {
    if (!allowed.includes(prop)) return;
    const str = String(value).trim();
    const pattern = ELEMENT_STYLE_VALUE_PATTERNS[prop];
    if (!pattern || !pattern.test(str)) return;
    clean[prop] = str;
  });
  return clean;
}

function parseSpacingParts(value) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}

function normalizeCollectionSectionSpacingPatch(patch = {}) {
  const normalized = { ...patch };
  const marginParts = parseSpacingParts(normalized.margin);
  const paddingParts = parseSpacingParts(normalized.padding);

  if (paddingParts) {
    if (normalized.paddingTop == null && paddingParts.top !== '0') normalized.paddingTop = paddingParts.top;
    if (normalized.paddingRight == null) normalized.paddingRight = paddingParts.right;
    if (normalized.paddingBottom == null && paddingParts.bottom !== '0') normalized.paddingBottom = paddingParts.bottom;
    if (normalized.paddingLeft == null) normalized.paddingLeft = paddingParts.left;
    delete normalized.padding;
  }

  if (marginParts) {
    if (normalized.marginTop == null && marginParts.top !== '0') normalized.marginTop = marginParts.top;
    if (normalized.marginBottom == null && marginParts.bottom !== '0') normalized.marginBottom = marginParts.bottom;
    if (normalized.marginLeft == null) normalized.marginLeft = marginParts.left;
    if (normalized.marginRight == null) normalized.marginRight = marginParts.right;
    delete normalized.margin;
  }

  return normalized;
}

function targetStyleId(target) {
  if (!target) return null;
  if (target.path) return target.path;
  if (target.kind === 'text' && target.id) return `text.${target.id}`;
  return null;
}

function normalizeGeneratedOperation(operation, fallback) {
  if (operation.type === 'newRepresentation' || operation.type === 'needsGeneration') {
    return {
      type: 'noop',
      target: fallback.target,
      message: 'This cursor edit can only change the existing interface. Try a smaller edit to the clicked object.',
    };
  }
  return operation;
}

function validateCursorOperation(rawOperation, fallback) {
  if (!rawOperation || typeof rawOperation !== 'object') {
    throw new Error('The operation parser returned no editable operation.');
  }

  const operation = normalizeGeneratedOperation(rawOperation, fallback);
  const target = operation.target || fallback.target;

  if (operation.type === 'stylePatch') {
    if (target?.kind !== 'text') {
      const rawPatch = sanitizeElementStylePatch(operation.patch);
      const patch = target?.kind === 'collection'
        ? normalizeCollectionSectionSpacingPatch(rawPatch)
        : rawPatch;
      const imagePatch = target?.kind === 'collection' ? {} : sanitizeElementStylePatch(operation.imagePatch);
      if (!Object.keys(patch).length && !Object.keys(imagePatch).length) {
        throw new Error('The operation parser returned text styles for a non-text target.');
      }
      const styleId = targetStyleId(target);
      if (!styleId) {
        throw new Error('The operation parser did not identify a specific clicked element to style.');
      }
      return {
        type: 'elementStylePatch',
        target,
        styleId,
        scope: normalizeCursorScope(operation.scope || fallback.scope),
        versionKey: fallback.versionKey,
        patch,
        imagePatch,
      };
    }
    const patch = sanitizeStylePatch(operation.patch);
    if (!Object.keys(patch).length) {
      throw new Error('The operation parser did not return any safe style properties to apply.');
    }
    return {
      type: 'stylePatch',
      target,
      scope: normalizeCursorScope(operation.scope || fallback.scope),
      versionKey: fallback.versionKey,
      patch,
    };
  }

  if (operation.type === 'collectionVisibility') {
    return {
      type: 'collectionVisibility',
      target: target?.kind === 'collection' ? target : collectionTargetFromText(target),
      presentationId: fallback.presentationId,
      visible: operation.visible !== false,
    };
  }

  if (operation.type === 'elementStylePatch') {
    const styleId = targetStyleId(target);
    if (!styleId || !target || target.kind === 'presentation') {
      throw new Error('The operation parser did not identify a specific clicked element to style.');
    }
    const rawPatch = sanitizeElementStylePatch(operation.patch);
    const patch = target?.kind === 'collection'
      ? normalizeCollectionSectionSpacingPatch(rawPatch)
      : rawPatch;
    const imagePatch = target?.kind === 'collection' ? {} : sanitizeElementStylePatch(operation.imagePatch);
    if (!Object.keys(patch).length && !Object.keys(imagePatch).length) {
      throw new Error('The operation parser did not return any safe element style properties to apply.');
    }
    return {
      type: 'elementStylePatch',
      target,
      styleId,
      scope: normalizeCursorScope(operation.scope || fallback.scope),
      versionKey: fallback.versionKey,
      patch,
      imagePatch,
    };
  }

  if (operation.type === 'spacing') {
    const sectionPatch = sanitizeElementStylePatch({
      margin: operation.margin,
      marginTop: operation.marginTop,
      marginBottom: operation.marginBottom,
      marginLeft: operation.marginLeft,
      marginRight: operation.marginRight,
      padding: operation.padding,
      paddingTop: operation.paddingTop,
      paddingBottom: operation.paddingBottom,
      paddingLeft: operation.paddingLeft,
      paddingRight: operation.paddingRight,
      gap: operation.gap,
      rowGap: operation.rowGap,
      columnGap: operation.columnGap,
    });
    const styleId = targetStyleId(target);
    if (target?.kind === 'collection' && styleId && Object.keys(sectionPatch).length) {
      const normalizedSectionPatch = normalizeCollectionSectionSpacingPatch(sectionPatch);
      return {
        type: 'elementStylePatch',
        target,
        styleId,
        scope: normalizeCursorScope(operation.scope || fallback.scope),
        versionKey: fallback.versionKey,
        patch: normalizedSectionPatch,
        imagePatch: {},
      };
    }
    return {
      type: 'spacing',
      target,
      versionKey: fallback.versionKey,
      gridGap: typeof operation.gridGap === 'string' ? operation.gridGap : undefined,
      artSize: typeof operation.artSize === 'string' ? operation.artSize : undefined,
    };
  }

  if (operation.type === 'noop') return { type: 'noop', message: operation.message || 'No safe local edit was available for that request.' };
  throw new Error(`Unsupported operation type: ${operation.type}`);
}

const PORTFOLIO_COLOR_KEYS = ['background', 'primary', 'secondary', 'accent', 'paper', 'panel'];
const TYPOGRAPHY_TOKENS = ['heading1', 'heading2', 'body'];
const LAYOUT_DISPLAY_VALUES = ['grid', 'horizontal', 'vertical'];
const MATERIAL_TEXTURE_VALUES = ['textured', 'wood', 'paper', 'fabric', 'metal', 'glass'];

function sanitizeColorPatch(colors) {
  const clean = {};
  Object.entries(colors || {}).forEach(([key, value]) => {
    if (!PORTFOLIO_COLOR_KEYS.includes(key)) return;
    const str = String(value || '').trim();
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(str)) clean[key] = str;
  });
  return clean;
}

function sanitizeTypographyPatch(typography) {
  const clean = {};
  TYPOGRAPHY_TOKENS.forEach((token) => {
    const entry = typography?.[token];
    if (!entry || typeof entry !== 'object') return;
    const next = {};
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight'].forEach((prop) => {
      if (entry[prop] == null) return;
      const str = String(entry[prop]).trim();
      const pattern = TEXT_STYLE_VALUE_PATTERNS[prop];
      if (pattern?.test(str)) next[prop] = str;
    });
    if (Object.keys(next).length) clean[token] = next;
  });
  return clean;
}

function sanitizeSpacingPatch(operation) {
  const clean = {};
  ['gridGap', 'artSize', 'imagePadding'].forEach((prop) => {
    if (operation?.[prop] == null) return;
    const str = String(operation[prop]).trim();
    if (/^(\d{1,4}(\.\d+)?)(px|rem|em|%)$/.test(str)) clean[prop] = str;
  });
  return clean;
}

function requestIsCollectionContainerSpacing(prompt) {
  const text = String(prompt || '').toLowerCase();
  const mentionsCollection = /\b(collection|collections|section|sections|container|containers|panel|panels|frame|frames|quilt|patch)\b/.test(text);
  const mentionsOuterSpacing = /\b(outside|outer|margin|margins|side|sides|left|right|horizontal|breathing room|inward|edge|edges)\b/.test(text);
  const explicitlyBetweenItems = /\bbetween (the )?(images|items|works|artworks)|image gap|item gap|work gap|grid gap\b/.test(text);
  return mentionsCollection && mentionsOuterSpacing && !explicitlyBetweenItems;
}

function requestIsPaletteOnly(prompt) {
  const text = String(prompt || '').toLowerCase();
  const asksForPalette = /\b(color|colors|colour|colours|palette|pastel|vintage|retro|warm|cool|brighter|darker|muted|saturated|wes\s+anderson|anderson|budapest)\b/.test(text);
  const asksForAssets = /\b(add|draw|create|place|put|sprinkle|scatter)\b.*\b(asset|assets|decoration|decorations|motif|motifs|doodle|doodles|sticker|stickers|icon|icons|ornament|ornaments|object|objects|background art|illustration|illustrations)\b/.test(text);
  return asksForPalette && !asksForAssets;
}

function paletteOnlyFallbackOperation(versionKey) {
  return {
    type: 'colorPatch',
    versionKey,
    colors: {
      background: '#f0e6d2',
      primary: '#2f251f',
      accent: '#b45f4d',
      paper: '#f4c6d0',
      panel: '#d4af37',
      secondary: '#8fa78f',
    },
  };
}

function validatePortfolioOperations(rawOperations, fallback) {
  const source = Array.isArray(rawOperations) ? rawOperations : (rawOperations ? [rawOperations] : []);
  const operations = [];

  source.forEach((operation) => {
    if (!operation || typeof operation !== 'object') return;

    if (operation.type === 'colorPatch') {
      const colors = sanitizeColorPatch(operation.colors);
      if (Object.keys(colors).length) operations.push({ type: 'colorPatch', versionKey: fallback.versionKey, colors });
      return;
    }

    if (operation.type === 'typographyPatch') {
      const typography = sanitizeTypographyPatch(operation.typography);
      if (Object.keys(typography).length) operations.push({ type: 'typographyPatch', versionKey: fallback.versionKey, typography });
      return;
    }

    if (operation.type === 'spacing') {
      if (requestIsCollectionContainerSpacing(fallback.prompt) && (operation.gridGap || operation.gap)) return;
      const spacing = sanitizeSpacingPatch(operation);
      if (Object.keys(spacing).length) operations.push({ type: 'spacing', versionKey: fallback.versionKey, ...spacing });
      return;
    }

    if (operation.type === 'layoutOverride') {
      const next = { type: 'layoutOverride', versionKey: fallback.versionKey };
      if (LAYOUT_DISPLAY_VALUES.includes(operation.collectionDisplay)) next.collectionDisplay = operation.collectionDisplay;
      if (MATERIAL_TEXTURE_VALUES.includes(operation.materialTexture)) next.materialTexture = operation.materialTexture;
      if (METADATA_DISPLAY_VALUES.includes(operation.metadataDisplay)) next.metadataDisplay = operation.metadataDisplay;
      if (SOCIAL_PROTOTYPE_VALUES.includes(operation.socialPrototype)) next.socialPrototype = operation.socialPrototype;
      if (next.collectionDisplay || next.materialTexture || next.metadataDisplay || next.socialPrototype) operations.push(next);
      return;
    }

    if (operation.type === 'elementStylePatch') {
      const scope = operation.scope === 'all-sections' ? 'all-sections' : 'all-images';
      const rawPatch = sanitizeElementStylePatch(operation.patch);
      const patch = scope === 'all-sections'
        ? normalizeCollectionSectionSpacingPatch(rawPatch)
        : rawPatch;
      const imagePatch = scope === 'all-sections' ? {} : sanitizeElementStylePatch(operation.imagePatch);
      if (!Object.keys(patch).length && !Object.keys(imagePatch).length) return;
      operations.push({
        type: 'elementStylePatch',
        versionKey: fallback.versionKey,
        scope,
        patch,
        imagePatch,
      });
      return;
    }

    if (operation.type === 'decorativeAssets') {
      if (requestIsPaletteOnly(fallback.prompt)) return;
      const prompt = String(operation.prompt || '').trim();
      if (prompt) operations.push({ type: 'decorativeAssets', prompt: prompt.slice(0, 600) });
    }
  });

  if (!operations.length && requestIsPaletteOnly(fallback.prompt)) {
    operations.push(paletteOnlyFallbackOperation(fallback.versionKey));
  }

  return operations;
}

function messageForOperation(operation) {
  if (operation.type === 'stylePatch') {
    return `Apply ${Object.keys(operation.patch).join(', ')} to ${operation.target?.label || 'this text'} in this presentation.`;
  }
  if (operation.type === 'elementStylePatch') {
    const props = [...Object.keys(operation.patch || {}), ...Object.keys(operation.imagePatch || {})];
    if (operation.scope === 'all-sections') {
      return `Apply ${props.join(', ')} to all sections in this presentation.`;
    }
    if (operation.scope === 'all-images') {
      return `Apply ${props.join(', ')} to all images in this presentation.`;
    }
    return `Apply ${props.join(', ')} to only ${operation.target?.label || 'the clicked element'}.`;
  }
  if (operation.type === 'noop') return operation.message || 'No safe local edit was available for that request.';
  return 'Apply this local edit.';
}

function ensureContentVisibility() {
  if (!editedContent.visibility) editedContent.visibility = {};
  if (!editedContent.visibility.collections) editedContent.visibility.collections = {};
}

function ensureElementStyles() {
  if (!editedContent.elementStyles) editedContent.elementStyles = {};
  if (!editedContent.elementStyles.all) editedContent.elementStyles.all = {};
  if (!editedContent.elementStyles.versions) editedContent.elementStyles.versions = {};
}

function collectionTextIdFromTarget(target) {
  if (target?.kind !== 'collection') return null;
  if (target.path?.startsWith('collections.')) return PortfolioContent.collectionId(parseInt(target.path.split('.')[1], 10));
  if (target.collectionIndex != null) return PortfolioContent.collectionId(parseInt(target.collectionIndex, 10));
  return null;
}

function collectionTargetFromText(target) {
  if (target?.kind !== 'text' || !target.id?.startsWith('collection.')) return null;
  const collectionIndex = parseInt(target.id.split('.')[1], 10);
  if (!Number.isFinite(collectionIndex)) return null;
  return {
    kind: 'collection',
    path: `collections.${collectionIndex}`,
    collectionIndex: String(collectionIndex),
    collectionId: `collection_${collectionIndex}`,
    label: target.label,
  };
}

function applyCursorOperation(operation) {
  if (!operation) return;

  if (operation.type === 'typography' && operation.target?.kind === 'text') {
    const role = operation.target.role || (operation.target.id === 'portfolio.title' ? 'portfolio.title' : 'collection.title');
    const textScope = ['role', 'all-headings'].includes(operation.scope) ? operation.scope : 'this';
    handleTextEditChange({
      id: operation.target.id,
      role,
      scope: textScope,
      property: operation.property,
      value: operation.value,
    });
    return;
  }

  if (operation.type === 'stylePatch' && operation.target?.kind === 'text') {
    const role = operation.target.role || (operation.target.id === 'portfolio.title' ? 'portfolio.title' : 'collection.title');
    const textScope = ['role', 'all-headings'].includes(operation.scope) ? operation.scope : 'this';
    Object.entries(operation.patch || {}).forEach(([property, value]) => {
      handleTextEditChange({
        id: operation.target.id,
        role,
        scope: textScope,
        property,
        value,
      });
    });
    return;
  }

  if (operation.type === 'collectionVisibility') {
    const collectionTextId = collectionTextIdFromTarget(operation.target);
    if (!collectionTextId) return;
    ensureContentVisibility();
    if (!editedContent.visibility.collections[collectionTextId]) {
      editedContent.visibility.collections[collectionTextId] = { hiddenIn: [] };
    }
    const hiddenIn = editedContent.visibility.collections[collectionTextId].hiddenIn;
    if (operation.visible === false && !hiddenIn.includes(operation.presentationId)) {
      hiddenIn.push(operation.presentationId);
    }
    if (operation.visible !== false) {
      editedContent.visibility.collections[collectionTextId].hiddenIn = hiddenIn.filter((id) => id !== operation.presentationId);
    }
    patchPreview({ remount: true });
    syncEditChromeAfterLocalEdit();
    return;
  }

  if (operation.type === 'elementStylePatch') {
    ensureElementStyles();
    const bucket = (editedContent.elementStyles.versions[operation.versionKey] ||= {});
    const styleId = operation.scope === 'all-images'
      ? '__all_work__'
      : operation.scope === 'all-sections'
        ? '__all_collection__'
        : operation.styleId;
    const current = bucket[styleId] || {};
    bucket[styleId] = {
      patch: { ...(current.patch || {}), ...(operation.patch || {}) },
      imagePatch: { ...(current.imagePatch || {}), ...(operation.imagePatch || {}) },
    };
    patchPreview({ remount: true });
    syncEditChromeAfterLocalEdit();
    return;
  }

  if (operation.type === 'spacing') {
    if (operation.gridGap) {
      setCurrentVersionSpacingValue('gridGap', operation.gridGap);
      const gridGapSlider = document.getElementById('grid-gap');
      if (gridGapSlider) gridGapSlider.value = parseSpacingPx(operation.gridGap);
      document.getElementById('grid-gap-display').textContent = operation.gridGap;
    }
    if (operation.artSize) {
      setCurrentVersionSpacingValue('artSize', operation.artSize);
      const artSizeSlider = document.getElementById('art-size');
      if (artSizeSlider) artSizeSlider.value = parseSpacingPx(operation.artSize);
      document.getElementById('art-size-display').textContent = operation.artSize;
    }
    patchPreview({ remount: true });
    syncEditChromeAfterLocalEdit();
    return;
  }

  if (operation.type === 'noop') {
    return;
  }

  if (operation.type === 'needsGeneration') {
    return;
  }
}

function ensureLayoutOverrides(versionKey) {
  if (!editedContent.layoutOverrides) editedContent.layoutOverrides = {};
  if (!editedContent.layoutOverrides[versionKey]) editedContent.layoutOverrides[versionKey] = {};
  return editedContent.layoutOverrides[versionKey];
}

function ensureDecorations(versionKey) {
  if (!editedContent.decorations) editedContent.decorations = {};
  if (!editedContent.decorations.versions) editedContent.decorations.versions = {};
  if (!Array.isArray(editedContent.decorations.versions[versionKey])) {
    editedContent.decorations.versions[versionKey] = [];
  }
  return editedContent.decorations.versions[versionKey];
}

function applyPortfolioOperation(operation) {
  if (!operation) return false;
  const versionKey = operation.versionKey || getCurrentVersionKey();

  if (operation.type === 'colorPatch') {
    ensureVersionColorsObject(versionKey);
    editedTheme.versions[versionKey].colors = {
      ...editedTheme.versions[versionKey].colors,
      ...(operation.colors || {}),
    };
    syncPaletteSwatches();
    return true;
  }

  if (operation.type === 'typographyPatch') {
    Object.entries(operation.typography || {}).forEach(([token, values]) => {
      if (!TYPOGRAPHY_TOKENS.includes(token)) return;
      ensureVersionTypographyObject(versionKey, token);
      editedTheme.versions[versionKey].typography[token] = {
        ...editedTheme.versions[versionKey].typography[token],
        ...values,
      };
    });
    return true;
  }

  if (operation.type === 'spacing') {
    ensureVersionSpacingObject(versionKey);
    ['gridGap', 'artSize', 'imagePadding'].forEach((key) => {
      if (operation[key]) editedTheme.versions[versionKey].spacing[key] = operation[key];
    });
    syncSpacingControlsForCurrentVersion();
    return true;
  }

  if (operation.type === 'layoutOverride') {
    const overrides = ensureLayoutOverrides(versionKey);
    if (operation.collectionDisplay) overrides.collectionDisplay = operation.collectionDisplay;
    if (operation.materialTexture) overrides.materialTexture = operation.materialTexture;
    if (operation.metadataDisplay) overrides.metadataDisplay = operation.metadataDisplay;
    if (operation.socialPrototype) overrides.socialPrototype = operation.socialPrototype;
    return true;
  }

  if (operation.type === 'elementStylePatch') {
    ensureElementStyles();
    const bucket = (editedContent.elementStyles.versions[versionKey] ||= {});
    const styleId = operation.scope === 'all-sections' ? '__all_collection__' : '__all_work__';
    const current = bucket[styleId] || {};
    bucket[styleId] = {
      patch: { ...(current.patch || {}), ...(operation.patch || {}) },
      imagePatch: { ...(current.imagePatch || {}), ...(operation.imagePatch || {}) },
    };
    return true;
  }

  return false;
}

function getPreviewWidth() {
  return DESKTOP_PREVIEW_WIDTH;
}

function applyLayoutMetadata() {
  renderVersionButtons();

  const examples = document.getElementById('prompt-examples');
  if (!examples) return;

  examples.innerHTML = '';
  const chips = [
    ...PORTFOLIO_LAYOUTS.filter((l) => !l.generated).slice(0, 3),
    {
      name: 'Museum',
      examplePrompt:
        'A 2D skeuomorphic museum gallery — artwork in ornate gilded picture frames, horizontal scroll per collection, dark walnut walls.',
    },
    {
      name: 'Filing Cabinet',
      examplePrompt:
        'A skeuomorphic filing cabinet portfolio where each collection is a labeled drawer. The user must click a drawer to open it, revealing the images inside as papers or folders. Keep the cabinet closed by default and show the full artwork inside the opened drawer.',
    },
  ];

  chips.forEach((layout) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'prompt-example';
    chip.textContent = layout.name;
    chip.title = layout.examplePrompt;
    chip.addEventListener('click', () => {
      document.getElementById('ai-prompt').value = layout.examplePrompt;
      if (layout.designSpace) setDesignSpaceSelection(layout.designSpace);
    });
    examples.appendChild(chip);
  });

  renderDesignSpace();
}

function syncDeviceFrameLayoutClass() {
  const layout = getLayout(currentVersion);
  const isDirectory = layout?.key === 'directory';
  const isGenerated = Boolean(layout?.generated);
  const frame = document.getElementById('device-frame');
  const previewArea = document.querySelector('.preview-area');
  if (frame) {
    frame.classList.toggle('preview-directory', isDirectory);
    frame.classList.toggle('preview-generated', isGenerated);
  }
  if (previewArea) {
    previewArea.classList.toggle('preview-directory', isDirectory);
    previewArea.classList.toggle('preview-generated', isGenerated);
  }
}

function syncDesignSpaceActiveState() {
  document.querySelectorAll('.design-space-node').forEach((node) => {
    node.classList.toggle('active', Number(node.dataset.layoutId) === currentVersion);
  });
  document.querySelectorAll('.design-space-legend-item').forEach((item) => {
    item.classList.toggle('active', Number(item.dataset.layoutId) === currentVersion);
  });
}

function selectVersion(versionId, { renderMap = true } = {}) {
  currentVersion = versionId;
  const selectedLayout = getLayout(versionId);
  if (selectedLayout?.key) editedContent.selectedLayoutKey = selectedLayout.key;
  document.querySelectorAll('.version-btn:not(.create-btn)').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.version, 10) === versionId);
  });
  syncSpacingControlsForCurrentVersion();
  syncMetadataDisplayControl();
  syncSocialPrototypeControl();
  if (renderMap) {
    renderDesignSpace();
  } else {
    syncDesignSpaceActiveState();
    renderSidebarDesignAxes();
    setDesignSpaceSelection(selectedDesignSpace, { syncPrompt: false });
  }
  renderCustomDesignAxes();
  syncPaletteVisibility();
  syncPaletteSwatches();
  syncDeleteLayoutButton();
  syncPreviewReferenceChip();
  updatePreview();
  renderCollectionArranger();
  refreshInspectModel();
}

function syncDeleteLayoutButton() {
  const btn = document.getElementById('delete-layout-btn');
  if (!btn) return;
  const layout = getLayout(currentVersion);
  btn.hidden = !layout?.generated;
  btn.title = layout?.publicGenerated
    ? `Delete “${layout.name}” from this participant session`
    : layout?.generated ? `Delete “${layout.name}” and remove its files` : '';
}

function syncPreviewReferenceChip() {
  const chip = document.getElementById('preview-reference-chip');
  if (!chip) return;
  const layout = getLayout(currentVersion);
  if (!layout?.referenceImage) {
    chip.hidden = true;
    chip.innerHTML = '';
    return;
  }
  chip.hidden = false;
  chip.innerHTML = `
    <img src="${PortfolioContent.escapeHtml(layout.referenceImage)}" alt="">
    <span>Reference</span>
  `;
}

function renderVersionButtons() {
  const container = document.getElementById('version-buttons');
  if (!container) return;
  const createBtn = container.querySelector('.create-btn');
  container.querySelectorAll('.version-btn:not(.create-btn)').forEach((b) => b.remove());

  PORTFOLIO_LAYOUTS.forEach((layout) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'version-btn' + (layout.id === currentVersion ? ' active' : '');
    btn.dataset.version = String(layout.id);
    if (layout.referenceImage) {
      btn.classList.add('version-btn--reference');
      btn.innerHTML = `
        <img class="version-btn-reference" src="${PortfolioContent.escapeHtml(layout.referenceImage)}" alt="">
        <span>${PortfolioContent.escapeHtml(layout.generated ? `${layout.name} ✦` : layout.name)}</span>
      `;
    } else {
      btn.textContent = layout.generated ? `${layout.name} ✦` : layout.name;
    }
    btn.title = layout.examplePrompt || layout.prompt || layout.name;
    btn.addEventListener('click', () => selectVersion(layout.id));
    container.insertBefore(btn, createBtn || null);
  });
  syncDeleteLayoutButton();
  syncPreviewReferenceChip();
}

function setupDeleteLayout() {
  const btn = document.getElementById('delete-layout-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const layout = getLayout(currentVersion);
    if (!layout?.generated) return;

    const ok = confirm(
      `Delete “${layout.name}”?\n\nThis removes ${layout.file}, generated/${layout.key}/, and its theme colors. Built-in layouts are not affected.`
    );
    if (!ok) return;

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Deleting…';

    try {
      if (layout.publicGenerated) {
        editedContent.publicLayouts = (editedContent.publicLayouts || []).filter((item) => item.key !== layout.key);
        window.PORTFOLIO_LAYOUTS = (window.PORTFOLIO_LAYOUTS || []).filter((item) => item.key !== layout.key);
        if (editedTheme.versions?.[layout.key]) delete editedTheme.versions[layout.key];
        const fallback = window.PORTFOLIO_LAYOUTS[0];
        applyLayoutMetadata();
        if (fallback) selectVersion(fallback.id);
        await saveParticipantPortfolioRemotely();
        return;
      }
      requireLocalPortfolioApi('Deleting generated layouts');
      const data = await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/layouts/delete') || '/api/layouts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: layout.key }),
      });

      if (data.layouts) window.PORTFOLIO_LAYOUTS = data.layouts;
      pruneAxisScoresToCurrentLayouts({ persist: true });

      if (editedTheme.versions?.[layout.key]) {
        delete editedTheme.versions[layout.key];
        if (Object.keys(editedTheme.versions).length === 0) delete editedTheme.versions;
      }

      applyLayoutMetadata();
      selectVersion(1);
    } catch (e) {
      alert(`Could not delete layout:\n\n${e.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      syncDeleteLayoutButton();
    }
  });
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function axisName(axis) {
  return `${axisEndpointLabel(axis, 'left')} to ${axisEndpointLabel(axis, 'right')}`;
}

function sanitizeAxisEndpointImage(image) {
  if (!image || typeof image !== 'object') return null;
  const dataUrl = String(image.dataUrl || '');
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(dataUrl)) return null;
  return {
    dataUrl: dataUrl.slice(0, 140000),
    fileName: String(image.fileName || 'Endpoint image').slice(0, 80),
    summary: String(image.summary || '').slice(0, 240),
    keywords: Array.isArray(image.keywords)
      ? image.keywords.map((keyword) => String(keyword || '').trim().slice(0, 32)).filter(Boolean).slice(0, 3)
      : [],
    palette: Array.isArray(image.palette)
      ? image.palette.map((color) => String(color || '').slice(0, 24)).filter(Boolean).slice(0, 6)
      : [],
  };
}

function axisEndpointImage(axis, side) {
  if (axis?.endpointMode === 'concept') return null;
  return sanitizeAxisEndpointImage(side === 'right' ? axis?.rightImage : axis?.leftImage);
}

function axisEndpointConcept(axis, side) {
  if (axis?.endpointMode === 'image') return '';
  return String(side === 'right' ? axis?.rightLabel || '' : axis?.leftLabel || '').trim();
}

function axisEndpointLabel(axis, side) {
  const concept = axisEndpointConcept(axis, side);
  if (concept) return concept;
  const image = axisEndpointImage(axis, side);
  if (image) return image.fileName || `${side} image`;
  return side;
}

function axisHasEndpoint(axis, side) {
  return !!(axisEndpointConcept(axis, side) || axisEndpointImage(axis, side));
}

function axisHasBothEndpoints(axis) {
  return axisHasEndpoint(axis, 'left') && axisHasEndpoint(axis, 'right');
}

function axisEndpointPrompt(image, label) {
  const endpoint = sanitizeAxisEndpointImage(image);
  if (!endpoint) return '';
  const keywords = endpoint.keywords.length ? ` Keywords: ${endpoint.keywords.join(', ')}.` : '';
  const palette = endpoint.palette.length ? ` Palette: ${endpoint.palette.join(', ')}.` : '';
  const summary = endpoint.summary ? ` ${endpoint.summary}` : '';
  return `${label} endpoint image reference:${keywords}${summary}${palette}`.trim();
}

function axisEndpointKeywordsFromTokens(tokens) {
  const candidates = [
    ...(Array.isArray(tokens?.keywords) ? tokens.keywords : []),
    ...(Array.isArray(tokens?.mood) ? tokens.mood : []),
    ...(Array.isArray(tokens?.visualStyle) ? tokens.visualStyle : []),
    tokens?.layout?.density,
    tokens?.interfaceTranslation?.metaphor,
  ];
  const seen = new Set();
  return candidates
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => item && item.length <= 32 && !seen.has(item) && seen.add(item))
    .slice(0, 3);
}

function axisEndpointSummaryFromTokens(tokens) {
  return [
    tokens?.summary,
    Array.isArray(tokens?.visualStyle) && tokens.visualStyle.length ? `style: ${tokens.visualStyle.slice(0, 3).join(', ')}` : '',
    Array.isArray(tokens?.mood) && tokens.mood.length ? `mood: ${tokens.mood.slice(0, 3).join(', ')}` : '',
    tokens?.layout?.density ? `density: ${tokens.layout.density}` : '',
    tokens?.interfaceTranslation?.metaphor ? `metaphor: ${tokens.interfaceTranslation.metaphor}` : '',
  ].filter(Boolean).join('; ').slice(0, 240);
}

async function imageFileToFastDataUrlForAnalysis(file) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not prepare image for endpoint analysis'));
      image.src = sourceUrl;
    });

    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    if (scale >= 1 && file.size < 900_000) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read image file'));
        reader.readAsDataURL(file);
      });
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function enrichAxisEndpointImage(file, endpointData) {
  try {
    const image = await imageFileToFastDataUrlForAnalysis(file);
    const data = await analyzeImageDesignTokens({
      image,
      mimeType: file.type,
      fileName: file.name,
    });
    const tokens = data.tokens || {};
    const palette = Array.isArray(tokens.palette) && tokens.palette.length
      ? tokens.palette.map((color) => color.name || color.hex).filter(Boolean).slice(0, 6)
      : endpointData.palette;
    return {
      ...endpointData,
      keywords: axisEndpointKeywordsFromTokens(tokens),
      summary: axisEndpointSummaryFromTokens(tokens) || endpointData.summary,
      palette,
    };
  } catch {
    return endpointData;
  }
}

function axisEndpointImageToData(file) {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      try {
        const maxSide = 220;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const buckets = new Map();
        let saturation = 0;
        let lightness = 0;
        const step = 16;
        for (let i = 0; i < pixels.length; i += 4 * step) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          saturation += max ? (max - min) / max : 0;
          lightness += (max + min) / 510;
          const key = [r, g, b].map((channel) => Math.round(channel / 32) * 32).join(',');
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        const count = Math.max(1, Math.floor(pixels.length / (4 * step)));
        const palette = [...buckets.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map((n) => Math.max(0, Math.min(255, Number(n) || 0)));
            return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
          });
        const avgSaturation = saturation / count;
        const avgLightness = lightness / count;
        const summary = [
          avgSaturation > 0.42 ? 'high-chroma' : avgSaturation < 0.18 ? 'muted' : 'moderately colored',
          avgLightness > 0.62 ? 'light-toned' : avgLightness < 0.34 ? 'dark-toned' : 'mid-toned',
          image.naturalWidth > image.naturalHeight * 1.25 ? 'wide composition' : image.naturalHeight > image.naturalWidth * 1.25 ? 'vertical composition' : 'balanced composition',
        ].join(', ');
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.72),
          fileName: file.name || 'Endpoint image',
          summary,
          palette,
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('Could not read endpoint image'));
    };
    image.src = sourceUrl;
  });
}

function axisTerms(leftLabel, rightLabel, middle = []) {
  const terms = [
    { value: 0, label: leftLabel },
    ...middle,
    { value: 1, label: rightLabel },
  ];
  return terms.map((term) => ({
    value: clamp01(term.value),
    label: String(term.label || '').slice(0, 48),
    description: String(term.description || '').slice(0, 100),
  }));
}

function defaultTermsForAxis(axis) {
  const id = String(axis?.id || '');
  const left = axisEndpointLabel(axis, 'left');
  const right = axisEndpointLabel(axis, 'right');
  if (!axisHasBothEndpoints(axis)) return [];
  if (id === 'axis_visible_friction' || /visible/i.test(left) || /friction/i.test(right)) {
    return axisTerms(left || 'Visible', right || 'Friction', [
      { value: 0.18, label: 'open overview', description: 'everything is easy to scan' },
      { value: 0.36, label: 'browseable field', description: 'visible with light exploration' },
      { value: 0.55, label: 'guided encounter', description: 'some deliberate movement required' },
      { value: 0.74, label: 'slow reveal', description: 'visitor uncovers work through interaction' },
    ]);
  }
  if (id === 'axis_abstract_skeuomorphic' || /abstract/i.test(left) || /skeuomorphic/i.test(right)) {
    return axisTerms(left || 'Abstract', right || 'Skeuomorphic', [
      { value: 0.16, label: 'diagrammatic', description: 'interface-native structure' },
      { value: 0.32, label: 'symbolic object', description: 'object idea without full materiality' },
      { value: 0.5, label: 'material hint', description: 'texture and surface begin to matter' },
      { value: 0.68, label: 'tactile artifact', description: 'feels handled or physical' },
      { value: 0.84, label: 'world fragment', description: 'a small believable scene' },
    ]);
  }
  if (/(color|colour|vibrant|chromatic|saturated)/i.test(left) && /(mono|monochrome|monotone|gray|grey|neutral|desaturated)/i.test(right)) {
    return axisTerms(left, right, [
      { value: 0.18, label: 'color-forward', description: 'palette is expressive and varied' },
      { value: 0.34, label: 'tinted palette', description: 'color leads but feels restrained' },
      { value: 0.5, label: 'muted chroma', description: 'color is present but quiet' },
      { value: 0.66, label: 'near-neutral', description: 'mostly restrained with slight color' },
      { value: 0.82, label: 'tonal monochrome', description: 'value and texture carry the mood' },
    ]);
  }
  if (/(mono|monochrome|monotone|gray|grey|neutral|desaturated)/i.test(left) && /(color|colour|vibrant|chromatic|saturated)/i.test(right)) {
    return axisTerms(left, right, [
      { value: 0.18, label: 'tonal monochrome', description: 'value and texture carry the mood' },
      { value: 0.34, label: 'near-neutral', description: 'mostly restrained with slight color' },
      { value: 0.5, label: 'muted chroma', description: 'color is present but quiet' },
      { value: 0.66, label: 'tinted palette', description: 'color leads but feels restrained' },
      { value: 0.82, label: 'color-forward', description: 'palette is expressive and varied' },
    ]);
  }
  return axisTerms(left, right, [
    { value: 0.2, label: `mostly ${left}`, description: `leans toward ${left}` },
    { value: 0.4, label: `${left} with ${right}`, description: 'left concept with a right-side influence' },
    { value: 0.6, label: `${right} with ${left}`, description: 'right concept with a left-side influence' },
    { value: 0.8, label: `mostly ${right}`, description: `leans toward ${right}` },
  ]);
}

function createDefaultDesignAxes() {
  const layouts = window.PORTFOLIO_LAYOUTS || [];
  return [
    {
      id: 'axis_visible_friction',
      leftLabel: 'Visible',
      rightLabel: 'Friction',
      name: 'Visible to Friction',
      value: 0.5,
      mapRole: 'x',
      terms: axisTerms('Visible', 'Friction', [
        { value: 0.18, label: 'open overview', description: 'everything is easy to scan' },
        { value: 0.36, label: 'browseable field', description: 'visible with light exploration' },
        { value: 0.55, label: 'guided encounter', description: 'some deliberate movement required' },
        { value: 0.74, label: 'slow reveal', description: 'visitor uncovers work through interaction' },
      ]),
      scores: layouts.map((layout) => ({
        key: layout.key,
        name: layout.name,
        value: clamp01(layout.designSpace?.x ?? DESIGN_SPACE_DEFAULT.x),
        rationale: 'seeded example',
      })),
    },
    {
      id: 'axis_abstract_skeuomorphic',
      leftLabel: 'Abstract',
      rightLabel: 'Skeuomorphic',
      name: 'Abstract to Skeuomorphic',
      value: 0.5,
      mapRole: 'y',
      terms: axisTerms('Abstract', 'Skeuomorphic', [
        { value: 0.16, label: 'diagrammatic', description: 'interface-native structure' },
        { value: 0.32, label: 'symbolic object', description: 'object idea without full materiality' },
        { value: 0.5, label: 'material hint', description: 'texture and surface begin to matter' },
        { value: 0.68, label: 'tactile artifact', description: 'feels handled or physical' },
        { value: 0.84, label: 'world fragment', description: 'a small believable scene' },
      ]),
      scores: layouts.map((layout) => ({
        key: layout.key,
        name: layout.name,
        value: clamp01(layout.designSpace?.y ?? DESIGN_SPACE_DEFAULT.y),
        rationale: 'seeded example',
      })),
    },
  ];
}

function sanitizeStoredAxes(axes) {
  if (!Array.isArray(axes)) return [];
  return axes.map((axis) => {
    const rawLeftImage = sanitizeAxisEndpointImage(axis.leftImage);
    const rawRightImage = sanitizeAxisEndpointImage(axis.rightImage);
    const endpointMode = axis.endpointMode === 'image' || axis.leftMode === 'image' || axis.rightMode === 'image' || rawLeftImage || rawRightImage
      ? 'image'
      : 'concept';
    const leftImage = endpointMode === 'image' ? rawLeftImage : null;
    const rightImage = endpointMode === 'image' ? rawRightImage : null;
    const normalized = {
      id: String(axis.id || `axis_${Date.now()}`).slice(0, 80),
      endpointMode,
      leftLabel: endpointMode === 'image' ? '' : String(axis.leftLabel || '').slice(0, 48),
      rightLabel: endpointMode === 'image' ? '' : String(axis.rightLabel || '').slice(0, 48),
      leftImage,
      rightImage,
      name: '',
      value: clamp01(axis.value ?? 0.5),
      mapRole: ['x', 'y'].includes(axis.mapRole) ? axis.mapRole : '',
      terms: Array.isArray(axis.terms)
        ? axis.terms.map((term) => ({
        value: clamp01(term.value ?? 0.5),
        label: String(term.label || '').slice(0, 48),
        description: String(term.description || '').slice(0, 100),
        })).filter((term) => term.label).sort((a, b) => a.value - b.value)
        : [],
      scores: Array.isArray(axis.scores)
        ? axis.scores.map((score) => ({
        key: String(score.key || '').slice(0, 80),
        name: String(score.name || '').slice(0, 80),
        value: clamp01(score.value ?? 0.5),
        rationale: String(score.rationale || '').slice(0, 100),
        manual: !!score.manual,
        })).filter((score) => score.key)
        : [],
    };
    normalized.name = String(axisName(normalized)).slice(0, 80);
    if (!normalized.terms.length) normalized.terms = defaultTermsForAxis(normalized);
    return normalized;
  }).filter((axis) => axis.id);
}

function currentLayoutKeys() {
  return new Set((window.PORTFOLIO_LAYOUTS || []).map((layout) => layout.key));
}

function pruneAxisScoresToCurrentLayouts({ persist = false } = {}) {
  const keys = currentLayoutKeys();
  if (!keys.size) return false;
  let changed = false;
  customDesignAxes.forEach((axis) => {
    if (!Array.isArray(axis.scores)) return;
    const next = axis.scores.filter((score) => keys.has(score.key));
    if (next.length !== axis.scores.length) {
      axis.scores = next;
      changed = true;
    }
  });
  if (changed && persist) saveDesignAxes();
  return changed;
}

function fillAxisScoresForCurrentLayouts({ persist = false } = {}) {
  const layouts = window.PORTFOLIO_LAYOUTS || [];
  if (!layouts.length) return false;
  let changed = false;
  customDesignAxes.forEach((axis) => {
    if (!Array.isArray(axis.scores)) axis.scores = [];
    layouts.forEach((layout) => {
      if (axis.scores.some((score) => score.key === layout.key)) return;
      axis.scores.push({
        key: layout.key,
        name: layout.name,
        value: customAxisValueForGeneratedLayout(axis, layout),
        rationale: 'seeded from layout position',
      });
      changed = true;
    });
  });
  if (changed && persist) saveDesignAxes();
  return changed;
}

function loadDesignAxes() {
  const persisted = sanitizeStoredAxes(editedContent.designAxes || []);
  if (!isLocalPortfolioHost()) {
    return persisted.length ? persisted : createDefaultDesignAxes();
  }
  try {
    const stored = sanitizeStoredAxes(JSON.parse(localStorage.getItem(DESIGN_AXES_STORE) || '[]'));
    return stored.length ? stored : (persisted.length ? persisted : createDefaultDesignAxes());
  } catch {
    return persisted.length ? persisted : createDefaultDesignAxes();
  }
}

function saveDesignAxes() {
  editedContent.designAxes = sanitizeStoredAxes(customDesignAxes);
  if (isLocalPortfolioHost()) {
    try {
      localStorage.setItem(DESIGN_AXES_STORE, JSON.stringify(editedContent.designAxes));
    } catch {
      // Ignore storage failures; the in-memory prototype still works.
    }
    return;
  }

  const participantId = window.PortfolioSupabase?.participantIdFromLocation?.() || '';
  if (!participantId || !window.PortfolioSupabase?.isConfigured?.()) return;
  window.clearTimeout(designAxesRemoteSaveTimer);
  designAxesRemoteSaveTimer = window.setTimeout(async () => {
    try {
      await window.PortfolioSupabase.savePortfolio(participantId, editedTheme, editedContent);
    } catch (error) {
      console.warn('[design-axes] remote save failed:', error);
      setSupabaseStatus(`Could not save design axes: ${error.message || 'remote save failed'}`, { error: true, persist: true });
    }
  }, 500);
}

function mappedAxis(role) {
  return customDesignAxes.find((axis) => axis.mapRole === role) || null;
}

function mappedDesignAxes() {
  return ['x', 'y']
    .map((role) => mappedAxis(role))
    .filter(Boolean);
}

function axisScoreForLayout(axis, layout, fallback = 0.5) {
  const score = axis?.scores?.find((item) => item.key === layout?.key);
  return clamp01(score?.value ?? fallback);
}

function axisTermForValue(axis, value) {
  const terms = Array.isArray(axis?.terms) ? axis.terms.filter((term) => term.label) : [];
  if (!terms.length) return null;
  const v = clamp01(value);
  const sorted = terms.slice().sort((a, b) => clamp01(a.value) - clamp01(b.value));
  let nearest = sorted[0];
  sorted.forEach((term) => {
    if (Math.abs(clamp01(term.value) - v) < Math.abs(clamp01(nearest.value) - v)) nearest = term;
  });
  return nearest;
}

function axisTermText(axis, value) {
  const term = axisTermForValue(axis, value);
  return term ? term.label : `${Math.round(clamp01(value) * 100)}%`;
}

function activeAxisConcept(axis) {
  const activeScore = (axis.scores || []).find((score) => {
    const layout = (window.PORTFOLIO_LAYOUTS || []).find((item) => item.key === score.key);
    return layout?.id === currentVersion;
  });
  const value = clamp01(activeScore?.value ?? axis.value ?? 0.5);
  const concept = axisTermForValue(axis, value);
  return {
    label: concept?.label || axisTermText(axis, value),
    description: concept?.description || '',
    value,
  };
}

function getLayoutDesignSpace(layout) {
  const point = layout?.designSpace || {};
  const xAxis = mappedAxis('x');
  const yAxis = mappedAxis('y');
  return {
    x: axisScoreForLayout(xAxis, layout, point.x ?? DESIGN_SPACE_DEFAULT.x),
    y: axisScoreForLayout(yAxis, layout, point.y ?? DESIGN_SPACE_DEFAULT.y),
  };
}

function designSpaceBand(value, low, mid, high) {
  if (value < 0.34) return low;
  if (value > 0.66) return high;
  return mid;
}

function designSpaceReadout(point = selectedDesignSpace) {
  const xAxis = mappedAxis('x');
  const yAxis = mappedAxis('y');
  const xLabel = xAxis ? axisName(xAxis) : 'x axis';
  const yLabel = yAxis ? axisName(yAxis) : 'y axis';
  const xTerm = xAxis ? axisTermText(xAxis, point.x) : clamp01(point.x).toFixed(2);
  const yTerm = yAxis ? axisTermText(yAxis, point.y) : clamp01(point.y).toFixed(2);
  const custom = customDesignAxes.length ? ` · ${customDesignAxes.length} axes` : '';
  return `${xLabel}: ${xTerm}, ${yLabel}: ${yTerm}${custom}`;
}

function nearestDesignSpaceLayouts(point, limit = 2) {
  return (window.PORTFOLIO_LAYOUTS || [])
    .map((layout) => {
      const candidate = getLayoutDesignSpace(layout);
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      return { layout, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ layout }) => layout.name);
}

function buildDesignPromptScaffold(point = selectedDesignSpace) {
  const x = clamp01(point.x);
  const y = clamp01(point.y);
  const nearby = nearestDesignSpaceLayouts(point).join(' + ') || 'the existing portfolio templates';
  const axes = mappedDesignAxes()
    .filter(axisHasBothEndpoints)
    .map((axis) => {
      const value = clamp01(axis.value ?? 0.5);
      const currentTerm = axisTermForValue(axis, value);
      const concept = currentTerm ? currentTerm.label : axisTermText(axis, value);
      const endpointRefs = [
        axisEndpointPrompt(axis.leftImage, axisEndpointLabel(axis, 'left')),
        axisEndpointPrompt(axis.rightImage, axisEndpointLabel(axis, 'right')),
      ].filter(Boolean).join(' ');
      return `- ${axis.name || axisName(axis)}: ${concept}${endpointRefs ? ` (${endpointRefs})` : ''}`;
    });
  const xAxis = mappedAxis('x') || { leftLabel: 'Visible', rightLabel: 'Friction', name: 'Visible to Friction' };
  const yAxis = mappedAxis('y') || { leftLabel: 'Abstract', rightLabel: 'Skeuomorphic', name: 'Abstract to Skeuomorphic' };
  const concept = `${axisTermText(xAxis, x)} + ${axisTermText(yAxis, y)}`;

  return `${DESIGN_DIRECTION_MARKER}
Make something that feels like: ${concept}.
Use these as starting points: ${nearby}.
${axes.length ? `Other cues:\n${axes.join('\n')}` : 'Other cues: follow the selected point in the design map.'}`;
}

function promptWithoutDesignScaffold(value) {
  const text = String(value || '').trim();
  const markers = [DESIGN_DIRECTION_MARKER, DESIGN_SCAFFOLD_MARKER]
    .map((marker) => text.indexOf(marker))
    .filter((index) => index >= 0);
  const index = markers.length ? Math.min(...markers) : -1;
  return (index >= 0 ? text.slice(0, index) : text).trim();
}

function syncDesignPromptScaffold() {
  const textarea = document.getElementById('ai-prompt');
  if (!textarea) return;
  const base = promptWithoutDesignScaffold(textarea.value);
  textarea.value = base;
  if (!designSpacePointSelected) {
    activeDesignDirectionPrompt = '';
    renderDesignDirectionCard();
    return;
  }
  activeDesignDirectionPrompt = buildDesignPromptScaffold(selectedDesignSpace);
  renderDesignDirectionCard();
}

function designDirectionSummary(prompt = activeDesignDirectionPrompt) {
  return String(prompt || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== DESIGN_DIRECTION_MARKER)
    .join(' ');
}

function renderDesignDirectionCard() {
  const card = document.getElementById('design-direction-card');
  if (!card) return;
  if (!activeDesignDirectionPrompt) {
    card.hidden = true;
    card.innerHTML = '';
    return;
  }
  card.hidden = false;
  card.innerHTML = `
    <div>
      <strong>Design direction</strong>
      <p>${PortfolioContent.escapeHtml(designDirectionSummary())}</p>
    </div>
    <button class="design-direction-remove" type="button" aria-label="Remove design direction">&times;</button>
  `;
}

function setupDesignDirectionCard() {
  const card = document.getElementById('design-direction-card');
  if (!card) return;
  card.addEventListener('click', (event) => {
    if (!event.target.closest('.design-direction-remove')) return;
    activeDesignDirectionPrompt = '';
    designSpacePointSelected = false;
    renderDesignDirectionCard();
    pendingGeneratePrompt = '';
    pendingGenerateQuestion = null;
    pendingGenerateAnswers = [];
    pendingGenerateReady = false;
    const questionsEl = document.getElementById('generate-questions');
    if (questionsEl) {
      questionsEl.hidden = true;
      questionsEl.innerHTML = '';
    }
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) generateBtn.textContent = 'Generate version';
  });
}

function setDesignSpaceSelection(point, { syncPrompt = true, userSelected = false } = {}) {
  if (userSelected) designSpacePointSelected = true;
  const mode = getDesignSpaceMode();
  const xAxis = mappedAxis('x');
  const yAxis = mappedAxis('y');
  if (mode === 'x') {
    if (xAxis) xAxis.value = clamp01(point.x);
  } else if (mode === 'y') {
    if (yAxis) yAxis.value = clamp01(point.x);
  } else {
    if (xAxis) xAxis.value = clamp01(point.x);
    if (yAxis) yAxis.value = clamp01(point.y);
  }
  if (xAxis || yAxis) saveDesignAxes();
  selectedDesignSpace = {
    x: mode === 'y' ? 0.5 : clamp01(point.x),
    y: mode === 'x' ? 0.5 : clamp01(mode === 'y' ? point.x : point.y),
    customAxes: mappedDesignAxes().map((axis) => ({
      id: axis.id,
      name: axis.name,
      leftLabel: axis.leftLabel,
      rightLabel: axis.rightLabel,
      leftImage: sanitizeAxisEndpointImage(axis.leftImage),
      rightImage: sanitizeAxisEndpointImage(axis.rightImage),
      endpointMode: axis.endpointMode || 'concept',
      value: clamp01(axis.value ?? 0.5),
      scores: axis.scores || [],
      terms: axis.terms || [],
      mapRole: axis.mapRole || '',
    })),
    xAxis: xAxis ? { id: xAxis.id, name: xAxis.name || axisName(xAxis), leftLabel: axisEndpointLabel(xAxis, 'left'), rightLabel: axisEndpointLabel(xAxis, 'right'), terms: xAxis.terms || [] } : null,
    yAxis: yAxis ? { id: yAxis.id, name: yAxis.name || axisName(yAxis), leftLabel: axisEndpointLabel(yAxis, 'left'), rightLabel: axisEndpointLabel(yAxis, 'right'), terms: yAxis.terms || [] } : null,
  };

  document.querySelectorAll('.design-space-selection').forEach((selection) => {
    selection.style.left = `${selectedDesignSpace.x * 100}%`;
    selection.style.top = `${(1 - selectedDesignSpace.y) * 100}%`;
  });

  const readout = document.getElementById('design-space-readout');
  if (readout) readout.textContent = designSpaceReadout(selectedDesignSpace);
  if (syncPrompt) syncDesignPromptScaffold();
}

function generationDesignSpaceSelection() {
  if (!designSpacePointSelected) return null;
  return {
    ...selectedDesignSpace,
    customAxes: (selectedDesignSpace.customAxes || []).filter((axis) => axis.mapRole === 'x' || axis.mapRole === 'y'),
  };
}

function syncCustomAxesToDesignSpace({ syncPrompt = true } = {}) {
  const xAxis = mappedAxis('x');
  const yAxis = mappedAxis('y');
  selectedDesignSpace.x = clamp01(xAxis?.value ?? selectedDesignSpace.x);
  selectedDesignSpace.y = clamp01(yAxis?.value ?? selectedDesignSpace.y);
  selectedDesignSpace.customAxes = mappedDesignAxes().map((axis) => ({
    id: axis.id,
    name: axis.name || axisName(axis),
    leftLabel: axis.leftLabel,
    rightLabel: axis.rightLabel,
    leftImage: sanitizeAxisEndpointImage(axis.leftImage),
    rightImage: sanitizeAxisEndpointImage(axis.rightImage),
    endpointMode: axis.endpointMode || 'concept',
    value: clamp01(axis.value ?? 0.5),
    scores: axis.scores || [],
    terms: axis.terms || [],
    mapRole: axis.mapRole || '',
  }));
  selectedDesignSpace.xAxis = xAxis ? { id: xAxis.id, name: xAxis.name || axisName(xAxis), leftLabel: axisEndpointLabel(xAxis, 'left'), rightLabel: axisEndpointLabel(xAxis, 'right'), terms: xAxis.terms || [] } : null;
  selectedDesignSpace.yAxis = yAxis ? { id: yAxis.id, name: yAxis.name || axisName(yAxis), leftLabel: axisEndpointLabel(yAxis, 'left'), rightLabel: axisEndpointLabel(yAxis, 'right'), terms: yAxis.terms || [] } : null;
  document.querySelectorAll('.design-space-selection').forEach((selection) => {
    selection.style.left = `${selectedDesignSpace.x * 100}%`;
    selection.style.top = `${(1 - selectedDesignSpace.y) * 100}%`;
  });
  const readout = document.getElementById('design-space-readout');
  if (readout) readout.textContent = designSpaceReadout(selectedDesignSpace);
  if (syncPrompt) syncDesignPromptScaffold();
}

function layoutNameByKey(key) {
  return (window.PORTFOLIO_LAYOUTS || []).find((layout) => layout.key === key)?.name || key;
}

function colorForLayout(layoutOrKey) {
  const key = typeof layoutOrKey === 'string' ? layoutOrKey : layoutOrKey?.key;
  const layouts = window.PORTFOLIO_LAYOUTS || [];
  const index = layouts.findIndex((layout) => layout.key === key);
  if (index >= 0) return DESIGN_SPACE_COLORS[index % DESIGN_SPACE_COLORS.length];
  let hash = 0;
  String(key || '').split('').forEach((char) => {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  });
  return DESIGN_SPACE_COLORS[Math.abs(hash) % DESIGN_SPACE_COLORS.length];
}

function openLayoutFromDesignSpace(layout) {
  if (!layout) return;
  customDesignAxes.forEach((axis) => {
    const score = ensureAxisScore(axis, layout);
    score.name = layout.name;
  });
  saveDesignAxes();
  selectVersion(layout.id, { renderMap: false });
}

function markAxisForMap(axis, role) {
  customDesignAxes.forEach((item) => {
    if (item !== axis && item.mapRole === role) item.mapRole = '';
  });
  axis.mapRole = axis.mapRole === role ? '' : role;
  saveDesignAxes();
  syncCustomAxesToDesignSpace();
  renderDesignSpace();
  renderCustomDesignAxes();
}

function ensureAxisScore(axis, layout) {
  if (!axis.scores) axis.scores = [];
  let score = axis.scores.find((item) => item.key === layout.key);
  if (!score) {
    const fallbackPoint = layout.designSpace || DESIGN_SPACE_DEFAULT;
    score = {
      key: layout.key,
      name: layout.name,
      value: clamp01(axis.mapRole === 'y' ? fallbackPoint.y : fallbackPoint.x),
      rationale: 'manual',
    };
    axis.scores.push(score);
  }
  return score;
}

function customAxisValueForGeneratedLayout(axis, layout) {
  const generatedAxis = layout?.designSpace?.customAxes?.find((item) => item.id === axis.id);
  if (generatedAxis) return clamp01(generatedAxis.value ?? axis.value ?? 0.5);
  if (axis.mapRole === 'x') return clamp01(layout?.designSpace?.x ?? axis.value ?? 0.5);
  if (axis.mapRole === 'y') return clamp01(layout?.designSpace?.y ?? axis.value ?? 0.5);
  return clamp01(axis.value ?? 0.5);
}

function placeGeneratedLayoutOnAxes(layout, { explicitPoint = true } = {}) {
  if (!layout?.key || !customDesignAxes.length) return;
  customDesignAxes.forEach((axis) => {
    if (!axis.scores) axis.scores = [];
    let score = axis.scores.find((item) => item.key === layout.key);
    if (!score) {
      score = { key: layout.key };
      axis.scores.push(score);
    }
    score.name = layout.name;
    score.value = customAxisValueForGeneratedLayout(axis, layout);
    score.rationale = explicitPoint ? 'generated at selected axis position' : 'generated from inferred design ranking';
  });
  saveDesignAxes();
  syncCustomAxesToDesignSpace({ syncPrompt: false });
  renderCustomDesignAxes();
  renderSidebarDesignAxes();
  renderDesignSpace();
}

function updateAxisScoreFromPointer(axis, layout, clientX, track, note = null) {
  const rect = track.getBoundingClientRect();
  const value = clamp01((clientX - rect.left) / rect.width);
  const score = ensureAxisScore(axis, layout);
  score.value = value;
  score.name = layout.name;
  score.rationale = 'artist corrected';
  score.manual = true;
  saveDesignAxes();
  if (note) {
    note.classList.add('manual');
    note.style.setProperty('--axis-value', value);
    note.title = `${layout.name}: ${Math.round(value * 100)}% - artist corrected`;
  }
  syncCustomAxesToDesignSpace();
  renderDesignSpace();
}

function renderCustomDesignAxes() {
  const list = document.getElementById('custom-axis-list');
  if (!list) return;
  list.innerHTML = '';

  customDesignAxes.forEach((axis, axisIndex) => {
    const activeConcept = activeAxisConcept(axis);
    const endpointMode = axis.endpointMode === 'image' || axis.leftImage || axis.rightImage ? 'image' : 'concept';
    const conceptLabel = Array.isArray(axis.terms) && axis.terms.length
      ? `<div class="axis-term-ladder" title="${PortfolioContent.escapeHtml(activeConcept.description || `${Math.round(activeConcept.value * 100)}% on this axis`)}">Closest concept: ${PortfolioContent.escapeHtml(activeConcept.label)}</div>`
      : '';
    const row = document.createElement('div');
    row.className = 'custom-axis';
    row.innerHTML = `
      <div class="custom-axis-toolbar">
        <select class="custom-axis-mode" data-axis-mode aria-label="Endpoint type">
          <option value="concept"${endpointMode === 'concept' ? ' selected' : ''}>Concepts</option>
          <option value="image"${endpointMode === 'image' ? ' selected' : ''}>Images</option>
        </select>
        <div class="custom-axis-actions">
          <div class="custom-axis-map-controls" aria-label="Map axis role">
            <button class="ghost-btn custom-axis-map ${axis.mapRole === 'x' ? 'active' : ''}" type="button" data-map-role="x" title="Use as horizontal map axis">X</button>
            <button class="ghost-btn custom-axis-map ${axis.mapRole === 'y' ? 'active' : ''}" type="button" data-map-role="y" title="Use as vertical map axis">Y</button>
          </div>
          <button class="ghost-btn custom-axis-rank" type="button" title="Rank websites on this axis">Rank</button>
          <button class="ghost-btn custom-axis-remove" type="button" aria-label="Remove axis">x</button>
        </div>
      </div>
      <div class="custom-axis-endpoints" aria-label="Axis endpoints">
        <div class="custom-axis-endpoint" data-axis-endpoint="left">
          <span class="custom-axis-endpoint-label">Left endpoint</span>
          ${endpointMode === 'concept' ? `
            <input class="custom-axis-endpoint-concept" type="text" data-axis-field="leftLabel" value="${PortfolioContent.escapeHtml(axis.leftLabel || '')}" placeholder="Concept">
          ` : ''}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          ${endpointMode === 'image' ? `
            <button class="custom-axis-endpoint-pick" type="button" title="Choose left endpoint image">
              ${axis.leftImage?.dataUrl ? `<img src="${axis.leftImage.dataUrl}" alt="">` : '<span>Add left image</span>'}
            </button>
            ${axis.leftImage?.keywords?.length ? `<div class="custom-axis-endpoint-keywords">${axis.leftImage.keywords.map((keyword) => PortfolioContent.escapeHtml(keyword)).join(', ')}</div>` : ''}
            ${axis.leftImage?.dataUrl ? '<button class="custom-axis-endpoint-clear" type="button" aria-label="Remove left endpoint image">x</button>' : ''}
          ` : ''}
        </div>
        <div class="custom-axis-endpoint" data-axis-endpoint="right">
          <span class="custom-axis-endpoint-label">Right endpoint</span>
          ${endpointMode === 'concept' ? `
            <input class="custom-axis-endpoint-concept" type="text" data-axis-field="rightLabel" value="${PortfolioContent.escapeHtml(axis.rightLabel || '')}" placeholder="Concept">
          ` : ''}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          ${endpointMode === 'image' ? `
            <button class="custom-axis-endpoint-pick" type="button" title="Choose right endpoint image">
              ${axis.rightImage?.dataUrl ? `<img src="${axis.rightImage.dataUrl}" alt="">` : '<span>Add right image</span>'}
            </button>
            ${axis.rightImage?.keywords?.length ? `<div class="custom-axis-endpoint-keywords">${axis.rightImage.keywords.map((keyword) => PortfolioContent.escapeHtml(keyword)).join(', ')}</div>` : ''}
            ${axis.rightImage?.dataUrl ? '<button class="custom-axis-endpoint-clear" type="button" aria-label="Remove right endpoint image">x</button>' : ''}
          ` : ''}
        </div>
      </div>
      <div class="custom-axis-rank-row">
        <span>${PortfolioContent.escapeHtml(axisEndpointLabel(axis, 'left'))}</span>
        <div class="custom-axis-notes" aria-label="Ranked website notes"></div>
        <span>${PortfolioContent.escapeHtml(axisEndpointLabel(axis, 'right'))}</span>
      </div>
      ${conceptLabel}
    `;

    row.querySelectorAll('input[type="text"]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.axisField;
        axis.endpointMode = 'concept';
        axis[field] = input.value.trim();
        axis.leftImage = null;
        axis.rightImage = null;
        axis.name = axisName(axis);
        axis.scores = [];
        axis.terms = defaultTermsForAxis(axis);
        saveDesignAxes();
        renderCustomDesignAxes();
        renderSidebarDesignAxes();
        syncCustomAxesToDesignSpace();
      });
    });

    row.querySelector('[data-axis-mode]')?.addEventListener('change', (e) => {
      axis.endpointMode = e.target.value === 'image' ? 'image' : 'concept';
      if (axis.endpointMode === 'image') {
        axis.leftLabel = '';
        axis.rightLabel = '';
      } else {
        axis.leftImage = null;
        axis.rightImage = null;
      }
      axis.name = axisName(axis);
      axis.scores = [];
      axis.terms = defaultTermsForAxis(axis);
      saveDesignAxes();
      syncCustomAxesToDesignSpace();
      renderCustomDesignAxes();
      renderSidebarDesignAxes();
    });

    row.querySelectorAll('.custom-axis-map').forEach((button) => {
      button.addEventListener('click', () => markAxisForMap(axis, button.dataset.mapRole));
    });

    row.querySelectorAll('.custom-axis-endpoint').forEach((endpoint) => {
      const side = endpoint.dataset.axisEndpoint === 'right' ? 'rightImage' : 'leftImage';
      const input = endpoint.querySelector('input[type="file"]');
      endpoint.querySelector('.custom-axis-endpoint-pick')?.addEventListener('click', () => input?.click());
      input?.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const pickButton = endpoint.querySelector('.custom-axis-endpoint-pick');
        const previousPickText = pickButton?.textContent || '';
        if (pickButton) {
          pickButton.disabled = true;
          pickButton.textContent = 'Reading...';
        }
        try {
          axis.endpointMode = 'image';
          const endpointData = await axisEndpointImageToData(file);
          axis[side] = await enrichAxisEndpointImage(file, endpointData);
          axis.leftLabel = '';
          axis.rightLabel = '';
          axis.name = axisName(axis);
          axis.scores = [];
          axis.terms = defaultTermsForAxis(axis);
          saveDesignAxes();
          syncCustomAxesToDesignSpace();
          renderCustomDesignAxes();
        } catch (err) {
          alert(`Could not add endpoint image:\n\n${err.message}`);
        } finally {
          if (pickButton) {
            pickButton.disabled = false;
            pickButton.textContent = previousPickText;
          }
        }
      });
      endpoint.querySelector('.custom-axis-endpoint-clear')?.addEventListener('click', () => {
        axis[side] = null;
        axis.endpointMode = 'image';
        axis.name = axisName(axis);
        axis.terms = defaultTermsForAxis(axis);
        saveDesignAxes();
        syncCustomAxesToDesignSpace();
        renderCustomDesignAxes();
      });
    });

    row.querySelector('.custom-axis-rank').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await scoreCustomDesignAxis(axis);
      } catch (err) {
        alert(`Could not rank layouts:\n\n${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Rank';
      }
    });

    row.querySelector('.custom-axis-remove').addEventListener('click', () => {
      customDesignAxes.splice(axisIndex, 1);
      saveDesignAxes();
      renderCustomDesignAxes();
      renderSidebarDesignAxes();
      syncCustomAxesToDesignSpace();
    });

    const notes = row.querySelector('.custom-axis-notes');
    if (axis.scores?.length) {
      axis.scores.filter((score) => currentLayoutKeys().has(score.key)).forEach((score) => {
        const layout = (window.PORTFOLIO_LAYOUTS || []).find((item) => item.key === score.key);
        if (!layout) return;
        const note = document.createElement('button');
        note.type = 'button';
        note.className = 'custom-axis-note';
        if (score.manual) note.classList.add('manual');
        if (layout?.id === currentVersion) note.classList.add('active');
        note.dataset.label = layoutNameByKey(score.key);
        note.title = `${layoutNameByKey(score.key)}: ${Math.round(clamp01(score.value) * 100)}%${score.manual ? ' - artist corrected' : score.rationale ? ` - ${score.rationale}` : ''}`;
        note.style.setProperty('--axis-value', clamp01(score.value));
        note.style.setProperty('--node-color', colorForLayout(layout));
        note.addEventListener('click', () => {
          openLayoutFromDesignSpace(layout);
        });
        note.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          draggingAxisNote = { axis, layout, track: notes, note };
          note.setPointerCapture?.(e.pointerId);
        });
        notes.appendChild(note);
      });
    }
    list.appendChild(row);
  });
}

function renderSidebarDesignAxes() {
  const list = document.getElementById('sidebar-axis-list');
  if (!list) return;
  list.innerHTML = '';

  customDesignAxes.forEach((axis) => {
    const activeConcept = activeAxisConcept(axis);
    const conceptLabel = Array.isArray(axis.terms) && axis.terms.length
      ? `<div class="axis-term-ladder axis-term-ladder--sidebar" title="${PortfolioContent.escapeHtml(activeConcept.description || `${Math.round(activeConcept.value * 100)}% on this axis`)}">Closest concept: ${PortfolioContent.escapeHtml(activeConcept.label)}</div>`
      : '';
    const row = document.createElement('div');
    row.className = 'sidebar-axis';
    row.innerHTML = `
      <div class="sidebar-axis-labels">
        <span>${PortfolioContent.escapeHtml(axisEndpointLabel(axis, 'left'))}</span>
        <span>${PortfolioContent.escapeHtml(axisEndpointLabel(axis, 'right'))}</span>
      </div>
      <div class="sidebar-axis-notes" aria-label="${PortfolioContent.escapeHtml(axis.name || axisName(axis))} ranked websites"></div>
      ${conceptLabel}
    `;

    const notes = row.querySelector('.sidebar-axis-notes');
    (axis.scores || []).filter((score) => currentLayoutKeys().has(score.key)).forEach((score) => {
      const layout = (window.PORTFOLIO_LAYOUTS || []).find((item) => item.key === score.key);
      if (!layout) return;
      const note = document.createElement('button');
      note.type = 'button';
      note.className = 'sidebar-axis-note';
      if (score.manual) note.classList.add('manual');
      if (layout.id === currentVersion) note.classList.add('active');
      note.dataset.label = layoutNameByKey(score.key);
      note.title = `${layoutNameByKey(score.key)}: ${Math.round(clamp01(score.value) * 100)}%`;
      note.style.setProperty('--axis-value', clamp01(score.value));
      note.style.setProperty('--node-color', colorForLayout(layout));
      note.addEventListener('click', () => openLayoutFromDesignSpace(layout));
      notes.appendChild(note);
    });

    list.appendChild(row);
  });
}

async function scoreCustomDesignAxis(axis) {
  if (!axisHasBothEndpoints(axis)) {
    alert('Add a concept or an image for both ends of the axis first.');
    return;
  }
  const manualScores = new Map((axis.scores || []).filter((score) => score.manual).map((score) => [score.key, score]));
  const payload = {
    axis: {
      ...axis,
      leftLabel: axisEndpointLabel(axis, 'left'),
      rightLabel: axisEndpointLabel(axis, 'right'),
      leftImage: axisEndpointPrompt(axis.leftImage, axisEndpointLabel(axis, 'left')),
      rightImage: axisEndpointPrompt(axis.rightImage, axisEndpointLabel(axis, 'right')),
    },
    layouts: (window.PORTFOLIO_LAYOUTS || []).map((layout) => ({
      key: layout.key,
      name: layout.name,
      metaphor: layout.metaphor,
      description: layout.prompt || layout.examplePrompt || '',
      generated: Boolean(layout.generated),
      designSpace: layout.designSpace || null,
      colorKeys: layout.colorKeys || [],
    })),
  };
  let data;
  if (isLocalPortfolioHost()) {
    data = await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/design-axis') || '/api/design-axis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    if (!window.PortfolioSupabase?.isConfigured?.()) {
      throw new Error('Layout ranking needs Supabase on the public editor.');
    }
    data = await window.PortfolioSupabase.invoke('design-axis', payload);
  }
  axis.scores = (data.scores || []).map((score) => ({
    ...score,
    name: layoutNameByKey(score.key),
    ...(manualScores.get(score.key) || {}),
  }));
  axis.terms = Array.isArray(data.terms) ? data.terms : axis.terms || [];
  saveDesignAxes();
  syncCustomAxesToDesignSpace();
  renderCustomDesignAxes();
  renderSidebarDesignAxes();
  renderDesignSpace();
}

function layoutPreviewSrc(layout) {
  return layout?.file || `${layout?.key || 'grid'}.html`;
}

function getDesignSpaceMode() {
  const hasX = !!mappedAxis('x');
  const hasY = !!mappedAxis('y');
  if (hasX && hasY) return 'xy';
  if (hasX) return 'x';
  if (hasY) return 'y';
  return 'xy';
}

function getLayoutMapPoint(layout, mode = getDesignSpaceMode()) {
  const point = getLayoutDesignSpace(layout);
  if (mode === 'x') return { x: point.x, y: 0.5 };
  if (mode === 'y') return { x: point.y, y: 0.5 };
  return point;
}

function designSpaceClusterOffsets(layouts, mode, preview = false) {
  const groups = new Map();
  layouts.forEach((layout) => {
    const point = getLayoutMapPoint(layout, mode);
    const key = `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(layout.key || String(layout.id));
  });
  const offsets = new Map();
  groups.forEach((keys) => {
    if (keys.length <= 1) return;
    const radius = preview ? Math.min(96, 34 + keys.length * 8) : Math.min(22, 7 + keys.length * 2);
    keys.forEach((key, index) => {
      const angle = (-Math.PI / 2) + (index * Math.PI * 2 / keys.length);
      offsets.set(key, {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      });
    });
  });
  return offsets;
}

function createDesignSpaceNode(layout, index, { preview = false, mode = 'xy', offsets = new Map() } = {}) {
  const point = getLayoutMapPoint(layout, mode);
  const offset = offsets.get(layout.key || String(layout.id)) || { x: 0, y: 0 };
  const color = colorForLayout(layout);
  const node = document.createElement(preview ? 'div' : 'button');
  if (!preview) node.type = 'button';
  if (preview) {
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
  }
  node.className = preview ? 'design-space-node design-space-node--preview' : 'design-space-node';
  if (preview && layout.key) {
    node.classList.add(`design-space-node--${String(layout.key).replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  }
  if (layout.id === currentVersion) node.classList.add('active');
  node.dataset.layoutId = String(layout.id);
  node.dataset.layoutKey = layout.key || '';
  node.dataset.label = layout.generated ? `${layout.name} *` : layout.name;
  node.style.setProperty('--node-x', `${point.x * 100}%`);
  node.style.setProperty('--node-y', `${(1 - point.y) * 100}%`);
  node.style.setProperty('--node-offset-x', `${offset.x}px`);
  node.style.setProperty('--node-offset-y', `${offset.y}px`);
  node.style.setProperty('--node-color', color);
  node.title = layout.name;

  if (preview) {
    const referenceMarkup = layout.referenceImage
      ? `<span class="design-space-node-reference"><img src="${PortfolioContent.escapeHtml(layout.referenceImage)}" alt=""></span>`
      : '';
    node.innerHTML = `
      <span class="design-space-node-preview">
        <iframe src="${PortfolioContent.escapeHtml(layoutPreviewSrc(layout))}" tabindex="-1" loading="lazy"></iframe>
      </span>
      ${referenceMarkup}
      <span class="design-space-node-label">${PortfolioContent.escapeHtml(layout.name)}</span>
    `;
  }

  node.addEventListener('click', (e) => {
    e.stopPropagation();
    openLayoutFromDesignSpace(layout);
  });
  if (preview) {
    node.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openLayoutFromDesignSpace(layout);
    });
  }
  return { node, color };
}

function renderDesignSpacePlane(plane, legend, { preview = false, mode = 'xy' } = {}) {
  if (!plane || !legend) return;
  plane.querySelectorAll('.design-space-node').forEach((node) => node.remove());
  legend.innerHTML = '';
  const layouts = window.PORTFOLIO_LAYOUTS || [];
  const offsets = designSpaceClusterOffsets(layouts, mode, preview);
  layouts.forEach((layout, index) => {
    const { node, color } = createDesignSpaceNode(layout, index, { preview, mode, offsets });
    plane.appendChild(node);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'design-space-legend-item';
    item.dataset.layoutId = String(layout.id);
    item.dataset.layoutKey = layout.key || '';
    if (layout.id === currentVersion) item.classList.add('active');
    item.innerHTML = `<span class="design-space-legend-dot" style="--node-color: ${color}"></span>${layout.name}`;
    item.addEventListener('click', () => openLayoutFromDesignSpace(layout));
    legend.appendChild(item);
  });
}

function syncDesignSpaceAxisLabels() {
  const xAxis = mappedAxis('x') || { leftLabel: 'Visible', rightLabel: 'Friction' };
  const yAxis = mappedAxis('y') || { leftLabel: 'Abstract', rightLabel: 'Skeuomorphic' };
  const mode = getDesignSpaceMode();
  const horizontalAxis = mode === 'y' ? yAxis : xAxis;
  document.querySelectorAll('.axis-label--left').forEach((label) => { label.textContent = axisEndpointLabel(xAxis, 'left') || 'Left'; });
  document.querySelectorAll('.axis-label--right').forEach((label) => { label.textContent = axisEndpointLabel(xAxis, 'right') || 'Right'; });
  document.querySelectorAll('.axis-label--bottom').forEach((label) => { label.textContent = axisEndpointLabel(yAxis, 'left') || 'Bottom'; });
  document.querySelectorAll('.axis-label--top').forEach((label) => { label.textContent = axisEndpointLabel(yAxis, 'right') || 'Top'; });
  if (mode !== 'xy') {
    document.querySelectorAll('.axis-label--left').forEach((label) => { label.textContent = axisEndpointLabel(horizontalAxis, 'left') || 'Left'; });
    document.querySelectorAll('.axis-label--right').forEach((label) => { label.textContent = axisEndpointLabel(horizontalAxis, 'right') || 'Right'; });
  }
}

function renderDesignSpace() {
  const mode = getDesignSpaceMode();
  document.querySelectorAll('.design-space').forEach((plane) => {
    plane.dataset.axisMode = mode;
    plane.closest('.design-space-wrap')?.setAttribute('data-axis-mode', mode);
  });
  syncDesignSpaceAxisLabels();
  renderDesignSpacePlane(
    document.getElementById('design-space'),
    document.getElementById('design-space-legend'),
    { preview: false, mode }
  );
  renderDesignSpacePlane(
    document.getElementById('expanded-design-space'),
    document.getElementById('expanded-design-space-legend'),
    { preview: true, mode }
  );
  renderSidebarDesignAxes();
  setDesignSpaceSelection(selectedDesignSpace, { syncPrompt: false });
}

function setupDesignSpaceInstrument() {
  if (!customDesignAxes.length) {
    customDesignAxes = loadDesignAxes();
    pruneAxisScoresToCurrentLayouts({ persist: true });
    fillAxisScoresForCurrentLayouts({ persist: true });
    syncCustomAxesToDesignSpace({ syncPrompt: false });
  }

  document.querySelectorAll('.design-space').forEach((plane) => {
    plane.addEventListener('click', (e) => {
      const rect = plane.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - ((e.clientY - rect.top) / rect.height);
      const mode = getDesignSpaceMode();
      setDesignSpaceSelection(mode === 'xy' ? { x, y } : { x, y: 0.5 }, { userSelected: true });
    });

    plane.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      setDesignSpaceSelection(selectedDesignSpace, { userSelected: true });
    });
  });

  const addAxis = document.getElementById('add-design-axis');
  if (addAxis) {
    addAxis.addEventListener('click', () => {
      const axis = {
        id: `axis_${Date.now()}`,
        leftLabel: '',
        rightLabel: '',
        name: 'left to right',
        value: 0.5,
        mapRole: '',
        scores: [],
      };
      customDesignAxes.push(axis);
      saveDesignAxes();
      renderCustomDesignAxes();
      renderSidebarDesignAxes();
      syncCustomAxesToDesignSpace();
    });
  }

  const expandedPanel = document.getElementById('design-space-expanded');
  const container = document.getElementById('edit-container');
  const showDesignSpaceBtn = document.getElementById('show-design-space');

  const setDesignSidebarHidden = (hidden) => {
    if (!container) return;
    container.classList.toggle('design-sidebar-hidden', hidden);
    document.body.classList.toggle('design-sidebar-hidden', hidden);
    if (showDesignSpaceBtn) showDesignSpaceBtn.hidden = !hidden;
    if (hidden && expandedPanel) {
      expandedPanel.hidden = true;
      container.classList.remove('design-space-expanded-open');
    }
    try {
      localStorage.setItem(DESIGN_SIDEBAR_HIDDEN_STORE, hidden ? '1' : '0');
    } catch {
      // Sidebar visibility can remain session-local if storage is unavailable.
    }
    if (!hidden) {
      renderDesignSpace();
      renderSidebarDesignAxes();
    }
  };

  try {
    setDesignSidebarHidden(localStorage.getItem(DESIGN_SIDEBAR_HIDDEN_STORE) === '1');
  } catch {
    setDesignSidebarHidden(false);
  }

  document.getElementById('hide-design-space')?.addEventListener('click', () => {
    setDesignSidebarHidden(true);
  });
  showDesignSpaceBtn?.addEventListener('click', () => {
    setDesignSidebarHidden(false);
  });

  document.getElementById('expand-design-space')?.addEventListener('click', () => {
    if (!expandedPanel || !container) return;
    setDesignSidebarHidden(false);
    expandedPanel.hidden = false;
    container.classList.add('design-space-expanded-open');
    renderDesignSpace();
    renderCustomDesignAxes();
  });
  document.getElementById('collapse-design-space')?.addEventListener('click', () => {
    if (!expandedPanel || !container) return;
    expandedPanel.hidden = true;
    container.classList.remove('design-space-expanded-open');
  });

  window.addEventListener('pointermove', (e) => {
    if (!draggingAxisNote) return;
    updateAxisScoreFromPointer(
      draggingAxisNote.axis,
      draggingAxisNote.layout,
      e.clientX,
      draggingAxisNote.track,
      draggingAxisNote.note
    );
  });

  window.addEventListener('pointerup', () => {
    draggingAxisNote = null;
  });

  renderDesignSpace();
  renderCustomDesignAxes();
  renderSidebarDesignAxes();
}

function setupCreatePanel() {
  setupDesignSpaceInstrument();
  renderDesignSpace();
  renderCustomDesignAxes();
  renderSidebarDesignAxes();
  syncCustomAxesToDesignSpace({ syncPrompt: false });
}

function setupAssetAssistant() {
  const openBtn = document.getElementById('asset-assistant-btn');
  const modal = document.getElementById('asset-assistant-modal');
  const form = document.getElementById('asset-assistant-form');
  const promptEl = document.getElementById('asset-assistant-prompt');
  const statusEl = document.getElementById('asset-assistant-status');
  const submitBtn = document.getElementById('asset-assistant-submit');
  const undoBtn = document.getElementById('asset-assistant-undo');
  const closeBtn = document.getElementById('asset-assistant-close');
  const cancelBtn = document.getElementById('asset-assistant-cancel');
  const reviewToast = document.getElementById('asset-review-toast');
  const reviewMessage = document.getElementById('asset-review-message');
  const reviewUndoBtn = document.getElementById('asset-review-undo');
  const reviewApplyBtn = document.getElementById('asset-review-apply');
  if (!modal || !form || !promptEl || !statusEl || !submitBtn) return;
  let undoSnapshot = null;

  const cloneEditState = () => ({
    theme: JSON.parse(JSON.stringify(editedTheme)),
    content: JSON.parse(JSON.stringify(editedContent)),
  });

  const syncUndoButton = () => {
    if (!undoBtn) return;
    undoBtn.hidden = !undoSnapshot;
    undoBtn.disabled = !undoSnapshot || form.classList.contains('is-busy');
  };

  const setStatus = (message, type = '') => {
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.className = `generate-status${type ? ` generate-status--${type}` : ''}`;
  };

  const showReviewToast = (message) => {
    if (!reviewToast) return;
    if (reviewMessage) reviewMessage.textContent = message || 'Previewing page edit.';
    reviewToast.hidden = false;
  };

  const hideReviewToast = () => {
    if (!reviewToast) return;
    reviewToast.hidden = true;
  };

  const close = () => {
    modal.hidden = true;
    submitBtn.disabled = false;
    form.classList.remove('is-busy');
    form.style.position = '';
    form.style.left = '';
    form.style.top = '';
    submitBtn.textContent = 'Apply change';
    setStatus('');
  };

  const open = (anchor) => {
    modal.hidden = false;
    form.classList.remove('is-busy');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Apply change';
    form.style.position = '';
    form.style.left = '';
    form.style.top = '';
    syncUndoButton();
    if (anchor && (anchor.viewport || previewIframe)) {
      const frameRect = anchor.viewport ? { left: 0, top: 0 } : previewIframe.getBoundingClientRect();
      const cardWidth = Math.min(300, window.innerWidth - 32);
      const anchorLeft = anchor.viewport ? Number(anchor.left || 0) : frameRect.left + Number(anchor.left || 0);
      const anchorRight = anchor.viewport ? Number(anchor.right || anchorLeft) : frameRect.left + Number(anchor.right || anchor.left || 0);
      const anchorBottom = anchor.viewport ? Number(anchor.bottom || 0) : frameRect.top + Number(anchor.bottom || 0);
      const left = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, anchorRight - cardWidth));
      const top = Math.max(12, Math.min(window.innerHeight - 180, anchorBottom + 8));
      form.style.position = 'fixed';
      form.style.left = `${Math.round(left)}px`;
      form.style.top = `${Math.round(top)}px`;
    }
    promptEl.focus();
    setStatus('');
  };
  openAssetAssistant = open;

  openBtn?.addEventListener('click', () => {
    const rect = openBtn.getBoundingClientRect();
    open({
      viewport: true,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  });
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  const undoPortfolioPreview = () => {
    if (!undoSnapshot) return;
    editedTheme = undoSnapshot.theme;
    editedContent = undoSnapshot.content;
    undoSnapshot = null;
    syncPaletteVisibility();
    syncPaletteSwatches();
    syncSpacingControlsForCurrentVersion();
    updatePreview();
    refreshInspectModel();
    hideReviewToast();
    setStatus('Restored the previous portfolio version.', 'ok');
    syncUndoButton();
  };

  const applyPortfolioPreview = () => {
    undoSnapshot = null;
    hideReviewToast();
    syncUndoButton();
  };

  undoBtn?.addEventListener('click', undoPortfolioPreview);
  reviewUndoBtn?.addEventListener('click', undoPortfolioPreview);
  reviewApplyBtn?.addEventListener('click', applyPortfolioPreview);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const layout = getLayout(currentVersion);
    const prompt = promptEl.value.trim();
    if (!prompt) {
      setStatus('Tell the sparkle what to change.', 'err');
      return;
    }
    if (!layout) {
      setStatus('Choose a portfolio version first.', 'err');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Thinking...';
    form.classList.add('is-busy');
    syncUndoButton();
    setStatus('Thinking through the whole page...', 'busy');
    try {
      if (!isLocalPortfolioHost() && !participantIdValue()) {
        throw new Error('Begin a participant session before using AI-assisted editing.');
      }
      const beforeChange = cloneEditState();
      const versionKey = layout.key;
      const currentTheme = {
        colors: getVersionColorsForKey(versionKey),
        typography: getVersionTypographyForKey(versionKey),
      };
      const portfolioPayload = {
        layoutKey: layout.key, presentationId: getCurrentPresentationId(), prompt,
        theme: currentTheme, spacing: getVersionSpacingForKey(versionKey),
      };
      const result = isLocalPortfolioHost()
        ? await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/portfolio-operation') || '/api/portfolio-operation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(portfolioPayload),
        })
        : await window.PortfolioSupabase.invoke('ai-assisted-edit', {
          mode: 'portfolio', prompt,
          layout: { key: layout.key, name: layout.name, metaphor: layout.metaphor, prompt: layout.prompt },
          presentation: layout.publicBundle?.presentation || null,
          theme: currentTheme,
          spacing: getVersionSpacingForKey(versionKey),
          contentSummary: { collections: (sourceManifest?.collections || []).map((collection) => ({ name: collection.name, count: (collection.images || []).length })) },
        });

      const operations = validatePortfolioOperations(result.operations || result.operation, {
        versionKey,
        presentationId: getCurrentPresentationId(),
        prompt,
      });

      let appliedCount = 0;
      operations.forEach((operation) => {
        if (operation.type !== 'decorativeAssets' && applyPortfolioOperation(operation)) appliedCount += 1;
      });

      const assetOperations = operations.filter((operation) => operation.type === 'decorativeAssets');
      let generatedAssetCount = 0;
      for (const operation of assetOperations) {
        setStatus('Drawing page decorations...', 'busy');
        const decorations = ensureDecorations(layout.key);
        const data = isLocalPortfolioHost()
          ? await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/assets/generate') || '/api/assets/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layoutKey: layout.key, prompt: operation.prompt }),
          })
          : await window.PortfolioSupabase.invoke('ai-assisted-edit', {
            mode: 'assets', prompt: operation.prompt,
            layout: { key: layout.key, name: layout.name, metaphor: layout.metaphor },
            presentation: layout.publicBundle?.presentation || null,
            existingDecorationCount: decorations.length,
          });
        if (Array.isArray(data?.assets) && data.assets.length) {
          data.assets.forEach((asset) => {
            const src = asset.src || (asset.svg
              ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`
              : '');
            if (!src) return;
            decorations.push({
              src,
              alt: asset.alt || '',
              x: asset.x,
              y: asset.y,
              size: asset.size,
              rotate: asset.rotate,
              opacity: asset.opacity,
            });
          });
          generatedAssetCount += data.assets.length;
        }
      }

      if (appliedCount || generatedAssetCount) {
        undoSnapshot = beforeChange;
        updatePreview();
        refreshInspectModel();
      }
      const parts = [
        appliedCount ? `${appliedCount} page edit${appliedCount === 1 ? '' : 's'}` : '',
        generatedAssetCount ? `${generatedAssetCount} asset${generatedAssetCount === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      const message = parts.length
        ? (result.message || `Applied ${parts.join(' + ')}.`)
        : 'No supported page-level change was found.';
      setStatus(message, parts.length ? 'ok' : 'err');
      if (parts.length) {
        close();
        showReviewToast(message);
      } else {
        hideReviewToast();
      }
      promptEl.value = '';
      syncUndoButton();
    } catch (error) {
      setStatus(error.message, 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Apply change';
      form.classList.remove('is-busy');
      syncUndoButton();
    }
  });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (res.status === 404) {
      throw new Error(
        'This action needs a newer local server. Stop the old one and run:\n\n    node scripts/serve.js\n\nthen reload the editor.'
      );
    }
    throw new Error(text.trim().slice(0, 200) || `Request failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function analyzeImageDesignTokens(payload) {
  if (isLocalPortfolioHost()) {
    return fetchJson('/api/image-design-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  if (!window.PortfolioSupabase?.isConfigured?.()) {
    throw new Error('Image vibe extraction needs Supabase on the public editor.');
  }
  return window.PortfolioSupabase.invoke('image-design-tokens', payload);
}

function setupAI() {
  const generateBtn = document.getElementById('generate-btn');
  const generateStatus = document.getElementById('generate-status');
  const questionsEl = document.getElementById('generate-questions');
  const generatePanel = generateBtn?.closest('.generate-panel');
  const generateTitleLabel = generatePanel?.querySelector('.generate-panel-head .panel-title__label');
  const promptEl = document.getElementById('ai-prompt');
  const imageInput = document.getElementById('image-vibe-input');
  const imagePickBtn = document.getElementById('image-vibe-pick');
  const imageAnalyzeBtn = document.getElementById('image-vibe-analyze');
  const imagePreview = document.getElementById('image-vibe-preview');
  const imageTokensEl = document.getElementById('image-vibe-tokens');
  let selectedImageFile = null;
  let analyzedReferenceImage = null;
  let pendingImageTokenPrompt = '';

  const setGenerateMode = (mode = 'compose') => {
    if (generatePanel) generatePanel.dataset.generateMode = mode;
    if (generateTitleLabel) generateTitleLabel.textContent = mode === 'question' ? 'Design questions' : 'Generate';
  };

  const resetQuestions = () => {
    pendingGeneratePrompt = '';
    pendingGenerateQuestion = null;
    pendingGenerateAnswers = [];
    pendingGenerateReady = false;
    if (questionsEl) {
      questionsEl.hidden = true;
      questionsEl.innerHTML = '';
    }
    setGenerateMode('compose');
    generateBtn.textContent = 'Generate version';
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });

  const imageFileToFastDataUrl = async (file) => {
    if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return fileToDataUrl(file);
    }

    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Could not prepare image for vibe extraction'));
      });
      image.src = sourceUrl;
      await loaded;

      const maxSide = 1024;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
      if (scale >= 1 && file.size < 900_000) return fileToDataUrl(file);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return fileToDataUrl(file);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const updateImagePreview = (file) => {
    selectedImageFile = file || null;
    analyzedReferenceImage = null;
    pendingImageTokenPrompt = '';
    if (imageAnalyzeBtn) imageAnalyzeBtn.disabled = !selectedImageFile;
    if (!imagePreview) return;
    if (!selectedImageFile) {
      imagePreview.hidden = true;
      imagePreview.innerHTML = '';
      return;
    }
    const url = URL.createObjectURL(selectedImageFile);
    imagePreview.hidden = false;
    imagePreview.innerHTML = `
      <img src="${url}" alt="">
      <span>${PortfolioContent.escapeHtml(selectedImageFile.name || 'Reference image')}</span>
    `;
    imagePreview.querySelector('img')?.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  };

  const colorChipHtml = (color) => `
    <span class="image-vibe-chip">
      <i style="background:${PortfolioContent.escapeHtml(color.hex)}"></i>
      ${PortfolioContent.escapeHtml(color.name || color.hex)}
    </span>
  `;

  const renderImageTokens = (tokens, model) => {
    if (!imageTokensEl) return;
    const palette = Array.isArray(tokens.palette) ? tokens.palette.slice(0, 6) : [];
    const detailValue = (value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '').trim());
    const detailRows = [
      ['Keywords', tokens.keywords],
      ['Mood', tokens.mood],
      ['Visual style', tokens.visualStyle],
      ['Materials', tokens.materialSystem],
      ['Background', tokens.layoutContract?.background],
      ['Composition', tokens.layoutContract?.composition || tokens.layout?.composition],
      ['Density', tokens.layoutContract?.density || tokens.layout?.density],
      ['Typography', tokens.typography?.personality],
      ['Motifs to preserve', tokens.requiredMotifs],
      ['Materials to preserve', tokens.requiredMaterials],
      ['Avoid', tokens.forbiddenSimplifications],
      ['Components', tokens.interfaceTranslation?.components || tokens.components],
      ['Navigation', tokens.interfaceTranslation?.navigation],
      ['Motion', tokens.interaction?.motion],
      ['Generator brief', tokens.generationPrompt],
    ]
      .map(([label, value]) => [label, detailValue(value)])
      .filter(([, value]) => value);
    imageTokensEl.hidden = false;
    imageTokensEl.innerHTML = `
      <div class="image-vibe-token-head">
        <strong>${PortfolioContent.escapeHtml(tokens.interfaceTranslation?.metaphor || 'Image vibe')}</strong>
        <span>${PortfolioContent.escapeHtml(model || 'gpt-4.1-mini')}</span>
      </div>
      ${tokens.summary ? `<p>${PortfolioContent.escapeHtml(tokens.summary)}</p>` : ''}
      ${palette.length ? `<div class="image-vibe-palette">${palette.map(colorChipHtml).join('')}</div>` : ''}
      ${detailRows.length ? `
        <details class="image-vibe-details">
          <summary>View full vibe</summary>
          <dl>
            ${detailRows.map(([label, value]) => `
              <div>
                <dt>${PortfolioContent.escapeHtml(label)}</dt>
                <dd>${PortfolioContent.escapeHtml(value)}</dd>
              </div>
            `).join('')}
          </dl>
        </details>
      ` : ''}
    `;
  };

  const tokenLine = (label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '').trim();
    return text ? `${label}: ${text}` : '';
  };

  const promptWithoutHiddenImageContract = (value) => {
    const text = String(value || '').trim();
    const markers = [
      'Image-derived design tokens:',
      'Image-derived design contract:',
      'REFERENCE_FIDELITY: high',
    ]
      .map((marker) => text.indexOf(marker))
      .filter((index) => index >= 0);
    const index = markers.length ? Math.min(...markers) : -1;
    return (index >= 0 ? text.slice(0, index) : text).trim();
  };

  const formatImageTokenPrompt = (tokens) => {
    const palette = Array.isArray(tokens.palette)
      ? tokens.palette.map((color) => `${color.name || color.hex} ${color.hex}${color.role ? ` (${color.role})` : ''}`).join(', ')
      : '';
    return [
      'REFERENCE_FIDELITY: high',
      'Use the uploaded image as a style reference, not a literal scene copy.',
      'Preserve the visual language, palette, texture, material system, composition density, motif vocabulary, and interaction mood. Generalize specific objects/text into reusable portfolio components.',
      'Do not collapse the image into a generic existing metaphor. The generated interface should visibly inherit the reference image in the first viewport.',
      tokenLine('Summary', tokens.summary),
      tokenLine('Keywords', tokens.keywords),
      tokenLine('Visual style', tokens.visualStyle),
      tokenLine('Material system', tokens.materialSystem),
      tokenLine('Layout contract background', tokens.layoutContract?.background),
      tokenLine('Layout contract density', tokens.layoutContract?.density),
      tokenLine('Layout contract composition', tokens.layoutContract?.composition),
      tokenLine('Required motifs', tokens.requiredMotifs),
      tokenLine('Required materials', tokens.requiredMaterials),
      tokenLine('Forbidden simplifications', tokens.forbiddenSimplifications),
      tokenLine('Mood', tokens.mood),
      tokenLine('Palette', palette),
      tokenLine('Typography personality', tokens.typography?.personality),
      tokenLine('Layout composition', tokens.layout?.composition),
      tokenLine('Layout texture', tokens.layout?.texture),
      tokenLine('Must preserve', tokens.layout?.mustPreserve),
      tokenLine('Motif vocabulary', tokens.motifVocabulary),
      tokenLine('Components', tokens.components),
      tokenLine('Interface components', tokens.interfaceTranslation?.components),
      tokenLine('Interface metaphor', tokens.interfaceTranslation?.metaphor),
      tokenLine('Navigation', tokens.interfaceTranslation?.navigation),
      tokenLine('Motion', tokens.interaction?.motion),
      tokenLine('Interaction pace', tokens.interaction?.pace),
      tokens.generationPrompt ? `Generator brief: ${tokens.generationPrompt}` : '',
    ].filter(Boolean).join('\n');
  };

  const promptWithHiddenImageContract = (visiblePrompt) => {
    const base = String(visiblePrompt || '').trim();
    return [base, pendingImageTokenPrompt ? `Image-derived design contract:\n${pendingImageTokenPrompt}` : '']
      .filter(Boolean)
      .join('\n\n');
  };

  const visibleGeneratePrompt = () => promptWithoutHiddenImageContract(promptWithoutDesignScaffold(promptEl.value));

  const composedGeneratePrompt = () => {
    const visible = visibleGeneratePrompt();
    return [
      visible || (activeDesignDirectionPrompt ? 'Generate a portfolio interface.' : ''),
      activeDesignDirectionPrompt,
    ].filter(Boolean).join('\n\n').trim();
  };

  const analyzeSelectedImage = async () => {
    if (!selectedImageFile) return;
    const previousText = imageAnalyzeBtn?.textContent || 'Extract vibe';
    if (imageAnalyzeBtn) {
      imageAnalyzeBtn.disabled = true;
      imageAnalyzeBtn.textContent = 'Extracting...';
    }
    if (generateStatus) {
      generateStatus.hidden = false;
      generateStatus.textContent = 'Reading image vibe with GPT-4.1 mini...';
      generateStatus.className = 'generate-status generate-status--busy';
    }
    try {
      const image = await imageFileToFastDataUrl(selectedImageFile);
      const data = await analyzeImageDesignTokens({
        image,
        mimeType: selectedImageFile.type,
        fileName: selectedImageFile.name,
      });
      analyzedReferenceImage = {
        image,
        mimeType: image.startsWith('data:image/jpeg') ? 'image/jpeg' : (selectedImageFile.type || 'image/png'),
        fileName: selectedImageFile.name || 'reference-image',
      };
      pendingImageTokenPrompt = formatImageTokenPrompt(data.tokens || {});
      const existing = visibleGeneratePrompt();
      promptEl.value = existing || 'Generate from the uploaded reference image.';
      resetQuestions();
      pendingGeneratePrompt = composedGeneratePrompt();
      pendingGenerateReady = true;
      renderImageTokens(data.tokens || {}, data.model);
      if (generateStatus) {
        generateStatus.textContent = 'Image vibe extracted. Click Generate to build from the reference.';
        generateStatus.className = 'generate-status generate-status--ok';
      }
    } catch (e) {
      if (generateStatus) {
        generateStatus.textContent = e.message;
        generateStatus.className = 'generate-status generate-status--err';
      }
      alert(`Could not extract image vibe:\n\n${e.message}`);
    } finally {
      if (imageAnalyzeBtn) {
        imageAnalyzeBtn.disabled = !selectedImageFile;
        imageAnalyzeBtn.textContent = previousText;
      }
    }
  };

  imagePickBtn?.addEventListener('click', () => imageInput?.click());
  imageAnalyzeBtn?.addEventListener('click', analyzeSelectedImage);
  imageInput?.addEventListener('change', () => {
    updateImagePreview(imageInput.files?.[0] || null);
  });
  generatePanel?.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    generatePanel.classList.add('image-vibe-dragover');
  });
  generatePanel?.addEventListener('dragleave', () => {
    generatePanel.classList.remove('image-vibe-dragover');
  });
  generatePanel?.addEventListener('drop', (e) => {
    const file = Array.from(e.dataTransfer?.files || []).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    generatePanel.classList.remove('image-vibe-dragover');
    updateImagePreview(file);
  });

  const formatQuestionCategory = (category) => {
    const labels = {
      metaphor_place_world: 'World',
      visit_encounter: 'Visitor path',
      artist_intent: 'Intent',
    };
    return labels[category] || String(category || 'Design choice').replace(/[_-]+/g, ' ');
  };

  const normalizeGenerateQuestion = (question) => {
    if (!question || typeof question !== 'object') return null;
    const options = Array.isArray(question.options)
      ? question.options.map((option) => {
        if (typeof option === 'string') {
          return { label: option, description: '' };
        }
        return {
          label: String(option?.label || '').trim(),
          description: String(option?.description || '').trim(),
        };
      }).filter((option) => option.label).slice(0, 3)
      : [];
    if (!question.question || options.length === 0) return null;
    return {
      id: String(question.id || `q${pendingGenerateAnswers.length + 1}`),
      category: String(question.category || ''),
      question: String(question.question),
      options,
    };
  };

  const renderQuestion = (question) => {
    if (!questionsEl) return;
    question = normalizeGenerateQuestion(question);
    if (!question) throw new Error('AI did not return a usable design question');
    const answered = pendingGenerateAnswers.map((item) => `
      <div class="generate-answer-summary">
        <strong>${PortfolioContent.escapeHtml(item.question)}</strong>
        <span>${PortfolioContent.escapeHtml(item.answer)}</span>
      </div>
    `).join('');
    questionsEl.innerHTML = `
      ${answered ? `<div class="generate-answer-list">${answered}</div>` : ''}
      <fieldset class="generate-question">
        <div class="generate-question-count">
          <span>${PortfolioContent.escapeHtml(formatQuestionCategory(question.category))}</span>
          <span>Question ${pendingGenerateAnswers.length + 1} of 3</span>
        </div>
        <legend>${PortfolioContent.escapeHtml(question.question)}</legend>
        <div class="generate-question-options">
          ${question.options.map((option, index) => `
            <label class="generate-question-option">
              <input type="radio" name="generate-question-current" value="${index}" ${index === 0 ? 'checked' : ''}>
              <span>
                <strong>${PortfolioContent.escapeHtml(option.label)}</strong>
                <small>${PortfolioContent.escapeHtml(option.description || '')}</small>
              </span>
            </label>
          `).join('')}
        </div>
        <input class="generate-question-other" type="text" placeholder="Or enter your own answer">
      </fieldset>
    `;
    questionsEl.hidden = false;
    setGenerateMode('question');
    generateBtn.textContent = pendingGenerateAnswers.length >= 2 ? 'Use answer and generate' : 'Use answer';
  };

  const currentQuestionAnswer = () => {
    const question = pendingGenerateQuestion;
    if (!question) return null;
    const fieldset = questionsEl?.querySelector('.generate-question');
    const custom = fieldset?.querySelector('.generate-question-other')?.value.trim();
    const selected = fieldset?.querySelector('input[name="generate-question-current"]:checked');
    const option = question.options[Number(selected?.value || 0)] || question.options[0];
    return {
      category: question.category || '',
      question: question.question,
      answer: custom || option.label,
      rationale: custom ? 'custom answer' : option.description,
    };
  };

  const askNextQuestion = async (prompt) => {
    const designSpace = generationDesignSpaceSelection();
    if (!isLocalPortfolioHost() && !participantIdValue()) {
      throw new Error('Begin a participant session before generating a public layout.');
    }
    const payload = {
      mode: 'question',
      prompt: promptWithHiddenImageContract(prompt),
      designSpace,
      answers: pendingGenerateAnswers,
    };
    const data = isLocalPortfolioHost()
      ? await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/generate-questions') || '/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      : await window.PortfolioSupabase.invoke('generate-public-layout', payload);
    if (data.done) return false;
    pendingGenerateQuestion = normalizeGenerateQuestion(data.question);
    if (!pendingGenerateQuestion) throw new Error('AI did not return a usable design question');
    renderQuestion(pendingGenerateQuestion);
    return true;
  };

  const promptWithAnswers = (prompt, answers) => {
    const answerBlock = answers.map((item) => (
      `- ${item.question}\n  Answer: ${item.answer}${item.rationale ? `\n  Rationale: ${item.rationale}` : ''}`
    )).join('\n');
    return `${prompt}\n\nDesign clarification answers:\n${answerBlock}`;
  };

  generateBtn.addEventListener('click', async () => {
    const visiblePrompt = visibleGeneratePrompt();
    if (visiblePrompt !== promptEl.value.trim()) promptEl.value = visiblePrompt;
    const prompt = composedGeneratePrompt();
    if (!prompt) {
      alert('Describe the layout you want first.');
      return;
    }

    if (pendingGeneratePrompt !== prompt) resetQuestions();

    if (!pendingGenerateQuestion && pendingGenerateAnswers.length === 0 && !pendingGenerateReady) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Preparing questions...';
      generateStatus.hidden = false;
      generateStatus.textContent = 'Choosing the first design question...';
      generateStatus.className = 'generate-status generate-status--busy';

      try {
        pendingGeneratePrompt = prompt;
        const hasQuestion = await askNextQuestion(prompt);
        if (!hasQuestion) {
          pendingGenerateReady = true;
          generateStatus.textContent = 'No more questions needed. Click again to generate.';
          generateBtn.textContent = 'Generate with answers';
          return;
        }
        generateStatus.textContent = 'Pick one direction or write your own.';
        generateStatus.className = 'generate-status generate-status--ok';
      } catch (e) {
        resetQuestions();
        generateStatus.textContent = e.message;
        generateStatus.className = 'generate-status generate-status--err';
        alert(`Could not ask design questions:\n\n${e.message}`);
      } finally {
        generateBtn.disabled = false;
      }
      return;
    }

    if (pendingGenerateQuestion) {
      const answer = currentQuestionAnswer();
      if (answer) pendingGenerateAnswers.push(answer);
      pendingGenerateQuestion = null;

      if (pendingGenerateAnswers.length < 3) {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Preparing next question...';
        generateStatus.hidden = false;
        generateStatus.textContent = 'Choosing a follow-up question...';
        generateStatus.className = 'generate-status generate-status--busy';
        try {
          const hasQuestion = await askNextQuestion(prompt);
          if (hasQuestion) {
            generateStatus.textContent = 'Refine the direction before generating.';
            generateStatus.className = 'generate-status generate-status--ok';
            return;
          }
          pendingGenerateReady = true;
        } catch (e) {
          generateStatus.textContent = e.message;
          generateStatus.className = 'generate-status generate-status--err';
          alert(`Could not ask follow-up question:\n\n${e.message}`);
          return;
        } finally {
          generateBtn.disabled = false;
        }
      }
      pendingGenerateReady = true;
      generateStatus.textContent = 'Answers ready. Generating now...';
    }

    const clarifiedPrompt = promptWithAnswers(promptWithHiddenImageContract(prompt), pendingGenerateAnswers);
    if (questionsEl) questionsEl.hidden = true;
    setGenerateMode('compose');

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    generateStatus.hidden = false;
    generateStatus.textContent = 'AI is building your interface…';
    generateStatus.className = 'generate-status generate-status--busy';

    try {
      const designSpace = generationDesignSpaceSelection();
      const referenceImage = /REFERENCE_FIDELITY:\s*high/i.test(clarifiedPrompt) ? analyzedReferenceImage : null;
      const publicGeneration = !isLocalPortfolioHost();
      if (publicGeneration && !participantIdValue()) {
        throw new Error('Begin a participant session before generating a public layout.');
      }
      const data = publicGeneration
        ? await window.PortfolioSupabase.invoke('generate-public-layout', {
          mode: 'generate',
          prompt: clarifiedPrompt,
          designSpace,
          answers: pendingGenerateAnswers,
          hasReferenceImage: Boolean(referenceImage?.image),
          collections: (sourceManifest?.collections || []).map((collection) => ({
            name: collection.name,
            imageCount: (collection.images || []).length,
          })),
          layouts: (window.PORTFOLIO_LAYOUTS || []).map((layout) => ({
            name: layout.name, metaphor: layout.metaphor, designSpace: layout.designSpace || null,
          })),
        })
        : await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/generate') || '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: clarifiedPrompt, designSpace, referenceImage }),
        });

      if (publicGeneration) {
        const publicLayout = createPublicGeneratedLayout(data, clarifiedPrompt, designSpace, referenceImage);
        const versionTheme = publicLayoutTheme(publicLayout);
        window.PORTFOLIO_LAYOUTS.push(publicLayout);
        editedContent.publicLayouts = [...(editedContent.publicLayouts || []), publicLayout];
        editedContent.selectedLayoutKey = publicLayout.key;
        editedTheme.versions = editedTheme.versions || {};
        editedTheme.versions[publicLayout.key] = versionTheme;
        applyLayoutMetadata();
        placeGeneratedLayoutOnAxes(publicLayout, { explicitPoint: Boolean(designSpace) });
        renderDesignSpace();
        selectVersion(publicLayout.id);
        await saveParticipantPortfolioRemotely();
        generateStatus.textContent = `Created and saved “${publicLayout.name}”.`;
        generateStatus.className = 'generate-status generate-status--ok';
        resetQuestions();
        return;
      }

      if (data.layouts) window.PORTFOLIO_LAYOUTS = data.layouts;
      const layout = data.layout;
      placeGeneratedLayoutOnAxes(layout, { explicitPoint: Boolean(designSpace) });
      if (data.versionColors && layout?.key) {
        ensureVersionColorsObject(layout.key);
        editedTheme.versions[layout.key].colors = { ...data.versionColors };
      }
      if (data.versionTypography && layout?.key) {
        Object.entries(data.versionTypography).forEach(([token, values]) => {
          ensureVersionTypographyObject(layout.key, token);
          editedTheme.versions[layout.key].typography[token] = { ...values };
        });
      }
      if (data.versionSpacing && layout?.key) {
        ensureVersionSpacingObject(layout.key);
        editedTheme.versions[layout.key].spacing = { ...data.versionSpacing };
      }
      generateStatus.textContent = `Created "${layout.name}" — switching preview…`;
      generateStatus.className = 'generate-status generate-status--ok';

      applyLayoutMetadata();
      renderDesignSpace();
      selectVersion(layout.id);
      resetQuestions();
    } catch (e) {
      generateStatus.textContent = e.message;
      generateStatus.className = 'generate-status generate-status--err';
      alert(`Generation failed:\n\n${e.message}`);
    } finally {
      generateBtn.disabled = false;
      if (pendingGenerateQuestion) {
        generateBtn.textContent = pendingGenerateAnswers.length >= 2 ? 'Use answer and generate' : 'Use answer';
      } else {
        generateBtn.textContent = 'Generate version';
      }
    }
  });
}

function syncPaletteVisibility() {
  renderPaletteForLayout?.();
}

function setupVersionButtons() {
  /* version buttons rendered via renderVersionButtons() */
}

function setThemeColor(key, value, { rebuild = false } = {}) {
  const versionKey = getCurrentVersionKey();
  ensureVersionColorsObject(versionKey);
  editedTheme.versions[versionKey].colors[key] = value;
  syncPaletteSwatches();
  if (rebuild) updatePreview();
  else patchPreviewColors();
  refreshInspectModel();
}

function patchPreviewColors() {
  if (!previewIframe?.contentWindow) return;
  const colors = getCurrentVersionColors();
  if (colors.background) previewIframe.style.background = colors.background;
  previewIframe.contentWindow.postMessage({
    source: 'portfolio-editor',
    type: 'colors',
    colors,
  }, '*');
}

function syncPaletteSwatches() {
  const colors = getCurrentVersionColors();
  document.querySelectorAll('.palette-swatch').forEach((btn) => {
    const key = btn.dataset.colorKey;
    const fill = btn.querySelector('.palette-swatch-fill');
    const color = colors[key] || DEFAULT_THEME_COLORS[key];
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
    return getCurrentVersionColors()[key] || DEFAULT_THEME_COLORS[key] || '#888888';
  }

  function updateSample(key, hex) {
    const colors = getCurrentVersionColors();
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
  closePalettePopover = closePopover;

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
    const { l } = PaletteColors.hexToHsl(getThemeColor(activeKey));
    applyColor(PaletteColors.hslToHex(+hueInput.value, activeSat, l));
  });
  lightInput.addEventListener('input', () => {
    const { h } = PaletteColors.hexToHsl(getThemeColor(activeKey));
    applyColor(PaletteColors.hslToHex(h, activeSat, +lightInput.value / 100));
  });

  popover.querySelector('.palette-popover-close').addEventListener('click', closePopover);

  function renderSwatches() {
    closePopover();
    strip.replaceChildren();
    PaletteColors.forLayout(getCurrentVersionKey(), {
      colorKeys: getLayout(currentVersion)?.colorKeys,
    }).forEach(({ key, label }) => {
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
    syncPaletteSwatches();
  }
  renderPaletteForLayout = renderSwatches;

  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('.palette-swatch')) {
      closePopover();
    }
  });

  renderSwatches();
}

function setupGridGapListener() {
  document.getElementById('grid-gap').addEventListener('input', (e) => {
    const value = e.target.value;
    setCurrentVersionSpacingValue('gridGap', value + 'px');
    document.getElementById('grid-gap-display').textContent = value + 'px';
    updatePreview();
    refreshInspectModel();
  });
}

function setupArtSizeListener() {
  document.getElementById('art-size').addEventListener('input', (e) => {
    const value = e.target.value;
    setCurrentVersionSpacingValue('artSize', value + 'px');
    document.getElementById('art-size-display').textContent = value + 'px';
    updatePreview();
    refreshInspectModel();
  });
}

function setupMetadataDisplayListener() {
  const select = document.getElementById('metadata-display');
  if (!select) return;
  select.addEventListener('change', () => {
    const value = METADATA_DISPLAY_VALUES.includes(select.value) ? select.value : 'none';
    const overrides = ensureLayoutOverrides(getCurrentVersionKey());
    if (value === 'none') delete overrides.metadataDisplay;
    else overrides.metadataDisplay = value;
    patchPreview({ remount: true });
    refreshInspectModel();
  });
}

function setupSocialPrototypeListener() {
  const select = document.getElementById('social-prototype');
  if (!select) return;
  select.addEventListener('change', () => {
    const value = SOCIAL_PROTOTYPE_VALUES.includes(select.value) ? select.value : 'none';
    const overrides = ensureLayoutOverrides(getCurrentVersionKey());
    if (value === 'none') delete overrides.socialPrototype;
    else overrides.socialPrototype = value;
    patchPreview({ remount: true });
    refreshInspectModel();
  });
}

function getEditedGridGapPx() {
  const slider = document.getElementById('grid-gap');
  if (slider) return parseInt(slider.value, 10) || 24;
  return parseSpacingPx(editedTheme.spacing?.gridGap);
}

function ensureArrangements() {
  if (!editedContent.arrangements) editedContent.arrangements = {};
  return editedContent.arrangements;
}

function currentArrangement() {
  return PortfolioContent.normalizeArrangement(editedContent, getCurrentVersionKey(), sourceManifest);
}

function setCurrentArrangement(arrangement) {
  const arrangements = ensureArrangements();
  arrangements[getCurrentVersionKey()] = PortfolioContent.normalizeArrangement(
    { arrangements: { [getCurrentVersionKey()]: arrangement } },
    getCurrentVersionKey(),
    sourceManifest
  );
}

function moveArrayItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, item);
  return next;
}

function applyArrangementEdit(mutator) {
  const arrangement = currentArrangement();
  mutator(arrangement);
  setCurrentArrangement(arrangement);
  renderCollectionArranger();
  patchPreview({ remount: true });
  refreshInspectModel();
}

function collectionHiddenInCurrentVersion(collectionId) {
  const hiddenIn = editedContent.visibility?.collections?.[collectionId]?.hiddenIn || [];
  return hiddenIn.includes(getCurrentPresentationId());
}

function setCollectionHiddenInCurrentVersion(collectionId, hidden) {
  ensureContentVisibility();
  const presentationId = getCurrentPresentationId();
  if (!editedContent.visibility.collections[collectionId]) {
    editedContent.visibility.collections[collectionId] = { hiddenIn: [] };
  }
  const hiddenIn = editedContent.visibility.collections[collectionId].hiddenIn || [];
  editedContent.visibility.collections[collectionId].hiddenIn = hidden
    ? Array.from(new Set([...hiddenIn, presentationId]))
    : hiddenIn.filter((id) => id !== presentationId);
  renderCollectionArranger();
  patchPreview({ remount: true });
  refreshInspectModel();
}

function workPreviewLabel(work) {
  return work?.title || String(work?.image || '').split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled';
}

function collectionVisibilityIcon(hidden) {
  if (hidden) {
    return `
      <svg class="collection-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.4 5.4A9.4 9.4 0 0 1 12 5c5 0 8.5 4.4 9.5 6.3a1.5 1.5 0 0 1 0 1.4 16.2 16.2 0 0 1-2.2 3" />
        <path d="M6.5 6.9A16.1 16.1 0 0 0 2.5 11.3a1.5 1.5 0 0 0 0 1.4C3.5 14.6 7 19 12 19c1.1 0 2.1-.2 3-.6" />
      </svg>
    `;
  }
  return `
    <svg class="collection-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 11.3a1.5 1.5 0 0 0 0 1.4C3.5 14.6 7 19 12 19s8.5-4.4 9.5-6.3a1.5 1.5 0 0 0 0-1.4C20.5 9.4 17 5 12 5s-8.5 4.4-9.5 6.3Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  `;
}

function clearCollectionWorkDropState() {
  document.querySelectorAll('.collection-work-list.is-drop-target').forEach((el) => {
    el.classList.remove('is-drop-target');
  });
  document.querySelectorAll('.collection-work-chip.is-insert-target').forEach((el) => {
    el.classList.remove('is-insert-target');
  });
}

function collectionDropTargetFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const list = el?.closest?.('.collection-work-list');
  if (!list) return null;
  const collectionIndex = Number(list.dataset.collectionIndex);
  if (!Number.isFinite(collectionIndex)) return null;
  const chip = el.closest?.('.collection-work-chip');
  const beforeId = chip?.dataset.workId || null;
  return { list, collectionIndex, beforeId };
}

function autoScrollCollectionsList(y) {
  const list = document.getElementById('collections-list');
  if (!list) return;
  const rect = list.getBoundingClientRect();
  const edge = 58;
  if (y < rect.top + edge) {
    list.scrollTop -= Math.ceil((rect.top + edge - y) / 6);
  } else if (y > rect.bottom - edge) {
    list.scrollTop += Math.ceil((y - (rect.bottom - edge)) / 6);
  }
}

function updateCollectionWorkDrag(x, y) {
  if (!collectionWorkDrag) return;
  const { ghost, offsetX, offsetY } = collectionWorkDrag;
  ghost.style.transform = `translate(${Math.round(x - offsetX)}px, ${Math.round(y - offsetY)}px)`;
  autoScrollCollectionsList(y);
  clearCollectionWorkDropState();
  const target = collectionDropTargetFromPoint(x, y);
  collectionWorkDrag.target = target;
  if (!target) return;
  target.list.classList.add('is-drop-target');
  if (target.beforeId && target.beforeId !== collectionWorkDrag.workId) {
    target.list.querySelector(`[data-work-id="${CSS.escape(target.beforeId)}"]`)?.classList.add('is-insert-target');
  }
}

function finishCollectionWorkDrag({ commit = true } = {}) {
  if (!collectionWorkDrag) return;
  const drag = collectionWorkDrag;
  collectionWorkDrag = null;
  drag.sourceChip.classList.remove('is-dragging');
  try {
    drag.sourceChip.releasePointerCapture?.(drag.pointerId);
  } catch {
    // Pointer capture may already be gone if the chip was re-rendered.
  }
  drag.ghost.remove();
  document.body.classList.remove('collection-work-dragging');
  clearCollectionWorkDropState();

  const target = drag.target;
  if (!commit || !target) return;
  if (target.beforeId === drag.workId) return;
  const beforeId = target.beforeId === drag.workId ? null : target.beforeId;
  applyArrangementEdit((draft) => {
    draft.collections.forEach((candidate) => {
      candidate.works = (candidate.works || []).filter((wid) => wid !== drag.workId);
    });
    const destination = draft.collections[target.collectionIndex];
    if (!destination) return;
    const beforeIndex = beforeId ? destination.works.indexOf(beforeId) : -1;
    if (beforeIndex >= 0) destination.works.splice(beforeIndex, 0, drag.workId);
    else destination.works.push(drag.workId);
  });
}

function startCollectionWorkDrag(event, chip) {
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const rect = chip.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'collection-work-drag-ghost';
  ghost.style.width = `${Math.round(rect.width)}px`;
  ghost.innerHTML = chip.innerHTML;
  document.body.appendChild(ghost);

  collectionWorkDrag = {
    workId: chip.dataset.workId,
    sourceCollectionIndex: Number(chip.closest('.collection-work-list')?.dataset.collectionIndex),
    sourceChip: chip,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    ghost,
    target: null,
  };
  chip.classList.add('is-dragging');
  chip.setPointerCapture?.(event.pointerId);
  document.body.classList.add('collection-work-dragging');
  updateCollectionWorkDrag(event.clientX, event.clientY);
}

function renderCollectionArranger() {
  const panel = document.getElementById('collections-panel');
  const list = document.getElementById('collections-list');
  if (!panel || !list || panel.hidden || !sourceManifest || !window.PortfolioContent) return;

  const layout = getLayout(currentVersion);
  const subtitle = document.getElementById('collections-panel-subtitle');

  const arrangement = currentArrangement();
  const workLookup = PortfolioContent.manifestWorkIndex(sourceManifest);
  const totalWorks = arrangement.collections.reduce((sum, collection) => sum + (collection.works?.length || 0), 0);
  if (subtitle) subtitle.textContent = `${layout?.name || 'This'} site version · ${arrangement.collections.length} collections · ${totalWorks} works`;
  list.innerHTML = '';

  arrangement.collections.forEach((collection, collectionIndex) => {
    const card = document.createElement('section');
    card.className = 'collection-arrange-card';
    card.draggable = true;
    card.dataset.collectionIndex = String(collectionIndex);
    const hidden = collectionHiddenInCurrentVersion(collection.id);
    card.classList.toggle('is-hidden', hidden);

    card.addEventListener('dragstart', (event) => {
      if (event.target.closest('input,button,.collection-work-chip')) return;
      event.dataTransfer.setData('application/x-collection-index', String(collectionIndex));
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    card.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer.types || []).includes('application/x-collection-index')) return;
      event.preventDefault();
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
    card.addEventListener('drop', (event) => {
      const raw = event.dataTransfer.getData('application/x-collection-index');
      if (raw === '') return;
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const fromIndex = Number(raw);
      applyArrangementEdit((draft) => {
        draft.collections = moveArrayItem(draft.collections, fromIndex, collectionIndex);
      });
    });

    const head = document.createElement('div');
    head.className = 'collection-arrange-head';

    const dragHandle = document.createElement('span');
    dragHandle.className = 'collection-arrange-handle';
    dragHandle.textContent = '::';
    dragHandle.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.className = 'collection-title-input';
    input.value = collection.title;
    input.setAttribute('aria-label', 'Collection title for this site');
    const commitTitle = () => {
      applyArrangementEdit((draft) => {
        if (draft.collections[collectionIndex]) {
          draft.collections[collectionIndex].title = input.value.trim() || 'Untitled collection';
        }
      });
    };
    input.addEventListener('change', commitTitle);
    input.addEventListener('blur', commitTitle);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitTitle();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'collection-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = collection.works.length
      ? 'Move works out before removing this collection'
      : 'Remove collection';
    removeBtn.disabled = collection.works.length > 0;
    removeBtn.addEventListener('click', () => {
      applyArrangementEdit((draft) => {
        draft.collections.splice(collectionIndex, 1);
      });
    });

    const count = document.createElement('span');
    count.className = 'collection-work-count';
    count.textContent = `${collection.works.length}`;
    count.title = `${collection.works.length} work${collection.works.length === 1 ? '' : 's'}`;

    const visibilityBtn = document.createElement('button');
    visibilityBtn.type = 'button';
    visibilityBtn.className = 'collection-visibility-btn';
    visibilityBtn.classList.toggle('is-hidden', hidden);
    visibilityBtn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    visibilityBtn.setAttribute('aria-label', hidden ? 'Show collection in this site' : 'Hide collection in this site');
    visibilityBtn.title = hidden ? 'Show in this site' : 'Hide in this site';
    visibilityBtn.innerHTML = collectionVisibilityIcon(hidden);
    visibilityBtn.addEventListener('click', () => {
      setCollectionHiddenInCurrentVersion(collection.id, !collectionHiddenInCurrentVersion(collection.id));
    });

    head.append(dragHandle, input, count, visibilityBtn, removeBtn);

    const works = document.createElement('div');
    works.className = 'collection-work-list';
    works.dataset.collectionIndex = String(collectionIndex);
    works.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer.types || []).includes('application/x-work-id')) return;
      event.preventDefault();
      works.classList.add('is-drop-target');
    });
    works.addEventListener('dragleave', () => works.classList.remove('is-drop-target'));
    works.addEventListener('drop', (event) => {
      const workId = event.dataTransfer.getData('application/x-work-id');
      if (!workId) return;
      event.preventDefault();
      works.classList.remove('is-drop-target');
      const beforeId = event.target.closest('.collection-work-chip')?.dataset.workId || null;
      applyArrangementEdit((draft) => {
        draft.collections.forEach((candidate) => {
          candidate.works = (candidate.works || []).filter((wid) => wid !== workId);
        });
        const target = draft.collections[collectionIndex];
        if (!target) return;
        const beforeIndex = beforeId ? target.works.indexOf(beforeId) : -1;
        if (beforeIndex >= 0) target.works.splice(beforeIndex, 0, workId);
        else target.works.push(workId);
      });
    });

    collection.works.forEach((workId) => {
      const work = workLookup.get(workId);
      if (!work) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'collection-work-chip';
      chip.draggable = false;
      chip.dataset.workId = workId;
      chip.title = work.image;
      chip.innerHTML = `
        <img src="${PortfolioContent.escapeHtml(work.image)}" alt="">
        <span>${PortfolioContent.escapeHtml(workPreviewLabel(work))}</span>
      `;
      chip.addEventListener('pointerdown', (event) => startCollectionWorkDrag(event, chip));
      chip.addEventListener('pointermove', (event) => {
        if (collectionWorkDrag?.sourceChip === chip) updateCollectionWorkDrag(event.clientX, event.clientY);
      });
      chip.addEventListener('pointerup', () => {
        if (collectionWorkDrag?.sourceChip === chip) finishCollectionWorkDrag({ commit: true });
      });
      chip.addEventListener('pointercancel', () => {
        if (collectionWorkDrag?.sourceChip === chip) finishCollectionWorkDrag({ commit: false });
      });
      works.appendChild(chip);
    });

    if (!collection.works.length) {
      const empty = document.createElement('p');
      empty.className = 'collection-empty';
      empty.textContent = 'Drop artwork here.';
      works.appendChild(empty);
    }

    card.append(head, works);
    list.appendChild(card);
  });
}

function setupCollectionArranger() {
  const panel = document.getElementById('collections-panel');
  const openBtn = document.getElementById('collections-btn');
  const closeBtn = document.getElementById('collections-close');
  const addBtn = document.getElementById('collections-add');
  const resetBtn = document.getElementById('collections-reset');
  if (!panel || !openBtn) return;

  panel.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
  panel.addEventListener('touchmove', (event) => event.stopPropagation(), { passive: true });
  window.addEventListener('pointermove', (event) => {
    if (collectionWorkDrag) updateCollectionWorkDrag(event.clientX, event.clientY);
  }, true);
  window.addEventListener('pointerup', () => finishCollectionWorkDrag({ commit: true }), true);
  window.addEventListener('pointercancel', () => finishCollectionWorkDrag({ commit: false }), true);
  window.addEventListener('mouseup', () => finishCollectionWorkDrag({ commit: true }), true);

  const setOpen = (open) => {
    panel.hidden = !open;
    openBtn.classList.toggle('active', open);
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderCollectionArranger();
  };

  openBtn.addEventListener('click', () => setOpen(panel.hidden));
  closeBtn?.addEventListener('click', () => setOpen(false));
  addBtn?.addEventListener('click', () => {
    applyArrangementEdit((draft) => {
      draft.collections.push({
        id: `custom.${getCurrentVersionKey()}.${Date.now().toString(36)}`,
        title: 'New collection',
        works: [],
      });
    });
  });
  resetBtn?.addEventListener('click', () => {
    const arrangements = ensureArrangements();
    delete arrangements[getCurrentVersionKey()];
    if (Object.keys(arrangements).length === 0) delete editedContent.arrangements;
    renderCollectionArranger();
    patchPreview({ remount: true });
    refreshInspectModel();
  });
}

function participantIdValue() {
  const input = document.getElementById('participant-id');
  const fromInput = window.PortfolioSupabase?.normalizeParticipantId?.(input?.value || '') || '';
  return fromInput || window.PortfolioSupabase?.participantIdFromLocation?.() || '';
}

async function saveParticipantPortfolioRemotely() {
  if (!window.PortfolioSupabase?.isConfigured?.()) throw new Error('Supabase is not configured.');
  const participantId = participantIdValue();
  if (!participantId) throw new Error('Begin a participant session before saving or generating.');
  await window.PortfolioSupabase.savePortfolio(participantId, editedTheme, editedContent);
}

function setSupabaseStatus(message, { error = false, persist = false } = {}) {
  const status = document.getElementById('supabase-status');
  if (!status) return;
  status.hidden = !message;
  status.textContent = message || '';
  status.style.color = error ? '#8c3a32' : '';
  if (message && !persist) {
    window.clearTimeout(setSupabaseStatus._timer);
    setSupabaseStatus._timer = window.setTimeout(() => {
      status.hidden = true;
      status.textContent = '';
      status.style.color = '';
    }, 5000);
  }
}

async function refreshSupabaseSessionUI() {
  const loginBtn = document.getElementById('supabase-login-btn');
  const logoutBtn = document.getElementById('supabase-logout-btn');
  if (!window.PortfolioSupabase?.isConfigured?.()) {
    if (loginBtn) loginBtn.disabled = true;
    if (logoutBtn) logoutBtn.hidden = true;
    setSupabaseStatus('Study sessions are stored locally. Configure Supabase to save sessions remotely.', { persist: true });
    return;
  }

  const user = await window.PortfolioSupabase.user();
  const activeParticipantId = window.PortfolioSupabase.participantIdFromLocation();
  const hasActiveParticipantSession = Boolean(user && activeParticipantId);
  if (loginBtn) loginBtn.hidden = hasActiveParticipantSession;
  if (logoutBtn) logoutBtn.hidden = !hasActiveParticipantSession;
  setSupabaseStatus('');
}

function setupSupabaseControls() {
  const participantInput = document.getElementById('participant-id');
  const loginBtn = document.getElementById('supabase-login-btn');
  const logoutBtn = document.getElementById('supabase-logout-btn');
  const artSource = document.getElementById('art-source');
  if (!participantInput || !window.PortfolioSupabase) return;

  participantInput.value = window.PortfolioSupabase.participantIdFromLocation() || '';
  if (artSource) {
    const participantOption = artSource.querySelector('option[value="participant"]');
    const syncArtSource = () => {
      const hasParticipant = Boolean(window.PortfolioSupabase.participantIdFromLocation());
      if (participantOption) participantOption.disabled = !hasParticipant;
      artSource.value = window.PortfolioSupabase.artSourceFromLocation();
    };
    syncArtSource();
    artSource.addEventListener('change', () => {
      window.PortfolioSupabase.setArtSourceInUrl(artSource.value);
      window.location.reload();
    });
  }
  participantInput.addEventListener('change', () => {
    const participantId = window.PortfolioSupabase.normalizeParticipantId(participantInput.value);
    participantInput.value = participantId;
    setSupabaseStatus(
      participantId
        ? `Participant ${participantId} is ready. Click Begin session to continue.`
        : 'Enter the participant ID assigned by the researcher.',
      { persist: true }
    );
  });

  loginBtn?.addEventListener('click', async () => {
    try {
      const participantId = window.PortfolioSupabase.setParticipantIdInUrl(participantInput.value);
      participantInput.value = participantId;
      if (!participantId) throw new Error('Enter the participant ID assigned by the researcher.');
      await window.PortfolioSupabase.signInAnonymously();
      await refreshSupabaseSessionUI();
      window.PortfolioSupabase.setArtSourceInUrl('participant');
      window.location.reload();
    } catch (err) {
      setSupabaseStatus(err.message, { error: true, persist: true });
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try {
      await window.PortfolioSupabase.signOut();
      window.PortfolioSupabase.setParticipantIdInUrl('');
      window.PortfolioSupabase.setArtSourceInUrl('example');
      window.location.reload();
    } catch (err) {
      setSupabaseStatus(err.message, { error: true, persist: true });
    }
  });

  refreshSupabaseSessionUI();
}

function setupPreview() {
  updatePreview();
  document.getElementById('save-btn').addEventListener('click', saveChanges);
  document.getElementById('preview-btn').addEventListener('click', openLivePreviewWindow);
}

function openLivePreviewWindow() {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    alert('Could not open preview. Please allow popups for this local editor.');
    return;
  }

  previewWindow.document.write('<!DOCTYPE html><title>Loading preview...</title><p style="font-family: system-ui; padding: 2rem;">Loading preview...</p>');
  previewWindow.document.close();

  window.appData.then(({ manifest }) => {
    const baseHref = new URL('./', window.location.href).href;
    const html = buildPreviewHTML(manifest, currentVersion, getPreviewWidth(), {
      baseHref,
      editMode: false,
      enableAssistant: false,
    });
    if (getLayout(currentVersion)?.publicBundle) {
      previewWindow.document.open();
      previewWindow.document.write('<!DOCTYPE html><title>Generated portfolio preview</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block}</style><iframe id="sandbox" sandbox="allow-scripts"></iframe>');
      previewWindow.document.close();
      previewWindow.document.getElementById('sandbox').srcdoc = html;
      return;
    }
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  }).catch((error) => {
    previewWindow.document.open();
    previewWindow.document.write(`<!DOCTYPE html><title>Preview error</title><pre>${PortfolioContent.escapeHtml(error.message)}</pre>`);
    previewWindow.document.close();
  });
}

async function saveChanges() {
  const btn = document.getElementById('save-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  let localSaved = false;
  let remoteSaved = false;
  const errors = [];
  try {
    // Bundle text overrides into the theme POST so one endpoint persists everything
    // (older servers only had /api/theme; /api/content may still be unavailable)
    if (customDesignAxes.length) {
      editedContent.designAxes = sanitizeStoredAxes(customDesignAxes);
    }
    const selectedLayout = getLayout(currentVersion);
    if (selectedLayout?.key) editedContent.selectedLayoutKey = selectedLayout.key;
    const themePayload = { ...editedTheme, content: editedContent };
    if (isLocalPortfolioHost()) try {
      const [themeRes, rebuildRes] = await Promise.all([
        fetch('/api/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(themePayload),
        }),
        fetch(window.PortfolioSupabase?.portfolioApiUrl?.('/api/rebuild') || '/api/rebuild', { method: 'POST' }),
      ]);
      if (!themeRes.ok || !rebuildRes.ok) throw new Error('local server error');
      localSaved = true;
      // Best-effort standalone content write for servers that support it
      fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedContent),
      }).catch(() => {});
      const rebuildData = await rebuildRes.json();
      const { content } = rebuildData;
      if (content) contentModel = content;
      try {
        const data = await fetchJson(window.PortfolioSupabase?.portfolioApiUrl?.('/api/layouts') || '/api/layouts');
        if (data.layouts) window.PORTFOLIO_LAYOUTS = data.layouts;
      } catch {
        // Layouts are already in memory; refresh is just for the save label.
      }
    } catch (err) {
      errors.push(err.message || 'local save failed');
    }

    if (window.PortfolioSupabase?.isConfigured?.()) {
      try {
        const participantId = participantIdValue();
        await window.PortfolioSupabase.savePortfolio(participantId, editedTheme, editedContent);
        const input = document.getElementById('participant-id');
        if (input) input.value = participantId;
        remoteSaved = true;
        setSupabaseStatus(`Participant session ${participantId} saved.`, { persist: true });
      } catch (err) {
        errors.push(err.message || 'Supabase save failed');
        setSupabaseStatus(err.message || 'Supabase save failed', { error: true, persist: true });
      }
    }

    if (!localSaved && !remoteSaved) throw new Error(errors.join('\n') || 'save failed');
    refreshInspectModel();
    const layoutCount = (window.PORTFOLIO_LAYOUTS || []).length;
    const generatedCount = (window.PORTFOLIO_LAYOUTS || []).filter((layout) => layout.generated).length;
    const layoutLabel = generatedCount
      ? `${layoutCount} layouts, ${generatedCount} generated`
      : `${layoutCount} layouts`;
    const savedWhere = [localSaved ? 'local' : '', remoteSaved ? 'Supabase' : ''].filter(Boolean).join(' + ');
    btn.textContent = `Saved ✓ ${savedWhere ? `(${savedWhere})` : `(${layoutLabel})`}`;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
  } catch (e) {
    btn.textContent = original;
    btn.disabled = false;
    alert(`Could not save:\n\n${e.message}\n\nFor local file saves, start the local editor:\n\n    node scripts/serve.js\n\nFor remote study saves, configure Supabase and enter a participant ID.`);
  }
}

function updatePreview() {
  const container = document.getElementById('preview-frame');
  if (previewResizeObserver) {
    previewResizeObserver.disconnect();
    previewResizeObserver = null;
  }
  container.innerHTML = '';
  syncDeviceFrameLayoutClass();
  const previewWidth = getPreviewWidth();
  const viewport = document.createElement('div');
  viewport.className = 'preview-viewport preview-viewport--scaled';
  const iframe = document.createElement('iframe');
  iframe.style.width = `${previewWidth}px`;
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = getCurrentVersionColors().background || DEFAULT_THEME_COLORS.background;
  iframe.style.transformOrigin = 'top left';
  iframe.scrolling = getLayout(currentVersion)?.key === 'directory' ? 'no' : 'auto';
  const selectedLayout = getLayout(currentVersion);
  if (selectedLayout?.publicBundle) iframe.sandbox.add('allow-scripts');
  else iframe.sandbox.add('allow-same-origin', 'allow-scripts');
  viewport.appendChild(iframe);
  container.appendChild(viewport);
  previewIframe = iframe;

  const syncViewportScale = () => {
    const style = getComputedStyle(container);
    const contentWidth = container.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
    const contentHeight = container.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0');
    const scale = Math.min(1, Math.max(0.1, contentWidth / previewWidth));
    viewport.style.width = `${Math.round(previewWidth * scale)}px`;
    viewport.style.height = `${Math.max(1, Math.floor(contentHeight))}px`;
    iframe.style.height = `${Math.max(1, Math.floor(contentHeight / scale))}px`;
    iframe.style.transform = `scale(${scale})`;
  };

  syncViewportScale();
  if ('ResizeObserver' in window) {
    previewResizeObserver = new ResizeObserver(syncViewportScale);
    previewResizeObserver.observe(container);
  }

  window.appData.then(({ manifest }) => {
    const isSandboxedPublicBundle = Boolean(getLayout(currentVersion)?.publicBundle);
    const html = buildPreviewHTML(manifest, currentVersion, previewWidth, isSandboxedPublicBundle
      ? { baseHref: new URL('./', window.location.href).href }
      : {});
    if (isSandboxedPublicBundle) {
      iframe.srcdoc = html;
      return;
    }
    const iframeDoc = iframe.contentDocument;
    iframeDoc.write(html);
    iframeDoc.close();
    const relayoutPreview = () => {
      try {
        iframe.contentWindow?.PortfolioRender?.layoutDirectoryViewport?.();
      } catch (e) {
        // preview not ready
      }
    };
    iframe.onload = relayoutPreview;
    requestAnimationFrame(relayoutPreview);
    window.setTimeout(relayoutPreview, 120);
  });
}

function buildTextHeading(tag, className, id, role, fallback, theme, content, versionKey) {
  const text = PortfolioContent.getText(content, id, fallback, versionKey);
  const style = PortfolioContent.styleToCss(PortfolioContent.getElementStyle(theme, content, id, role, versionKey));
  const cls = className ? ` class="${className}"` : '';
  const modelAttrs = id === 'portfolio.title'
    ? ' data-model-kind="text" data-model-path="content.text.portfolio.title" data-model-label="Portfolio title"'
    : '';
  return `<${tag}${cls} data-text-id="${id}" data-text-role="${role}" data-text-fallback="${PortfolioContent.escapeHtml(fallback)}"${modelAttrs} style="${style}">${PortfolioContent.escapeHtml(text)}</${tag}>`;
}

function buildPreviewNav(activeLayout) {
  return '';
}

function publicLayoutCss(layout) {
  const spec = layout.publicSpec || {};
  const composition = ['grid', 'horizontal', 'stacked', 'masonry'].includes(spec.composition) ? spec.composition : 'grid';
  const columns = Math.max(1, Math.min(5, Number(spec.columns) || 3));
  const gap = Math.max(8, Math.min(56, Number(spec.spacing?.gridGap) || 24));
  const padding = Math.max(0, Math.min(30, Number(spec.spacing?.imagePadding) || 12));
  const radius = { square: '0', rounded: '20px', polaroid: '4px', ticket: '14px 2px 14px 2px' }[spec.cardShape] || '20px';
  const justify = spec.alignment === 'center' ? 'center' : 'start';
  const pattern = {
    dots: 'radial-gradient(var(--color-secondary) 1px, transparent 1px)',
    grid: 'linear-gradient(var(--color-panel) 1px, transparent 1px), linear-gradient(90deg, var(--color-panel) 1px, transparent 1px)',
    stripes: 'repeating-linear-gradient(135deg, transparent 0 18px, color-mix(in srgb, var(--color-panel) 45%, transparent) 18px 20px)',
    glow: 'radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 38%)',
    none: 'none',
  }[spec.backgroundPattern] || 'none';
  const surface = {
    flat: 'none',
    paper: '0 10px 28px color-mix(in srgb, var(--color-primary) 16%, transparent)',
    glass: '0 12px 34px color-mix(in srgb, var(--color-primary) 18%, transparent)',
    fabric: 'inset 0 0 0 2px color-mix(in srgb, var(--color-secondary) 45%, transparent)',
  }[spec.surface] || 'none';
  const hover = {
    lift: 'translateY(-8px)', tilt: 'rotate(-2deg) scale(1.02)', glow: 'scale(1.02)', reveal: 'translateY(-3px)',
  }[spec.hover] || 'translateY(-8px)';
  const worksLayout = composition === 'horizontal'
    ? `display:flex;overflow-x:auto;scroll-snap-type:x mandatory;`
    : composition === 'stacked'
      ? `display:flex;flex-direction:column;align-items:${justify};`
      : composition === 'masonry'
        ? `display:block;columns:${columns};column-gap:${gap}px;`
        : `display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));`;
  return `
    .public-layout { min-height:100vh;padding:${spec.density === 'airy' ? '8vw' : spec.density === 'dense' ? '3vw' : '5vw'};background-image:${pattern};background-size:24px 24px;color:var(--color-primary); }
    .public-layout-section { position:relative;margin:0 auto ${gap * 2}px;max-width:1500px;text-align:${spec.alignment === 'center' ? 'center' : 'left'}; }
    .public-layout-section>h2 { margin:0 0 ${gap}px;font-family:var(--font-heading2-family);font-size:var(--font-heading2); }
    .public-layout-number { display:block;color:var(--color-accent);font:700 .78rem/1 var(--font-body-family);letter-spacing:.18em;margin-bottom:8px; }
    .public-layout-works { ${worksLayout} gap:${gap}px;align-items:start; }
    .public-layout-card { box-sizing:border-box;margin:0 0 ${composition === 'masonry' ? gap : 0}px;padding:${padding}px;border-radius:${radius};background:${spec.surface === 'glass' ? 'color-mix(in srgb, var(--color-paper) 68%, transparent)' : 'var(--color-paper)'};box-shadow:${surface};overflow:hidden;break-inside:avoid;scroll-snap-align:start;transition:transform .24s ease,box-shadow .24s ease,filter .24s ease; }
    .public-layout-card:hover { transform:${hover};${spec.hover === 'glow' ? 'box-shadow:0 0 35px color-mix(in srgb,var(--color-accent) 55%,transparent);' : ''} }
    .public-layout-card img { width:100%;height:${composition === 'masonry' ? 'auto' : 'var(--space-artSize)'};object-fit:${spec.imageFit === 'cover' ? 'cover' : 'contain'} !important;background:var(--color-panel); }
    .public-layout--masonry .public-layout-card { width:100%!important;min-width:0!important;max-width:none!important;display:inline-block; }
    .public-layout--horizontal .public-layout-card { flex:0 0 var(--space-artSize); }
    @media(max-width:720px){.public-layout{padding:24px 16px}.public-layout-works{display:flex;flex-direction:column;columns:auto}.public-layout-card{width:100%!important;max-width:none!important}}
  `;
}

function buildPreviewHTML(manifest, version, previewWidth = 1100, options = {}) {
  const layouts = window.PORTFOLIO_LAYOUTS || [];
  const layout = getLayout(version) || getLayout(1) || layouts[0];
  if (!layout) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="${options.baseHref || new URL('./', window.location.href).href}">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.5 system-ui, sans-serif; color: #1a1816; background: #f8f6f3; }
    .preview-error { max-width: 34rem; padding: 2rem; text-align: center; }
  </style>
</head>
<body>
  <div class="preview-error">No portfolio layouts are available. Check that models/builtin-layouts.json is being served.</div>
</body>
</html>`;
  }
  const presentationId = layout.presentationId || layout.key;
  const previewColors = getVersionColorsForKey(layout.key);
  const previewTypography = getVersionTypographyForKey(layout.key);
  const previewSpacing = getVersionSpacingForKey(layout.key);
  const titleHeading = buildTextHeading('h1', '', 'portfolio.title', 'portfolio.title', 'My Art Portfolio', editedTheme, editedContent, layout.key);
  const editState = JSON.stringify({ theme: editedTheme, content: editedContent, versionKey: layout.key }).replace(/</g, '\\u003c');
  const previewManifest = JSON.stringify(manifest).replace(/</g, '\\u003c');
  const layoutViewClass = `view-${layout.key}`;
  const directoryViewClass = layout.key === 'directory' ? ' view-directory' : '';
  const previewViewClass = `${layoutViewClass}${directoryViewClass}`;
  const editMode = options.editMode !== false;
  const enableAssistant = editMode && options.enableAssistant !== false;
  const editScripts = editMode
    ? `
  <script src="./scripts/text-edit.js"><\/script>
  ${enableAssistant ? '<script src="./scripts/cursor-assistant.js?v=glasses-no-eyes-20260719"><\\/script>' : ''}
  <script>
    requestAnimationFrame(() => {
      if (document.body.dataset.editMode && !document.querySelector('.text-edit-toolbar')) {
        const textScript = document.createElement('script');
        textScript.src = './scripts/text-edit.js';
        document.body.appendChild(textScript);
      }
      if (document.body.dataset.editMode && !document.querySelector('.cursor-assistant')) {
        const assistantScript = document.createElement('script');
        assistantScript.src = './scripts/cursor-assistant.js?v=glasses-no-eyes-20260719';
        document.body.appendChild(assistantScript);
      }
    });
  <\/script>`
    : '';
  const textEditStyles = editMode
    ? `
    [data-text-id] { cursor: text; }
    [data-text-id]:hover { outline: 2px dashed var(--color-accent); outline-offset: 3px; }
    [data-text-id]:empty::after { content: 'Click to add text'; opacity: 0.4; font-weight: 400; pointer-events: none; }
    .portfolio-title-row {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }
    .portfolio-title-row h1 {
      margin: 0;
    }
    .text-edit-selected { outline: 2px solid var(--color-primary) !important; outline-offset: 3px; }
    .text-edit-toolbar {
      --text-edit-ink: #24221f;
      --text-edit-muted: #6f6862;
      --text-edit-paper: #fafaf9;
      --text-edit-panel: #f5f5f4;
      --text-edit-line: #d5d8d4;
      --text-edit-accent: #6a7368;
      --text-edit-hover: #eef0ee;
      position: absolute;
      z-index: 2000;
      background: var(--text-edit-paper) !important;
      border: 1px solid var(--text-edit-line);
      border-radius: 10px;
      padding: 0.65rem 0.75rem;
      min-width: 220px;
      font-family: 'Velvelyne', 'Segoe UI', system-ui, sans-serif;
      font-size: 0.82rem;
      line-height: 1.3;
      color: var(--text-edit-ink) !important;
      box-shadow: 0 1px 2px rgba(106, 115, 104, 0.06), 0 10px 28px rgba(58, 52, 48, 0.06);
    }
    .text-edit-toolbar,
    .text-edit-toolbar * {
      color: var(--text-edit-ink) !important;
      text-shadow: none !important;
    }
    .text-edit-props { display: flex; gap: 0.35rem; margin-bottom: 0.5rem; }
    .text-edit-props button {
      flex: 1;
      padding: 0.3rem 0.5rem;
      border: 1px solid var(--text-edit-line);
      background: var(--text-edit-panel) !important;
      border-radius: 4px;
      cursor: pointer;
      font: inherit;
      font-weight: 650;
      font-size: 0.75rem;
    }
    .text-edit-props button:hover { background: var(--text-edit-hover) !important; }
    .text-edit-props button.active { border-color: var(--text-edit-accent); background: var(--text-edit-accent) !important; color: var(--text-edit-paper) !important; }
    .text-edit-props button.active * { color: var(--text-edit-paper) !important; }
    .text-edit-panel label { display: block; font-weight: 600; margin-bottom: 0.25rem; }
    .text-edit-hint { font-size: 0.72rem; color: var(--text-edit-muted) !important; margin-bottom: 0.35rem; }
    .text-edit-input, .text-edit-font {
      width: 100%;
      padding: 0.35rem 0.5rem;
      border: 1px solid var(--text-edit-line);
      border-radius: 4px;
      font: inherit;
      font-size: 0.85rem;
      background: var(--text-edit-paper) !important;
      color: var(--text-edit-ink) !important;
      -webkit-text-fill-color: var(--text-edit-ink) !important;
      caret-color: var(--text-edit-ink);
      box-sizing: border-box;
    }
    .text-edit-size { width: 100%; }
    .text-edit-size { accent-color: var(--text-edit-accent); }
    .text-edit-scope { border: none; margin-top: 0.5rem; padding: 0; }
    .text-edit-scope legend { font-weight: 600; font-size: 0.75rem; margin-bottom: 0.25rem; }
    .text-edit-scope label { display: block; font-size: 0.75rem; margin: 0.15rem 0; cursor: pointer; }
    .text-edit-scope input { accent-color: var(--text-edit-accent); }
    `
    : '';
  const directoryInlineStyles = layout.key === 'directory'
    ? `
    html.view-directory, body.view-directory {
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }
    body[data-edit-mode="1"].view-directory header {
      padding: 4rem 2rem 0.8rem;
    }
    body[data-edit-mode="1"].view-directory h1 {
      margin-bottom: 0;
      font-size: clamp(1.85rem, 4.5vw, var(--font-heading1, 2.75rem));
    }
    .view-directory #preview-content,
    .view-directory #content {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .directory-browser {
      flex: 1;
      min-height: 0;
      max-height: 100%;
      grid-template-rows: minmax(0, 1fr);
    }
    .directory-tree { overflow-y: auto; overflow-x: hidden; }
    .directory-viewer { overflow: hidden; }
    .directory-preview { min-height: 0; overflow: hidden; }
    .directory-preview img { max-height: 100%; object-fit: contain; }
    `
    : '';
  const generatedInlineStyles = layout.generated
    ? `
    body.${layoutViewClass} {
      min-height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
    }
    body.${layoutViewClass} header {
      position: relative;
      z-index: 1000;
      isolation: isolate;
    }
    body.${layoutViewClass} main.container {
      max-width: none;
      width: 100%;
      min-height: 100vh;
      padding: 0;
      position: relative;
    }
    body.${layoutViewClass} #preview-content {
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }
    `
    : '';

  const deskScripts = layout.key === 'desk'
    ? `<script src="./scripts/layouts.js"><\/script><script src="./scripts/desk-drag.js"><\/script>`
    : '';

  const publicBundleCss = String(layout.publicBundle?.css || '').replace(/<\/style/gi, '<\\/style');
  const generatedHead = layout.publicBundle
    ? `<style>${publicBundleCss}</style>`
    : layout.publicGenerated
    ? `<style>${publicLayoutCss(layout)}</style>`
    : layout.generated
    ? `<link rel="stylesheet" href="./generated/${layout.key}/style.css">`
    : '';

  const publicLayoutJson = JSON.stringify(layout).replace(/</g, '\\u003c');
  const publicRenderScript = String(layout.publicBundle?.renderScript || '').replace(/<\/script/gi, '<\\/script');
  const generatedScripts = layout.publicBundle
    ? `<script>window.__PUBLIC_LAYOUT__=${publicLayoutJson}; window.__PUBLIC_BUNDLE__=window.__PUBLIC_LAYOUT__.publicBundle;<\/script>
  <script src="./scripts/generated-runtime.js?v=public-artwork-fallback-20260723"><\/script>
  <script src="./scripts/decorations-runtime.js"><\/script>
  <script>${publicRenderScript}<\/script>`
    : layout.publicGenerated
    ? `<script>window.__PUBLIC_LAYOUT__=${publicLayoutJson};<\/script>
  <script src="./scripts/generated-runtime.js?v=public-artwork-fallback-20260723"><\/script>
  <script src="./scripts/decorations-runtime.js"><\/script>
  <script src="./scripts/public-layout-runtime.js?v=public-generation-20260722"><\/script>`
    : layout.generated
    ? `<script src="./scripts/generated-runtime.js"><\/script>
  <script src="./scripts/decorations-runtime.js"><\/script>
  <script src="./generated/${layout.key}/render.js"><\/script>`
    : `<script src="./scripts/component-registry.js"><\/script>
  <script src="./scripts/model-loader.js?v=public-full-generation-20260722"><\/script>
  ${deskScripts}
  <script src="./scripts/decorations-runtime.js"><\/script>
  <script src="./scripts/render.js"><\/script>`;

  const mountScript = layout.generated
    ? `(async () => {
    const contentModel = PortfolioModels.manifestToContentStub(window.__PREVIEW_MANIFEST__);
    const models = await PortfolioModels.load(window.__PREVIEW_PRESENTATION_ID__, {
      theme: window.__EDIT_STATE__.theme,
      contentOverrides: window.__EDIT_STATE__.content,
      contentModel,
      ${layout.publicGenerated ? 'presentation: window.__PUBLIC_LAYOUT__.publicBundle?.presentation || window.__PUBLIC_LAYOUT__.publicSpec,' : ''}
      ${layout.publicBundle ? 'schema: null,' : ''}
    });
    const previewRoot = document.getElementById('preview-content');
    await GeneratedRuntime.mount({
      root: previewRoot,
      layoutKey: window.__PREVIEW_PRESENTATION_ID__,
      models,
      previewState: {
        theme: window.__EDIT_STATE__.theme,
        content: window.__EDIT_STATE__.content,
        versionKey: window.__EDIT_STATE__.versionKey,
      },
    });
  })();`
    : `(async () => {
    const contentModel = PortfolioModels.manifestToContentStub(window.__PREVIEW_MANIFEST__);
    const models = await PortfolioModels.load(window.__PREVIEW_PRESENTATION_ID__, {
      theme: window.__EDIT_STATE__.theme,
      contentOverrides: window.__EDIT_STATE__.content,
      contentModel,
      ${layout.publicGenerated ? 'presentation: window.__PUBLIC_LAYOUT__.publicBundle?.presentation || window.__PUBLIC_LAYOUT__.publicSpec,' : ''}
      ${layout.publicBundle ? 'schema: null,' : ''}
    });
    const previewRoot = document.getElementById('preview-content');
    PortfolioRender.renderCollections(
      previewRoot,
      models.manifest.collections.map((col, index) => ({
        id: col.id || PortfolioContent.collectionId(col.originalIndex ?? index),
        originalIndex: col.originalIndex ?? index,
        ...col,
      })),
      models
    );
    if (window.__PREVIEW_PRESENTATION_ID__ === 'directory') {
      PortfolioRender.layoutDirectoryViewport();
    }
  })();`;

  const remountScript = layout.generated
    ? `window.__PORTFOLIO_REMOUNT_PREVIEW__ = async function() {
    const contentModel = PortfolioModels.manifestToContentStub(window.__PREVIEW_MANIFEST__);
    const models = await PortfolioModels.load(window.__PREVIEW_PRESENTATION_ID__, {
      theme: window.__EDIT_STATE__.theme,
      contentOverrides: window.__EDIT_STATE__.content,
      contentModel,
    });
    const previewRoot = document.getElementById('preview-content');
    await GeneratedRuntime.mount({
      root: previewRoot,
      layoutKey: window.__PREVIEW_PRESENTATION_ID__,
      models,
      previewState: {
        theme: window.__EDIT_STATE__.theme,
        content: window.__EDIT_STATE__.content,
        versionKey: window.__EDIT_STATE__.versionKey,
      },
    });
  };`
    : `window.__PORTFOLIO_REMOUNT_PREVIEW__ = async function() {
    const contentModel = PortfolioModels.manifestToContentStub(window.__PREVIEW_MANIFEST__);
    const models = await PortfolioModels.load(window.__PREVIEW_PRESENTATION_ID__, {
      theme: window.__EDIT_STATE__.theme,
      contentOverrides: window.__EDIT_STATE__.content,
      contentModel,
    });
    const previewRoot = document.getElementById('preview-content');
    PortfolioRender.renderCollections(
      previewRoot,
      models.manifest.collections.map((col, index) => ({
        id: col.id || PortfolioContent.collectionId(col.originalIndex ?? index),
        originalIndex: col.originalIndex ?? index,
        ...col,
      })),
      models
    );
    if (window.__PREVIEW_PRESENTATION_ID__ === 'directory') {
      PortfolioRender.layoutDirectoryViewport();
    }
  };`;

  const sandboxOrigin = options.baseHref ? new URL(options.baseHref).origin : window.location.origin;
  const publicBundleCsp = layout.publicBundle
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${sandboxOrigin}; style-src 'unsafe-inline' ${sandboxOrigin} https://fonts.googleapis.com; font-src ${sandboxOrigin} https://fonts.gstatic.com; img-src ${sandboxOrigin} data: blob:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri ${sandboxOrigin}">`
    : '';

  return `<!DOCTYPE html>
<html class="${previewViewClass.trim()}">
<head>
  <meta charset="UTF-8">
  ${publicBundleCsp}
  ${options.baseHref ? `<base href="${PortfolioContent.escapeHtml(options.baseHref)}">` : ''}
  <link rel="stylesheet" href="./styles.css">
  ${generatedHead}
  <style>
    :root {
      --color-primary: ${previewColors.primary};
      --color-accent: ${previewColors.accent};
      --color-background: ${previewColors.background};
      --color-secondary: ${previewColors.secondary || '#ece6da'};
      --color-paper: ${previewColors.paper || DEFAULT_THEME_COLORS.paper};
      --color-panel: ${previewColors.panel || DEFAULT_THEME_COLORS.panel};
      --font-heading1: ${previewTypography.heading1.fontSize};
      --font-heading1-family: ${previewTypography.heading1.fontFamily};
      --font-heading1-weight: ${previewTypography.heading1.fontWeight};
      --font-heading2: ${previewTypography.heading2.fontSize};
      --font-heading2-family: ${previewTypography.heading2.fontFamily};
      --font-heading2-weight: ${previewTypography.heading2.fontWeight};
      --font-body: ${previewTypography.body.fontSize};
      --font-body-family: ${previewTypography.body.fontFamily};
      --font-body-weight: ${previewTypography.body.fontWeight};
      --space-gridGap: ${previewSpacing.gridGap};
      --space-artSize: ${previewSpacing.artSize || '190px'};
      --space-imagePadding: ${previewSpacing.imagePadding || '0.75rem'};
    }
    html {
      min-height: 100%;
      background: var(--color-background);
      overscroll-behavior: none;
    }
    body {
      background: var(--color-background);
      overscroll-behavior: none;
    }
    ${directoryInlineStyles}
    ${generatedInlineStyles}
    h1[data-text-id], h2[data-text-id] { min-height: 1em; display: block; }
    .generated-artwork-image,
    [data-generated-artwork-image="true"] {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain !important;
      object-position: center center !important;
    }
    .scroll-item:has(> .generated-artwork-image):not([data-fixed-size="true"]),
    .scroll-item:has(> [data-generated-artwork-image="true"]):not([data-fixed-size="true"]),
    .generated-work-tile:not([data-fixed-size="true"]) {
      width: var(--space-artSize);
      min-width: var(--space-artSize);
      max-width: var(--space-artSize);
    }
    body.color-focus-background { outline: 4px solid var(--color-accent); outline-offset: -4px; }
    body.color-focus-primary header,
    body.color-focus-primary h1,
    body.color-focus-primary h2 { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    body.color-focus-accent [data-text-id] { outline: 2px dashed var(--color-accent); outline-offset: 3px; }
    body.color-focus-secondary .desk-surface { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    body.color-focus-paper .desk-item,
    body.color-focus-paper .grid-item,
    body.color-focus-paper .scroll-item,
    body.color-focus-paper .generated-work-tile { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    body.color-focus-panel .clothesline-scroll,
    body.color-focus-panel .images-scroll,
    body.color-focus-panel .directory-tree,
    body.color-focus-panel .directory-viewer { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    ${textEditStyles}
  </style>
</head>
<body${editMode ? ' data-edit-mode="1"' : ''} class="${previewViewClass.trim()}">
  <header>
    <div class="portfolio-title-row">
      ${titleHeading}
    </div>
    ${buildPreviewNav(layout)}
  </header>
  <main class="container" data-model-kind="presentation" data-model-path="presentations.${presentationId}" data-presentation-id="${presentationId}" data-model-label="${PortfolioContent.escapeHtml(layout.name)} presentation">
    <div id="preview-content"></div>
  </main>
  <script>window.__EDIT_STATE__ = ${editState};<\/script>
  <script>window.__PREVIEW_MANIFEST__ = ${previewManifest}; window.__PREVIEW_PRESENTATION_ID__ = "${presentationId}"; window.__PREVIEW_WIDTH__ = ${previewWidth};<\/script>
  <script src="./scripts/content.js"><\/script>
  <script src="./scripts/model-loader.js?v=public-full-generation-20260722"><\/script>
  ${generatedScripts}
  <script>
  ${mountScript}
  ${remountScript}

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'portfolio-editor') return;
    if (e.data.type === 'patch') {
      if (e.data.theme) window.__EDIT_STATE__.theme = e.data.theme;
      if (e.data.content) window.__EDIT_STATE__.content = e.data.content;
      if (e.data.versionKey) window.__EDIT_STATE__.versionKey = e.data.versionKey;
      if (e.data.remount) {
        window.__PORTFOLIO_REMOUNT_PREVIEW__?.();
      } else if (window.PortfolioContent) {
        PortfolioContent.applyPageText(
          window.__PREVIEW_MANIFEST__,
          window.__EDIT_STATE__.theme,
          window.__EDIT_STATE__.content,
          window.__EDIT_STATE__.versionKey
        );
      }
    }
    if (e.data.type === 'colors' && e.data.colors) {
      Object.entries(e.data.colors).forEach(([k, v]) => {
        document.documentElement.style.setProperty('--color-' + k, v);
      });
    }
    if (e.data.type === 'color-focus') {
      document.body.classList.remove('color-focus-background', 'color-focus-primary', 'color-focus-accent', 'color-focus-secondary', 'color-focus-paper', 'color-focus-panel');
      if (e.data.key) document.body.classList.add('color-focus-' + e.data.key);
    }
  });
  document.querySelectorAll('[data-preview-nav]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const key = link.dataset.previewLayoutKey;
      if (!key) {
        if (window.parent !== window) e.preventDefault();
        return;
      }
      e.preventDefault();
      if (window.parent !== window) {
        window.parent.postMessage({ source: 'portfolio-preview-nav', key }, '*');
        return;
      }

      const editor = window.opener;
      const layout = editor?.PORTFOLIO_LAYOUTS?.find((item) => item.key === key || item.presentationId === key);
      if (!editor || editor.closed || !layout || typeof editor.buildPreviewHTML !== 'function' || !editor.appData) {
        window.location.href = link.href;
        return;
      }

      editor.appData.then(({ manifest }) => {
        if (typeof editor.selectVersion === 'function') editor.selectVersion(layout.id);
        const baseHref = new URL('./', editor.location.href).href;
        const html = editor.buildPreviewHTML(manifest, layout.id, window.__PREVIEW_WIDTH__ || 1100, {
          baseHref,
          editMode: false,
          enableAssistant: false,
        });
        document.open();
        document.write(html);
        document.close();
      }).catch(() => {
        window.location.href = link.href;
      });
    });
  });
  <\/script>
  ${editScripts}
</body>
</html>`;
}

document.addEventListener('DOMContentLoaded', () => {
  initEditMode().catch((error) => {
    console.error('[editor] initialization failed:', error);
    const loading = document.getElementById('editor-loading');
    const title = document.getElementById('editor-loading-title');
    const detail = document.getElementById('editor-loading-detail');
    loading?.classList.add('has-error');
    if (title) title.textContent = 'Could not load this participant session';
    if (detail) detail.textContent = 'Check the local server and refresh the page.';
  });
});
