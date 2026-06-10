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

  function getTextOverride(content, id) {
    return content?.text?.[id] || {};
  }

  function getText(content, id, fallback) {
    const override = getTextOverride(content, id);
    if (override.content != null && String(override.content).trim() !== '') {
      return override.content;
    }
    return fallback;
  }

  function getElementStyle(theme, content, id, role) {
    const token = ROLE_TOKENS[role] || 'body';
    const base = getTokenStyle(theme, token);
    const override = getTextOverride(content, id);
    return {
      fontFamily: override.fontFamily || base.fontFamily,
      fontSize: override.fontSize || base.fontSize,
      fontWeight: override.fontWeight || base.fontWeight,
    };
  }

  /** IDs whose per-element style overrides should be cleared for a scoped edit. */
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
    const hasContent = entry.content != null && String(entry.content).trim() !== '';
    const hasStyle = entry.fontFamily || entry.fontSize || entry.fontWeight;
    if (!hasContent && !hasStyle) delete content.text[id];
  }

  /** Remove per-id style so theme tokens take effect for role / all-headings scope. */
  function clearStyleOverrides(content, scope, role, property) {
    if (scope === 'this' || property === 'content') return;
    if (!content.text) content.text = {};
    idsForStyleScope(content, scope, role).forEach((id) => {
      if (!content.text[id]) return;
      delete content.text[id][property];
      pruneTextEntry(content, id);
    });
  }

  function styleToCss(style) {
    return `font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight}`;
  }

  function applyTypographyVars(theme, root = document.documentElement) {
    Object.keys(DEFAULT_TYPO).forEach((token) => {
      const s = getTokenStyle(theme, token);
      root.style.setProperty(`--font-${token}`, s.fontSize);
      root.style.setProperty(`--font-${token}-family`, s.fontFamily);
      root.style.setProperty(`--font-${token}-weight`, s.fontWeight);
    });
  }

  function applyToElement(el, theme, content) {
    const id = el.dataset.textId;
    const role = el.dataset.textRole;
    if (!id || !role) return;
    const fallback = el.dataset.textFallback || el.textContent;
    el.textContent = getText(content, id, fallback);
    const style = getElementStyle(theme, content, id, role);
    el.style.fontFamily = style.fontFamily;
    el.style.fontSize = style.fontSize;
    el.style.fontWeight = style.fontWeight;
  }

  function applyPageText(manifest, theme, content, root = document) {
    applyTypographyVars(theme, root.documentElement);

    root.querySelectorAll('[data-text-id]').forEach((el) => {
      applyToElement(el, theme, content);
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
