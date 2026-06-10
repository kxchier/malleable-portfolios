/** Text content overrides and typography helpers (shared by views + editor). */
window.PortfolioContent = (() => {
  const ROLE_TOKENS = {
    'portfolio.title': 'heading1',
    'collection.title': 'heading2',
  };

  const DEFAULT_TYPO = {
    heading1: { fontFamily: 'Trebuchet MS', fontSize: '2.5rem', fontWeight: '800' },
    heading2: { fontFamily: 'Trebuchet MS', fontSize: '1.5rem', fontWeight: '800' },
    body: { fontFamily: 'Trebuchet MS', fontSize: '1rem', fontWeight: '400' },
  };

  const FONT_OPTIONS = [
    'Trebuchet MS',
    'Georgia',
    'Arial',
    'Courier New',
    'Times New Roman',
    'system-ui',
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
    return {
      fontFamily: versionStyle.fontFamily ?? override.fontFamily,
      fontSize: versionStyle.fontSize ?? override.fontSize,
      fontWeight: versionStyle.fontWeight ?? override.fontWeight,
    };
  }

  function getElementStyle(theme, content, id, role, versionKey) {
    const token = ROLE_TOKENS[role] || 'body';
    const base = versionKey ? getVersionTypography(theme, versionKey, token) : getTokenStyle(theme, token);
    const textStyle = versionKey ? getVersionTextStyle(content, id, versionKey) : getTextOverride(content, id);
    return {
      fontFamily: textStyle.fontFamily || base.fontFamily,
      fontSize: textStyle.fontSize || base.fontSize,
      fontWeight: textStyle.fontWeight || base.fontWeight,
    };
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
    const hasLegacyStyle = entry.fontFamily || entry.fontSize || entry.fontWeight;
    const hasVersionStyle = entry.versions && Object.values(entry.versions).some(
      (v) => v && (v.fontFamily || v.fontSize || v.fontWeight)
    );
    if (!hasContent && !hasLegacyStyle && !hasVersionStyle) delete content.text[id];
    if (entry.versions) {
      Object.keys(entry.versions).forEach((vk) => {
        const v = entry.versions[vk];
        if (v && !v.fontFamily && !v.fontSize && !v.fontWeight) delete entry.versions[vk];
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
    return `font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight}`;
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
    el.style.fontFamily = style.fontFamily;
    el.style.fontSize = style.fontSize;
    el.style.fontWeight = style.fontWeight;
  }

  function applyPageText(manifest, theme, content, versionKey, root = document) {
    applyTypographyVars(theme, versionKey, root.documentElement);

    root.querySelectorAll('[data-text-id]').forEach((el) => {
      applyToElement(el, theme, content, versionKey);
    });

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
    return { text };
  }

  return {
    ROLE_TOKENS,
    FONT_OPTIONS,
    normalizeTypographyEntry,
    getTokenStyle,
    getVersionTypography,
    getText,
    getElementStyle,
    clearStyleOverrides,
    styleToCss,
    applyTypographyVars,
    applyToElement,
    applyPageText,
    escapeHtml,
    collectionId,
    defaultContent,
    mergeContent,
  };
})();
