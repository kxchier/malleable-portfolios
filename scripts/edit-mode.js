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

function getVersionColorsForKey(versionKey) {
  return PortfolioContent.getVersionColors(editedTheme, versionKey);
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

function textMatchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function fontFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  return PortfolioContent.FONT_OPTIONS.find((font) => lower.includes(font.toLowerCase()));
}

function textAlignFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (/left[-\s]?align|align (it |this )?left|flush left/.test(lower)) return 'left';
  if (/right[-\s]?align|align (it |this )?right|flush right/.test(lower)) return 'right';
  if (/center|centre|middle/.test(lower) && /align|text|title|heading|this/.test(lower)) return 'center';
  return null;
}

function textRotationFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (!/rotate|rotation|tilt|slant|angle|crooked|askew/.test(lower)) return null;
  const explicit = lower.match(/(-?\d{1,3})(?:\s?deg| degrees?)/);
  if (explicit) return Math.max(-45, Math.min(45, parseInt(explicit[1], 10)));
  if (/right|clockwise/.test(lower)) return 4;
  if (/straight|reset|normal/.test(lower)) return 0;
  return -4;
}

function textTranslationFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (!/move|shift|nudge|raise|lower|up|down|left|right/.test(lower)) return null;
  if (!/text|title|heading|this|it/.test(lower)) return null;
  const explicit = lower.match(/(-?\d{1,3})\s?(?:px|pixels?)/);
  const amount = explicit ? Math.max(-80, Math.min(80, parseInt(explicit[1], 10))) : 6;
  let x = 0;
  let y = 0;
  if (/up|raise|higher/.test(lower)) y = -Math.abs(amount);
  if (/down|lower/.test(lower)) y = Math.abs(amount);
  if (/left/.test(lower)) x = -Math.abs(amount);
  if (/right/.test(lower)) x = Math.abs(amount);
  if (x === 0 && y === 0) return null;
  return { x, y };
}

function proposalFor(operation, message) {
  return { operation, message };
}

function normalizeCursorScope(scope) {
  return ['this', 'role', 'all-headings', 'all-images'].includes(scope) ? scope : 'this';
}

function scopeLabelForTarget(target, scope) {
  if (target?.kind === 'text') {
    if (scope === 'role') return 'all section titles';
    if (scope === 'all-headings') return 'all headings';
    return 'this text';
  }
  if (target?.kind === 'work') {
    if (scope === 'all-images') return 'all images';
    return 'this image';
  }
  return 'this object';
}

