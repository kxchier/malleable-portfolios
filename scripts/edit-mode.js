/* Edit Mode JavaScript */
let currentVersion = 1;
let editedTheme = {};
let editedContent = { text: {} };
let contentModel = null;
let inspectController = null;
let previewIframe = null;
let closePalettePopover = null;
let renderPaletteForLayout = null;
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
let selectedDesignSpace = { ...DESIGN_SPACE_DEFAULT };
let customDesignAxes = [];
let draggingAxisNote = null;
let pendingGeneratePrompt = '';
let pendingGenerateQuestion = null;
let pendingGenerateAnswers = [];
let pendingGenerateReady = false;

async function initEditMode() {
  if (window.loadPortfolioLayouts) await window.loadPortfolioLayouts();

  const { manifest, theme, content, contentModel: loadedContent } = await window.appData;
  contentModel = loadedContent;
  editedTheme = JSON.parse(JSON.stringify(theme));
  editedContent = JSON.parse(JSON.stringify(content));

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

  applyLayoutMetadata();
  renderVersionButtons();
  setupGridGapListener();
  setupArtSizeListener();
  setupPaletteDrag();
  setupPreview();
  setupTextEditBridge();
  setupAI();
  setupDeleteLayout();
  setupPublish();
  setupCreatePanel();
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

function getCurrentVersionColors() {
  return getVersionColorsForKey(getCurrentVersionKey());
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
    if (!e.data) return;
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
    applyCursorOperation(msg.operation);
  }
}

function proposalFor(operation, message) {
  return { operation, message };
}

function normalizeCursorScope(scope) {
  return ['this', 'role', 'all-headings', 'all-images'].includes(scope) ? scope : 'this';
}

async function proposeCursorOperation({ target, prompt, scope, presentationId }) {
  scope = normalizeCursorScope(scope);
  const versionKey = getCurrentVersionKey();
  const currentPresentation = presentationId || getCurrentPresentationId();

  return parseOperationWithAI({ target, prompt, scope, presentationId: currentPresentation, versionKey });
}

async function parseOperationWithAI({ target, prompt, scope, presentationId, versionKey }) {
  const result = await fetchJson('/api/operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target,
      prompt,
      scope,
      presentationId,
    }),
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
  height: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|auto|var\(--space-artSize\)|calc\(var\(--space-artSize\) \+ \d{1,3}px\))$/,
  maxHeight: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|none|100%)$/,
  maxWidth: /^(\d{1,4}(\.\d+)?(px|rem|em|%)|none|100%)$/,
  objectFit: /^(contain|cover|fill|none|scale-down)$/,
  objectPosition: /^(center|top|bottom|left|right|center center|top center|bottom center|left center|right center)$/,
  opacity: /^(0(\.\d{1,2})?|1(\.0{1,2})?)$/,
  outline: /^(none|\d{1,2}px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8}|currentColor|var\(--color-[a-z-]+\)))$/,
  overflow: /^(hidden|visible|clip|auto)$/,
  padding: /^(\d{1,3}(\.\d+)?(px|rem|em|%)|var\(--space-imagePadding\))$/,
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
      const patch = sanitizeElementStylePatch(operation.patch);
      const imagePatch = sanitizeElementStylePatch(operation.imagePatch);
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
    const patch = sanitizeElementStylePatch(operation.patch);
    const imagePatch = sanitizeElementStylePatch(operation.imagePatch);
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

