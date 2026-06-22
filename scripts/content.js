/** Text content overrides and typography helpers (shared by views + editor). */
window.PortfolioContent = (() => {
  const ROLE_TOKENS = {
    'portfolio.title': 'heading1',
    'collection.title': 'heading2',
  };

  const DEFAULT_TYPO = {
    heading1: { fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '2.75rem', fontWeight: '400' },
    heading2: { fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '0.72rem', fontWeight: '500' },
    body: { fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '1rem', fontWeight: '400' },
  };

  const FONT_OPTIONS = [
    'Cormorant Garamond',
    'DM Sans',
    'Georgia',
    'Trebuchet MS',
    'Arial',
    'Courier New',
    'Times New Roman',
    'system-ui',
  ];

  const TEXT_STYLE_PROPS = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'textAlign',
    'letterSpacing',
    'lineHeight',
    'textDecoration',
    'transform',
    'transformOrigin',
    'opacity',
  ];

  const ELEMENT_STYLE_PROPS = [
    'aspectRatio',
    'background',
    'border',
    'borderColor',
    'borderRadius',
    'borderStyle',
    'borderWidth',
    'boxShadow',
    'clipPath',
    'filter',
    'height',
    'maxHeight',
    'maxWidth',
    'objectFit',
    'objectPosition',
    'opacity',
    'outline',
    'overflow',
    'padding',
    'transform',
    'transformOrigin',
    'width',
  ];

  function normalizeTypographyEntry(entry, token) {
    const base = { ...DEFAULT_TYPO[token] };
    if (!entry) return base;
    if (typeof entry === 'string') return { ...base, fontSize: entry };
    return { ...base, ...entry };
  }

  function getTokenStyle(theme, token) {
    const entry = theme?.typography?.[token];
    return normalizeTypographyEntry(entry, token);
  }

  /** Typography for a layout version: global theme + per-version overrides. */
  function getVersionTypography(theme, versionKey, token) {
    const base = getTokenStyle(theme, token);
    const versionEntry = theme?.versions?.[versionKey]?.typography?.[token];
    if (!versionEntry) return base;
    if (typeof versionEntry === 'string') return { ...base, fontSize: versionEntry };
    return { ...base, ...versionEntry };
  }

  /** Colors for a layout version: global theme.colors + per-version overrides. */
  function getVersionColors(theme, versionKey) {
    const base = { ...(theme?.colors || {}) };
    if (!versionKey) return base;
    const overrides = theme?.versions?.[versionKey]?.colors || {};
    return { ...base, ...overrides };
  }

  function applyColorVars(theme, versionKey, root = document.documentElement) {
    const colors = getVersionColors(theme, versionKey);
    Object.entries(colors).forEach(([key, value]) => {
      if (value != null) root.style.setProperty(`--color-${key}`, value);
    });
  }

  function getTextOverride(content, id) {
    return content?.text?.[id] || {};
  }

  function getText(content, id, fallback) {
    const override = getTextOverride(content, id);
    if (Object.prototype.hasOwnProperty.call(override, 'content')) {
      return override.content;
    }
    return fallback;
  }

  function getVersionTextStyle(content, id, versionKey) {
    const override = getTextOverride(content, id);
    const versionStyle = override.versions?.[versionKey] || {};
    return Object.fromEntries(TEXT_STYLE_PROPS.map((prop) => [
      prop,
      versionStyle[prop] ?? override[prop],
    ]));
  }

  function getElementStyle(theme, content, id, role, versionKey) {
    const token = ROLE_TOKENS[role] || 'body';
    const base = versionKey ? getVersionTypography(theme, versionKey, token) : getTokenStyle(theme, token);
    const textStyle = versionKey ? getVersionTextStyle(content, id, versionKey) : getTextOverride(content, id);
    const style = {
      fontFamily: textStyle.fontFamily || base.fontFamily,
      fontSize: textStyle.fontSize || base.fontSize,
      fontWeight: textStyle.fontWeight || base.fontWeight,
    };
    TEXT_STYLE_PROPS.forEach((prop) => {
      if (prop in style) return;
      style[prop] = textStyle[prop] || base[prop] || '';
    });
    return style;
  }

  function idsForStyleScope(content, scope, role) {
    const text = content?.text || {};
    if (scope === 'role') {
      if (role === 'portfolio.title') return ['portfolio.title'];
      if (role === 'collection.title') {
        return Object.keys(text).filter((id) => id.startsWith('collection.'));
      }
    }
    if (scope === 'all-headings') {
      return Object.keys(text).filter((id) => id === 'portfolio.title' || id.startsWith('collection.'));
    }
    return [];
  }

  function pruneTextEntry(content, id) {
    const entry = content.text?.[id];
    if (!entry) return;
    const hasContent = Object.prototype.hasOwnProperty.call(entry, 'content');
    const hasLegacyStyle = TEXT_STYLE_PROPS.some((prop) => entry[prop]);
    const hasVersionStyle = entry.versions && Object.values(entry.versions).some(
      (v) => v && TEXT_STYLE_PROPS.some((prop) => v[prop])
    );
    if (!hasContent && !hasLegacyStyle && !hasVersionStyle) delete content.text[id];
    if (entry.versions) {
      Object.keys(entry.versions).forEach((vk) => {
        const v = entry.versions[vk];
        if (v && !TEXT_STYLE_PROPS.some((prop) => v[prop])) delete entry.versions[vk];
      });
      if (Object.keys(entry.versions).length === 0) delete entry.versions;
    }
  }

  function clearStyleOverrides(content, scope, role, property, versionKey) {
    if (scope === 'this' || property === 'content' || !versionKey) return;
    if (!content.text) content.text = {};
    idsForStyleScope(content, scope, role).forEach((id) => {
      if (!content.text[id]) return;
      delete content.text[id][property];
      if (content.text[id].versions?.[versionKey]) {
        delete content.text[id].versions[versionKey][property];
        if (Object.keys(content.text[id].versions[versionKey]).length === 0) {
          delete content.text[id].versions[versionKey];
        }
      }
      pruneTextEntry(content, id);
    });
  }

  function styleToCss(style) {
    return TEXT_STYLE_PROPS
      .filter((prop) => style[prop])
      .map((prop) => `${prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${style[prop]}`)
      .join(';');
  }

  function applyTypographyVars(theme, versionKey, root = document.documentElement) {
    Object.keys(DEFAULT_TYPO).forEach((token) => {
      const s = versionKey
        ? getVersionTypography(theme, versionKey, token)
        : getTokenStyle(theme, token);
      root.style.setProperty(`--font-${token}`, s.fontSize);
      root.style.setProperty(`--font-${token}-family`, s.fontFamily);
      root.style.setProperty(`--font-${token}-weight`, s.fontWeight);
    });
  }

  function applyToElement(el, theme, content, versionKey) {
    const id = el.dataset.textId;
    const role = el.dataset.textRole;
    if (!id || !role) return;
    const fallback = el.dataset.textFallback || el.textContent;
    const text = getText(content, id, fallback);
    el.textContent = text;
    el.hidden = false;
    const style = getElementStyle(theme, content, id, role, versionKey);
    TEXT_STYLE_PROPS.forEach((prop) => {
      el.style[prop] = style[prop] || '';
    });
  }

  function styleIdForElement(el) {
    if (!el) return null;
    if (el.dataset.modelPath) return el.dataset.modelPath;
    if (el.dataset.textId) return `text.${el.dataset.textId}`;
    return null;
  }

  function applyStylePatchToElement(el, patch = {}) {
    ELEMENT_STYLE_PROPS.forEach((prop) => {
      if (patch[prop] != null) el.style[prop] = patch[prop];
    });
  }

  function mergedElementStyle(content, versionKey, id) {
    const globalStyle = content?.elementStyles?.all?.[id] || {};
    const versionStyle = content?.elementStyles?.versions?.[versionKey]?.[id] || {};
    return {
      patch: { ...(globalStyle.patch || {}), ...(versionStyle.patch || {}) },
      imagePatch: { ...(globalStyle.imagePatch || {}), ...(versionStyle.imagePatch || {}) },
    };
  }

  function applyElementStyleOverrides(content, versionKey, root = document) {
    const versionStyles = content?.elementStyles?.versions?.[versionKey] || {};
    const allWorkStyle = versionStyles.__all_work__;
    if (allWorkStyle) {
      root.querySelectorAll('[data-model-kind="work"]').forEach((el) => {
        applyStylePatchToElement(el, allWorkStyle.patch || {});
        if (Object.keys(allWorkStyle.imagePatch || {}).length) {
          const imageTargets = el.matches('img') ? [el] : Array.from(el.querySelectorAll('img'));
          imageTargets.forEach((img) => applyStylePatchToElement(img, allWorkStyle.imagePatch));
        }
      });
    }

    root.querySelectorAll('[data-model-path], [data-text-id]').forEach((el) => {
      const id = styleIdForElement(el);
      if (!id) return;
      const style = mergedElementStyle(content, versionKey, id);
      applyStylePatchToElement(el, style.patch);
      if (Object.keys(style.imagePatch).length) {
        const imageTargets = el.matches('img') ? [el] : Array.from(el.querySelectorAll('img'));
        imageTargets.forEach((img) => applyStylePatchToElement(img, style.imagePatch));
      }
    });
  }

  function applyPageText(manifest, theme, content, versionKey, root = document) {
    applyColorVars(theme, versionKey, root.documentElement);
    applyTypographyVars(theme, versionKey, root.documentElement);

    root.querySelectorAll('[data-text-id]').forEach((el) => {
      applyToElement(el, theme, content, versionKey);
    });

    applyElementStyleOverrides(content, versionKey, root);

    const titleEl = root.querySelector('[data-text-id="portfolio.title"]');
    if (titleEl) {
      document.title = getText(content, 'portfolio.title', titleEl.textContent) + ' — Art Portfolio';
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function collectionId(index) {
    return `collection.${index}`;
  }

  function defaultContent(manifest) {
    return {
      text: {
        'portfolio.title': { content: 'My Art Portfolio' },
      },
    };
  }

  function mergeContent(saved, manifest) {
    const base = defaultContent(manifest);
    const text = { ...base.text, ...(saved?.text || {}) };
    manifest.collections.forEach((col, i) => {
      const id = collectionId(i);
      if (!text[id]) text[id] = {};
      if (text[id].content == null) text[id].content = col.name;
    });
    return { ...(saved || {}), text };
  }

  return {
    ROLE_TOKENS,
    FONT_OPTIONS,
    TEXT_STYLE_PROPS,
    ELEMENT_STYLE_PROPS,
    normalizeTypographyEntry,
    getTokenStyle,
    getVersionTypography,
    getVersionColors,
    getText,
    getElementStyle,
    clearStyleOverrides,
    styleToCss,
    applyColorVars,
    applyTypographyVars,
    applyToElement,
    applyElementStyleOverrides,
    styleIdForElement,
    applyPageText,
    escapeHtml,
    collectionId,
    defaultContent,
    mergeContent,
  };
})();