async function proposeCursorOperation({ target, prompt, scope, presentationId }) {
  scope = normalizeCursorScope(scope);
  const normalized = prompt.trim().toLowerCase();
  const versionKey = getCurrentVersionKey();
  const currentPresentation = presentationId || getCurrentPresentationId();

  if (target?.kind === 'text') {
    const translation = textTranslationFromPrompt(prompt);
    if (translation) {
      const transform = `translate(${translation.x}px, ${translation.y}px)`;
      return proposalFor({
        type: 'stylePatch',
        target,
        scope,
        versionKey,
        patch: { transform },
      }, `Move ${target.label} ${translation.x}px horizontally and ${translation.y}px vertically in this presentation.`);
    }

    const rotation = textRotationFromPrompt(prompt);
    if (rotation != null) {
      return proposalFor({
        type: 'stylePatch',
        target,
        scope,
        versionKey,
        patch: {
          transform: rotation === 0 ? 'rotate(0deg)' : `rotate(${rotation}deg)`,
          transformOrigin: 'left center',
        },
      }, rotation === 0 ? `Reset rotation for ${target.label}.` : `Rotate ${target.label} ${rotation} degrees in this presentation.`);
    }

    const textAlign = textAlignFromPrompt(prompt);
    if (textAlign) {
      const scopeLabel = scopeLabelForTarget(target, scope);
      return proposalFor({
        type: 'typography',
        target,
        scope,
        versionKey,
        property: 'textAlign',
        value: textAlign,
      }, `Align ${target.label} ${textAlign} for ${scopeLabel}.`);
    }

    const font = fontFromPrompt(prompt);
    if (font || textMatchesAny(normalized, [/font/, /typeface/, /serif/, /sans/])) {
      const fallbackFont = font || (normalized.includes('serif') ? 'Georgia' : 'DM Sans');
      const scopeLabel = scopeLabelForTarget(target, scope);
      return proposalFor({
        type: 'typography',
        target,
        scope,
        versionKey,
        property: 'fontFamily',
        value: fallbackFont,
      }, `Change ${target.label} to ${fallbackFont} for ${scopeLabel}.`);
    }

    return parseOperationWithAI({ target, prompt, scope, presentationId: currentPresentation, versionKey });
  }

  const visibilityTarget = target?.kind === 'collection' ? target : collectionTargetFromText(target);
  if (visibilityTarget && textMatchesAny(normalized, [
    /hide/,
    /don.?t want/,
    /do not want/,
    /not see/,
    /remove.*(view|presentation|here)/,
    /invisible/,
  ])) {
    return proposalFor({
      type: 'collectionVisibility',
      target: visibilityTarget,
      presentationId: currentPresentation,
      visible: false,
    }, `Hide “${visibilityTarget.label}” in ${currentPresentation}. It will stay in the portfolio and other presentations.`);
  }

  if (textMatchesAny(normalized, [/less clutter/, /less crowded/, /more space/, /spread.*out/, /too crowded/])) {
    const nextGap = Math.min(56, getEditedGridGapPx() + 8);
    const artSize = parseSpacingPx(editedTheme.spacing.artSize || '190px');
    const nextArtSize = Math.max(120, artSize - 10);
    return proposalFor({
      type: 'spacing',
      target,
      versionKey,
      gridGap: `${nextGap}px`,
      artSize: `${Math.round(nextArtSize)}px`,
    }, `Make ${target?.label || 'this interface'} less crowded by increasing spacing and slightly reducing artwork size.`);
  }

  if (target?.kind === 'work' && textMatchesAny(normalized, [/important/, /feature/, /bigger/, /larger/, /emphasize/])) {
    const artSize = parseSpacingPx(editedTheme.spacing.artSize || '190px');
    return proposalFor({
      type: 'spacing',
      target,
      versionKey,
      artSize: `${Math.min(360, Math.round(artSize + 24))}px`,
      gridGap: editedTheme.spacing.gridGap,
    }, `Make artwork tiles larger in this presentation to give “${target.label}” more presence.`);
  }

  return parseOperationWithAI({ target, prompt, scope, presentationId: currentPresentation, versionKey });
}

async function parseOperationWithAI({ target, prompt, scope, presentationId, versionKey }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return proposalFor(
      { type: 'noop' },
      'Connect your Cerebras API key to interpret this as a flexible local edit. I will only generate a new interface when the parsed operation explicitly asks for one.'
    );
  }

  const result = await fetchJson('/api/operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
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
      editedTheme.spacing.gridGap = operation.gridGap;
      const gridGapSlider = document.getElementById('grid-gap');
      if (gridGapSlider) gridGapSlider.value = parseSpacingPx(operation.gridGap);
      document.getElementById('grid-gap-display').textContent = operation.gridGap;
      document.documentElement.style.setProperty('--space-gridGap', operation.gridGap);
    }
    if (operation.artSize) {
      editedTheme.spacing.artSize = operation.artSize;
      const artSizeSlider = document.getElementById('art-size');
      if (artSizeSlider) artSizeSlider.value = parseSpacingPx(operation.artSize);
      document.getElementById('art-size-display').textContent = operation.artSize;
      document.documentElement.style.setProperty('--space-artSize', operation.artSize);
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
    });
    examples.appendChild(chip);
  });
}

function syncDeviceFrameLayoutClass() {
  const layout = getLayout(currentVersion);
  const isDirectory = layout?.key === 'directory';
  const frame = document.getElementById('device-frame');
  const previewArea = document.querySelector('.preview-area');
  if (frame) frame.classList.toggle('preview-directory', isDirectory);
  if (previewArea) previewArea.classList.toggle('preview-directory', isDirectory);
}