function messageForOperation(operation) {
  if (operation.type === 'stylePatch') {
    return `Apply ${Object.keys(operation.patch).join(', ')} to ${operation.target?.label || 'this text'} in this presentation.`;
  }
  if (operation.type === 'elementStylePatch') {
    const props = [...Object.keys(operation.patch || {}), ...Object.keys(operation.imagePatch || {})];
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
    updatePreview();
    refreshInspectModel();
    return;
  }

  if (operation.type === 'elementStylePatch') {
    ensureElementStyles();
    const bucket = (editedContent.elementStyles.versions[operation.versionKey] ||= {});
    const styleId = operation.scope === 'all-images' ? '__all_work__' : operation.styleId;
    const current = bucket[styleId] || {};
    bucket[styleId] = {
      patch: { ...(current.patch || {}), ...(operation.patch || {}) },
      imagePatch: { ...(current.imagePatch || {}), ...(operation.imagePatch || {}) },
    };
    updatePreview();
    refreshInspectModel();
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
    updatePreview();
    refreshInspectModel();
    return;
  }

  if (operation.type === 'noop') {
    return;
  }

  if (operation.type === 'needsGeneration') {
    return;
  }
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

function selectVersion(versionId) {
  currentVersion = versionId;
  document.querySelectorAll('.version-btn:not(.create-btn)').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.version, 10) === versionId);
  });
  syncSpacingControlsForCurrentVersion();
  renderDesignSpace();
  renderCustomDesignAxes();
  syncPaletteVisibility();
  syncPaletteSwatches();
  syncDeleteLayoutButton();
  updatePreview();
  refreshInspectModel();
}