function selectVersion(versionId) {
  currentVersion = versionId;
  document.querySelectorAll('.version-btn:not(.create-btn)').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.version, 10) === versionId);
  });
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
    container.insertBefore(btn, createBtn);
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

function setupCreateModal() {
  const modal = document.getElementById('create-modal');
  const open = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };

  document.querySelector('.create-btn').addEventListener('click', open);
  document.getElementById('create-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

const AI_KEY_STORE = 'portfolio.cerebrasApiKey';

function getApiKey() {
  return localStorage.getItem(AI_KEY_STORE) || '';
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
  const keyInput = document.getElementById('api-key-input');
  const status = document.getElementById('ai-status');
  const generateBtn = document.getElementById('generate-btn');
  const generateStatus = document.getElementById('generate-status');

  const setConnected = (connected) => {
    status.textContent = connected ? 'connected ✓' : 'not connected';
    status.className = 'ai-status ' + (connected ? 'ai-status--on' : 'ai-status--off');
  };

  const saved = getApiKey();
  if (saved) { keyInput.value = saved; setConnected(true); }

  document.getElementById('connect-ai-btn').addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) { setConnected(false); localStorage.removeItem(AI_KEY_STORE); return; }
    localStorage.setItem(AI_KEY_STORE, key);
    setConnected(true);
  });

  generateBtn.addEventListener('click', async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert('Connect your Cerebras API key first — paste it in the toolbar at the top.');
      return;
    }

    const prompt = document.getElementById('ai-prompt').value.trim();
    if (!prompt) {
      alert('Describe the layout you want first.');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    generateStatus.hidden = false;
    generateStatus.textContent = 'Cerebras is building your interface…';
    generateStatus.className = 'generate-status generate-status--busy';

    try {
      const data = await fetchJson('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, prompt }),
      });

      if (data.layouts) window.PORTFOLIO_LAYOUTS = data.layouts;
      const layout = data.layout;
      if (data.versionColors && layout?.key) {
        ensureVersionColorsObject(layout.key);
        editedTheme.versions[layout.key].colors = { ...data.versionColors };
      }
      document.getElementById('create-modal').hidden = true;
      generateStatus.textContent = `Created "${layout.name}" — switching preview…`;
      generateStatus.className = 'generate-status generate-status--ok';

      applyLayoutMetadata();
      selectVersion(layout.id);
    } catch (e) {
      generateStatus.textContent = e.message;
      generateStatus.className = 'generate-status generate-status--err';
      alert(`Generation failed:\n\n${e.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = '✨ Generate version';
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
  const previewColors = getVersionColorsForKey(layout.key);
  const titleHeading = buildTextHeading('h1', '', 'portfolio.title', 'portfolio.title', 'My Art Portfolio', editedTheme, editedContent, layout.key);
  const editState = JSON.stringify({ theme: editedTheme, content: editedContent, versionKey: layout.key }).replace(/</g, '\\u003c');
  const previewManifest = JSON.stringify(manifest).replace(/</g, '\\u003c');
  const layoutViewClass = `view-${layout.key}`;
  const directoryViewClass = layout.key === 'directory' ? ' view-directory' : '';
  const previewViewClass = `${layoutViewClass}${directoryViewClass}`;
  const directoryInlineStyles = layout.key === 'directory'
    ? `
    html.view-directory, body.view-directory {
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }
    .view-directory .container {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding-bottom: 0.75rem;
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
      --space-gridGap: ${editedTheme.spacing.gridGap};
      --space-artSize: ${editedTheme.spacing.artSize || '190px'};
    }
    ${directoryInlineStyles}
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
  </style>
</head>
<body data-edit-mode="1" class="${previewViewClass.trim()}">
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
    link.addEventListener('click', (e) => e.preventDefault());
  });
  <\/script>
  <script src="./scripts/text-edit.js"><\/script>
  <script src="./scripts/cursor-assistant.js"><\/script>
</body>
</html>`;
}

document.addEventListener('DOMContentLoaded', initEditMode);