function syncDeleteLayoutButton() {
  const btn = document.getElementById('delete-layout-btn');
  if (!btn) return;
  const layout = getLayout(currentVersion);
  btn.hidden = !layout?.generated;
  btn.title = layout?.generated ? `Delete “${layout.name}” and remove its files` : '';
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
    btn.textContent = layout.generated ? `${layout.name} ✦` : layout.name;
    btn.title = layout.examplePrompt || layout.prompt || layout.name;
    btn.addEventListener('click', () => selectVersion(layout.id));
    container.insertBefore(btn, createBtn || null);
  });
  syncDeleteLayoutButton();
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
      const data = await fetchJson('/api/layouts/delete', {
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
  return `${axis.leftLabel || 'left'} to ${axis.rightLabel || 'right'}`;
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
  const left = String(axis?.leftLabel || '');
  const right = String(axis?.rightLabel || '');
  if (!left || !right) return [];
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
    const normalized = {
      id: String(axis.id || `axis_${Date.now()}`).slice(0, 80),
      leftLabel: String(axis.leftLabel || '').slice(0, 48),
      rightLabel: String(axis.rightLabel || '').slice(0, 48),
      name: String(axis.name || axisName(axis)).slice(0, 80),
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

function loadDesignAxes() {
  try {
    const stored = sanitizeStoredAxes(JSON.parse(localStorage.getItem(DESIGN_AXES_STORE) || '[]'));
    return stored.length ? stored : createDefaultDesignAxes();
  } catch {
    return createDefaultDesignAxes();
  }
}

function saveDesignAxes() {
  try {
    localStorage.setItem(DESIGN_AXES_STORE, JSON.stringify(sanitizeStoredAxes(customDesignAxes)));
  } catch {
    // Ignore storage failures; the in-memory prototype still works.
  }
}

function mappedAxis(role) {
  return customDesignAxes.find((axis) => axis.mapRole === role) || null;
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
  const xLabel = xAxis ? `${xAxis.leftLabel} to ${xAxis.rightLabel}` : 'x axis';
  const yLabel = yAxis ? `${yAxis.leftLabel} to ${yAxis.rightLabel}` : 'y axis';
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
  const axes = customDesignAxes
    .filter((axis) => axis.leftLabel && axis.rightLabel)
    .map((axis) => {
      const value = clamp01(axis.value ?? 0.5);
      const currentTerm = axisTermForValue(axis, value);
      const concept = currentTerm ? currentTerm.label : axisTermText(axis, value);
      return `- ${axis.name || axisName(axis)}: ${concept}`;
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
  textarea.value = [base || 'Generate a portfolio interface.', buildDesignPromptScaffold(selectedDesignSpace)]
    .filter(Boolean)
    .join('\n\n');
}

function setDesignSpaceSelection(point, { syncPrompt = true } = {}) {
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
    customAxes: customDesignAxes.map((axis) => ({
      id: axis.id,
      name: axis.name,
      leftLabel: axis.leftLabel,
      rightLabel: axis.rightLabel,
      value: clamp01(axis.value ?? 0.5),
      scores: axis.scores || [],
      terms: axis.terms || [],
      mapRole: axis.mapRole || '',
    })),
    xAxis: xAxis ? { id: xAxis.id, name: xAxis.name || axisName(xAxis), leftLabel: xAxis.leftLabel, rightLabel: xAxis.rightLabel, terms: xAxis.terms || [] } : null,
    yAxis: yAxis ? { id: yAxis.id, name: yAxis.name || axisName(yAxis), leftLabel: yAxis.leftLabel, rightLabel: yAxis.rightLabel, terms: yAxis.terms || [] } : null,
  };

  document.querySelectorAll('.design-space-selection').forEach((selection) => {
    selection.style.left = `${selectedDesignSpace.x * 100}%`;
    selection.style.top = `${(1 - selectedDesignSpace.y) * 100}%`;
  });

  const readout = document.getElementById('design-space-readout');
  if (readout) readout.textContent = designSpaceReadout(selectedDesignSpace);
  if (syncPrompt) syncDesignPromptScaffold();
}

function syncCustomAxesToDesignSpace({ syncPrompt = true } = {}) {
  const xAxis = mappedAxis('x');
  const yAxis = mappedAxis('y');
  selectedDesignSpace.x = clamp01(xAxis?.value ?? selectedDesignSpace.x);
  selectedDesignSpace.y = clamp01(yAxis?.value ?? selectedDesignSpace.y);
  selectedDesignSpace.customAxes = customDesignAxes.map((axis) => ({
    id: axis.id,
    name: axis.name || axisName(axis),
    leftLabel: axis.leftLabel,
    rightLabel: axis.rightLabel,
    value: clamp01(axis.value ?? 0.5),
    scores: axis.scores || [],
    terms: axis.terms || [],
    mapRole: axis.mapRole || '',
  }));
  selectedDesignSpace.xAxis = xAxis ? { id: xAxis.id, name: xAxis.name || axisName(xAxis), leftLabel: xAxis.leftLabel, rightLabel: xAxis.rightLabel, terms: xAxis.terms || [] } : null;
  selectedDesignSpace.yAxis = yAxis ? { id: yAxis.id, name: yAxis.name || axisName(yAxis), leftLabel: yAxis.leftLabel, rightLabel: yAxis.rightLabel, terms: yAxis.terms || [] } : null;
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
  if (layout.designSpace) setDesignSpaceSelection(layout.designSpace);
  selectVersion(layout.id);
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

function placeGeneratedLayoutOnAxes(layout) {
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
    score.rationale = 'generated at selected axis position';
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
    const conceptLabel = Array.isArray(axis.terms) && axis.terms.length
      ? `<div class="axis-term-ladder" title="${PortfolioContent.escapeHtml(activeConcept.description || `${Math.round(activeConcept.value * 100)}% on this axis`)}">Closest concept: ${PortfolioContent.escapeHtml(activeConcept.label)}</div>`
      : '';
    const row = document.createElement('div');
    row.className = 'custom-axis';
    row.innerHTML = `
      <div class="custom-axis-fields">
        <label>Left concept
          <input type="text" data-axis-field="leftLabel" value="${PortfolioContent.escapeHtml(axis.leftLabel || '')}">
        </label>
        <label>Right concept
          <input type="text" data-axis-field="rightLabel" value="${PortfolioContent.escapeHtml(axis.rightLabel || '')}">
        </label>
        <div class="custom-axis-map-controls" aria-label="Map axis role">
          <button class="ghost-btn custom-axis-map ${axis.mapRole === 'x' ? 'active' : ''}" type="button" data-map-role="x" title="Use this axis as the horizontal map axis">X</button>
          <button class="ghost-btn custom-axis-map ${axis.mapRole === 'y' ? 'active' : ''}" type="button" data-map-role="y" title="Use this axis as the vertical map axis">Y</button>
        </div>
        <button class="ghost-btn custom-axis-rank" type="button" title="Rank websites on this axis">Rank</button>
        <button class="ghost-btn custom-axis-remove" type="button" aria-label="Remove axis">x</button>
      </div>
      <div class="custom-axis-rank-row">
        <span>${PortfolioContent.escapeHtml(axis.leftLabel || 'left')}</span>
        <div class="custom-axis-notes" aria-label="Ranked website notes"></div>
        <span>${PortfolioContent.escapeHtml(axis.rightLabel || 'right')}</span>
      </div>
      ${conceptLabel}
    `;

    row.querySelectorAll('input[type="text"]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.axisField;
        axis[field] = input.value.trim();
        axis.name = axisName(axis);
        axis.scores = [];
        axis.terms = defaultTermsForAxis(axis);
        saveDesignAxes();
        renderCustomDesignAxes();
        renderSidebarDesignAxes();
        syncCustomAxesToDesignSpace();
      });
    });

    row.querySelectorAll('.custom-axis-map').forEach((button) => {
      button.addEventListener('click', () => markAxisForMap(axis, button.dataset.mapRole));
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
        <span>${PortfolioContent.escapeHtml(axis.leftLabel || 'left')}</span>
        <span>${PortfolioContent.escapeHtml(axis.rightLabel || 'right')}</span>
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
  if (!axis.leftLabel || !axis.rightLabel) {
    alert('Name both ends of the axis first.');
    return;
  }
  const manualScores = new Map((axis.scores || []).filter((score) => score.manual).map((score) => [score.key, score]));
  const data = await fetchJson('/api/design-axis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ axis }),
  });
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

function createDesignSpaceNode(layout, index, { preview = false, mode = 'xy' } = {}) {
  const point = getLayoutMapPoint(layout, mode);
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
  node.dataset.label = layout.generated ? `${layout.name} *` : layout.name;
  node.style.setProperty('--node-x', `${point.x * 100}%`);
  node.style.setProperty('--node-y', `${(1 - point.y) * 100}%`);
  node.style.setProperty('--node-color', color);
  node.title = layout.name;

  if (preview) {
    node.innerHTML = `
      <span class="design-space-node-preview">
        <iframe src="${PortfolioContent.escapeHtml(layoutPreviewSrc(layout))}" tabindex="-1" loading="lazy"></iframe>
      </span>
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
  (window.PORTFOLIO_LAYOUTS || []).forEach((layout, index) => {
    const { node, color } = createDesignSpaceNode(layout, index, { preview, mode });
    plane.appendChild(node);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'design-space-legend-item';
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
  document.querySelectorAll('.axis-label--left').forEach((label) => { label.textContent = xAxis.leftLabel || 'Left'; });
  document.querySelectorAll('.axis-label--right').forEach((label) => { label.textContent = xAxis.rightLabel || 'Right'; });
  document.querySelectorAll('.axis-label--bottom').forEach((label) => { label.textContent = yAxis.leftLabel || 'Bottom'; });
  document.querySelectorAll('.axis-label--top').forEach((label) => { label.textContent = yAxis.rightLabel || 'Top'; });
  if (mode !== 'xy') {
    document.querySelectorAll('.axis-label--left').forEach((label) => { label.textContent = horizontalAxis.leftLabel || 'Left'; });
    document.querySelectorAll('.axis-label--right').forEach((label) => { label.textContent = horizontalAxis.rightLabel || 'Right'; });
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
    syncCustomAxesToDesignSpace({ syncPrompt: false });
  }

  document.querySelectorAll('.design-space').forEach((plane) => {
    plane.addEventListener('click', (e) => {
      const rect = plane.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - ((e.clientY - rect.top) / rect.height);
      const mode = getDesignSpaceMode();
      setDesignSpaceSelection(mode === 'xy' ? { x, y } : { x, y: 0.5 });
    });

    plane.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      setDesignSpaceSelection(selectedDesignSpace);
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

function setupAI() {
  const generateBtn = document.getElementById('generate-btn');
  const generateStatus = document.getElementById('generate-status');
  const questionsEl = document.getElementById('generate-questions');
  const generatePanel = generateBtn?.closest('.generate-panel');
  const generateTitle = generatePanel?.querySelector('.generate-panel-head strong');
  const promptEl = document.getElementById('ai-prompt');
  const imageInput = document.getElementById('image-vibe-input');
  const imagePickBtn = document.getElementById('image-vibe-pick');
  const imageAnalyzeBtn = document.getElementById('image-vibe-analyze');
  const imagePreview = document.getElementById('image-vibe-preview');
  const imageTokensEl = document.getElementById('image-vibe-tokens');
  let selectedImageFile = null;

  const setGenerateMode = (mode = 'compose') => {
    if (generatePanel) generatePanel.dataset.generateMode = mode;
    if (generateTitle) generateTitle.textContent = mode === 'question' ? 'Design questions' : 'Generate';
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
    imageTokensEl.hidden = false;
    imageTokensEl.innerHTML = `
      <div class="image-vibe-token-head">
        <strong>${PortfolioContent.escapeHtml(tokens.interfaceTranslation?.metaphor || 'Image vibe')}</strong>
        <span>${PortfolioContent.escapeHtml(model || 'gpt-4.1-mini')}</span>
      </div>
      ${tokens.summary ? `<p>${PortfolioContent.escapeHtml(tokens.summary)}</p>` : ''}
      ${palette.length ? `<div class="image-vibe-palette">${palette.map(colorChipHtml).join('')}</div>` : ''}
    `;
  };

  const tokenLine = (label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '').trim();
    return text ? `${label}: ${text}` : '';
  };

  const formatImageTokenPrompt = (tokens) => {
    const palette = Array.isArray(tokens.palette)
      ? tokens.palette.map((color) => `${color.name || color.hex} ${color.hex}${color.role ? ` (${color.role})` : ''}`).join(', ')
      : '';
    return [
      'REFERENCE_FIDELITY: high',
      'Use the uploaded image as a style reference, not a literal scene copy.',
      'Preserve the visual language, palette, texture, interface metaphor, and interaction mood. Generalize specific objects/text into reusable portfolio components.',
      tokenLine('Summary', tokens.summary),
      tokenLine('Visual style', tokens.visualStyle),
      tokenLine('Mood', tokens.mood),
      tokenLine('Palette', palette),
      tokenLine('Typography personality', tokens.typography?.personality),
      tokenLine('Layout composition', tokens.layout?.composition),
      tokenLine('Layout texture', tokens.layout?.texture),
      tokenLine('Components', tokens.components),
      tokenLine('Interface metaphor', tokens.interfaceTranslation?.metaphor),
      tokenLine('Navigation', tokens.interfaceTranslation?.navigation),
      tokenLine('Interaction pace', tokens.interaction?.pace),
      tokens.generationPrompt ? `Generator brief: ${tokens.generationPrompt}` : '',
    ].filter(Boolean).join('\n');
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
      const data = await fetchJson('/api/image-design-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          mimeType: selectedImageFile.type,
          fileName: selectedImageFile.name,
        }),
      });
      const prompt = formatImageTokenPrompt(data.tokens || {});
      const existing = promptEl.value.trim();
      promptEl.value = existing
        ? `${existing}\n\nImage-derived design tokens:\n${prompt}`
        : prompt;
      resetQuestions();
      pendingGeneratePrompt = promptEl.value.trim();
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
    const data = await fetchJson('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        designSpace: selectedDesignSpace,
        answers: pendingGenerateAnswers,
      }),
    });
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
    const prompt = promptEl.value.trim();
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

    const clarifiedPrompt = promptWithAnswers(prompt, pendingGenerateAnswers);
    if (questionsEl) questionsEl.hidden = true;
    setGenerateMode('compose');

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    generateStatus.hidden = false;
    generateStatus.textContent = 'AI is building your interface…';
    generateStatus.className = 'generate-status generate-status--busy';

    try {
      const data = await fetchJson('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: clarifiedPrompt, designSpace: selectedDesignSpace }),
      });

      if (data.layouts) window.PORTFOLIO_LAYOUTS = data.layouts;
      const layout = data.layout;
      placeGeneratedLayoutOnAxes(layout);
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
  previewIframe.contentWindow.postMessage({
    source: 'portfolio-editor',
    type: 'colors',
    colors: getCurrentVersionColors(),
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

function getEditedGridGapPx() {
  const slider = document.getElementById('grid-gap');
  if (slider) return parseInt(slider.value, 10) || 24;
  return parseSpacingPx(editedTheme.spacing?.gridGap);
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
    const { content } = rebuildData;
    if (content) contentModel = content;
    try {
      const data = await fetchJson('/api/layouts');
      if (data.layouts) window.PORTFOLIO_LAYOUTS = data.layouts;
    } catch {
      // Layouts are already in memory; refresh is just for the save label.
    }
    refreshInspectModel();
    const layoutCount = (window.PORTFOLIO_LAYOUTS || []).length;
    const generatedCount = (window.PORTFOLIO_LAYOUTS || []).filter((layout) => layout.generated).length;
    const layoutLabel = generatedCount
      ? `${layoutCount} layouts, ${generatedCount} generated`
      : `${layoutCount} layouts`;
    btn.textContent = `Saved ✓ (${layoutLabel})`;
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
  syncDeviceFrameLayoutClass();
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.scrolling = getLayout(currentVersion)?.key === 'directory' ? 'no' : 'auto';
  iframe.sandbox.add('allow-same-origin', 'allow-scripts');
  container.appendChild(iframe);
  previewIframe = iframe;

  window.appData.then(({ manifest }) => {
    const html = buildPreviewHTML(manifest, currentVersion, getPreviewWidth());
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
  const text = PortfolioContent.getText(content, id, fallback);
  const style = PortfolioContent.styleToCss(PortfolioContent.getElementStyle(theme, content, id, role, versionKey));
  const cls = className ? ` class="${className}"` : '';
  const modelAttrs = id === 'portfolio.title'
    ? ' data-model-kind="text" data-model-path="content.text.portfolio.title" data-model-label="Portfolio title"'
    : '';
  return `<${tag}${cls} data-text-id="${id}" data-text-role="${role}" data-text-fallback="${PortfolioContent.escapeHtml(fallback)}"${modelAttrs} style="${style}">${PortfolioContent.escapeHtml(text)}</${tag}>`;
}

function buildPreviewNav(activeLayout) {
  const links = [
    ...PORTFOLIO_LAYOUTS.map((layout) => ({ label: layout.name, file: layout.file, key: layout.key })),
    { label: 'Edit', file: 'edit.html' },
  ];

  const items = links.map((link) => {
    if (link.key && link.key === activeLayout.key) {
      return `<span class="active-view">${PortfolioContent.escapeHtml(link.label)}</span>`;
    }
    const keyAttr = link.key ? ` data-preview-layout-key="${PortfolioContent.escapeHtml(link.key)}"` : '';
    return `<a href="./${link.file}" data-preview-nav${keyAttr}>${PortfolioContent.escapeHtml(link.label)}</a>`;
  }).join('');

  return `<p>${items}</p>`;
}

function buildPreviewHTML(manifest, version, previewWidth = 1100, options = {}) {
  const layout = getLayout(version) || getLayout(1);
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
  ${enableAssistant ? '<script src="./scripts/cursor-assistant.js"><\\/script>' : ''}
  <script>
    requestAnimationFrame(() => {
      if (document.body.dataset.editMode && !document.querySelector('.text-edit-toolbar')) {
        const textScript = document.createElement('script');
        textScript.src = './scripts/text-edit.js';
        document.body.appendChild(textScript);
      }
      if (document.body.dataset.editMode && !document.querySelector('.cursor-assistant')) {
        const assistantScript = document.createElement('script');
        assistantScript.src = './scripts/cursor-assistant.js';
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
    .text-edit-selected { outline: 2px solid var(--color-primary) !important; outline-offset: 3px; }
    .text-edit-toolbar {
      --text-edit-ink: #111111;
      --text-edit-muted: #5f5f5f;
      --text-edit-paper: #ffffff;
      --text-edit-panel: #f7f5ef;
      --text-edit-line: rgba(17, 17, 17, 0.22);
      --text-edit-hover: #eee8dc;
      position: absolute;
      z-index: 2000;
      background: var(--text-edit-paper) !important;
      border: 1px solid var(--text-edit-line);
      border-radius: 8px;
      padding: 0.65rem 0.75rem;
      min-width: 220px;
      font-family: system-ui, sans-serif;
      font-size: 0.82rem;
      line-height: 1.3;
      color: var(--text-edit-ink) !important;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
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
    .text-edit-props button.active { background: #111111 !important; color: #ffffff !important; }
    .text-edit-props button.active * { color: #ffffff !important; }
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
    .text-edit-size { accent-color: var(--text-edit-ink); }
    .text-edit-scope { border: none; margin-top: 0.5rem; padding: 0; }
    .text-edit-scope legend { font-weight: 600; font-size: 0.75rem; margin-bottom: 0.25rem; }
    .text-edit-scope label { display: block; font-size: 0.75rem; margin: 0.15rem 0; cursor: pointer; }
    .text-edit-scope input { accent-color: var(--text-edit-ink); }
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
      padding: 4rem 2rem 2.25rem;
    }
    body[data-edit-mode="1"].view-directory h1 {
      margin-bottom: 1.5rem;
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

  const generatedHead = layout.generated
    ? `<link rel="stylesheet" href="./generated/${layout.key}/style.css">`
    : '';

  const generatedScripts = layout.generated
    ? `<script src="./scripts/generated-runtime.js"><\/script>
  <script src="./generated/${layout.key}/render.js"><\/script>`
    : `<script src="./scripts/component-registry.js"><\/script>
  <script src="./scripts/model-loader.js"><\/script>
  ${deskScripts}
  <script src="./scripts/render.js"><\/script>`;

  const mountScript = layout.generated
    ? `(async () => {
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
  })();`
    : `(async () => {
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
        id: PortfolioContent.collectionId(index),
        originalIndex: index,
        ...col,
      })),
      models
    );
    if (window.__PREVIEW_PRESENTATION_ID__ === 'directory') {
      PortfolioRender.layoutDirectoryViewport();
    }
  })();`;

  return `<!DOCTYPE html>
<html class="${previewViewClass.trim()}">
<head>
  <meta charset="UTF-8">
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
    ${titleHeading}
    ${buildPreviewNav(layout)}
  </header>
  <main class="container" data-model-kind="presentation" data-model-path="presentations.${presentationId}" data-presentation-id="${presentationId}" data-model-label="${PortfolioContent.escapeHtml(layout.name)} presentation">
    <div id="preview-content"></div>
  </main>
  <script>window.__EDIT_STATE__ = ${editState};<\/script>
  <script>window.__PREVIEW_MANIFEST__ = ${previewManifest}; window.__PREVIEW_PRESENTATION_ID__ = "${presentationId}"; window.__PREVIEW_WIDTH__ = ${previewWidth};<\/script>
  <script src="./scripts/content.js"><\/script>
  <script src="./scripts/model-loader.js"><\/script>
  ${generatedScripts}
  <script>
  ${mountScript}

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'portfolio-editor') return;
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

document.addEventListener('DOMContentLoaded', initEditMode);
