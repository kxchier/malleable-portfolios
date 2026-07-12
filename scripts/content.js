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
    'Cooper Black',
    'Arial Rounded MT Bold',
    'Comic Sans MS',
    'Chalkboard SE',
    'Marker Felt',
    'Bradley Hand',
    'American Typewriter',
    'Avenir Next Condensed',
    'DIN Alternate',
    'Arial Narrow',
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
    'gap',
    'height',
    'margin',
    'marginBottom',
    'marginLeft',
    'marginRight',
    'marginTop',
    'maxHeight',
    'maxWidth',
    'objectFit',
    'objectPosition',
    'opacity',
    'outline',
    'overflow',
    'padding',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'rowGap',
    'columnGap',
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

  function getArrangementTitleForText(content, id, versionKey) {
    if (!versionKey || !String(id || '').startsWith('collection.')) return null;
    const match = getArrangement(content, versionKey).collections
      .find((collection) => collection.id === id);
    return match?.title || null;
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

  function applyTextAlignmentLayout(el, align) {
    const normalized = ['left', 'center', 'right'].includes(align) ? align : '';
    const titleRow = el.closest('.portfolio-title-row');

    el.style.marginLeft = '';
    el.style.marginRight = '';
    el.style.alignSelf = '';

    if (titleRow) {
      titleRow.style.width = '';
      titleRow.style.justifyContent = '';
    }

    if (!normalized) return;

    if (normalized === 'center') {
      el.style.marginLeft = 'auto';
      el.style.marginRight = 'auto';
      el.style.alignSelf = 'center';
    } else if (normalized === 'right') {
      el.style.marginLeft = 'auto';
      el.style.marginRight = '0';
      el.style.alignSelf = 'flex-end';
    } else {
      el.style.marginLeft = '0';
      el.style.marginRight = 'auto';
      el.style.alignSelf = 'flex-start';
    }

    if (titleRow) {
      titleRow.style.width = '100%';
      titleRow.style.justifyContent = normalized === 'center'
        ? 'center'
        : normalized === 'right'
          ? 'flex-end'
          : 'flex-start';
    }
  }

  function applyToElement(el, theme, content, versionKey) {
    const id = el.dataset.textId;
    const role = el.dataset.textRole;
    if (!id || !role) return;
    const fallback = el.dataset.textFallback || el.textContent;
    const text = getArrangementTitleForText(content, id, versionKey) || getText(content, id, fallback);
    el.textContent = text;
    el.hidden = false;
    const style = getElementStyle(theme, content, id, role, versionKey);
    TEXT_STYLE_PROPS.forEach((prop) => {
      el.style[prop] = style[prop] || '';
    });
    applyTextAlignmentLayout(el, style.textAlign);
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

  function parseSpacingParts(value) {
    if (typeof value !== 'string') return null;
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (!parts.length || parts.length > 4) return null;
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }

  function normalizeCollectionSpacingPatch(patch = {}) {
    const normalized = { ...patch };
    const paddingParts = parseSpacingParts(normalized.padding);
    if (paddingParts) {
      if (normalized.paddingTop == null && paddingParts.top !== '0') normalized.paddingTop = paddingParts.top;
      if (normalized.paddingRight == null) normalized.paddingRight = paddingParts.right;
      if (normalized.paddingBottom == null && paddingParts.bottom !== '0') normalized.paddingBottom = paddingParts.bottom;
      if (normalized.paddingLeft == null) normalized.paddingLeft = paddingParts.left;
      delete normalized.padding;
    }

    const marginParts = parseSpacingParts(normalized.margin);
    if (marginParts) {
      if (normalized.marginTop == null && marginParts.top !== '0') normalized.marginTop = marginParts.top;
      if (normalized.marginBottom == null && marginParts.bottom !== '0') normalized.marginBottom = marginParts.bottom;
      if (normalized.marginLeft == null) normalized.marginLeft = marginParts.left;
      if (normalized.marginRight == null) normalized.marginRight = marginParts.right;
      delete normalized.margin;
    }

    return normalized;
  }

  function applySectionSpacingPatch(el, patch = {}) {
    if (!el || !patch || el.dataset.modelKind !== 'collection') return;

    const hasSectionPadding = ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
      .some((prop) => patch[prop] != null);
    if (hasSectionPadding) el.style.boxSizing = 'border-box';

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

    const allCollectionStyle = versionStyles.__all_collection__;
    if (allCollectionStyle) {
      root.querySelectorAll('[data-model-kind="collection"]').forEach((el) => {
        const patch = normalizeCollectionSpacingPatch(allCollectionStyle.patch || {});
        applyStylePatchToElement(el, patch);
        applySectionSpacingPatch(el, patch);
        if (Object.keys(allCollectionStyle.imagePatch || {}).length) {
          const imageTargets = el.matches('img') ? [el] : Array.from(el.querySelectorAll('img'));
          imageTargets.forEach((img) => applyStylePatchToElement(img, allCollectionStyle.imagePatch));
        }
      });
    }

    root.querySelectorAll('[data-model-path], [data-text-id]').forEach((el) => {
      const id = styleIdForElement(el);
      if (!id) return;
      const style = mergedElementStyle(content, versionKey, id);
      const patch = el.dataset.modelKind === 'collection'
        ? normalizeCollectionSpacingPatch(style.patch)
        : style.patch;
      applyStylePatchToElement(el, patch);
      applySectionSpacingPatch(el, patch);
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

  function workId(collectionIndex, workIndex) {
    return `work_${collectionIndex}_${workIndex}`;
  }

  function sourceCollectionIndex(collectionIdValue) {
    const match = String(collectionIdValue || '').match(/^collection\.(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function imageBasename(imgPath) {
    const name = String(imgPath || '').split('/').pop() || 'untitled';
    return name.replace(/\.[^.]+$/, '');
  }

  function manifestWorkIndex(manifest) {
    const works = new Map();
    (manifest?.collections || []).forEach((collection, collectionIndex) => {
      (collection.images || []).forEach((image, workIndex) => {
        const sourceWork = collection.workItems?.[workIndex] || {};
        const id = sourceWork.id || workId(collectionIndex, workIndex);
        works.set(id, {
          ...sourceWork,
          id,
          title: sourceWork.title || imageBasename(image),
          image,
          images: sourceWork.images || [image],
          sourceCollectionId: sourceWork.sourceCollectionId || collection.id || collectionId(collectionIndex),
          sourceCollectionIndex: sourceWork.sourceCollectionIndex ?? collection.originalIndex ?? collectionIndex,
          sourceWorkIndex: sourceWork.sourceWorkIndex ?? workIndex,
        });
      });
    });
    return works;
  }

  function defaultArrangement(manifest) {
    return {
      collections: (manifest?.collections || []).map((collection, collectionIndex) => ({
        id: collectionId(collectionIndex),
        title: collection.name,
        works: (collection.images || []).map((_, workIndex) => workId(collectionIndex, workIndex)),
      })),
    };
  }

  function getArrangement(content, versionKey, manifest = null) {
    const arrangement = content?.arrangements?.[versionKey];
    if (arrangement?.collections && Array.isArray(arrangement.collections)) return arrangement;
    return manifest ? defaultArrangement(manifest) : { collections: [] };
  }

  function normalizeArrangement(content, versionKey, manifest) {
    const works = manifestWorkIndex(manifest);
    const arrangement = getArrangement(content, versionKey, manifest);
    const usedWorks = new Set();
    const collections = [];

    (arrangement.collections || []).forEach((collection, index) => {
      const id = String(collection.id || `custom.${versionKey}.${index}`).slice(0, 80);
      const originalIndex = sourceCollectionIndex(id);
      const fallbackTitle = originalIndex != null
        ? manifest?.collections?.[originalIndex]?.name
        : 'Untitled collection';
      const workIds = (Array.isArray(collection.works) ? collection.works : [])
        .map((wid) => String(wid || ''))
        .filter((wid) => works.has(wid) && !usedWorks.has(wid));
      workIds.forEach((wid) => usedWorks.add(wid));
      collections.push({
        id,
        title: String(collection.title || fallbackTitle || 'Untitled collection').slice(0, 120),
        works: workIds,
      });
    });

    (manifest?.collections || []).forEach((sourceCollection, collectionIndex) => {
      const missingWorks = (sourceCollection.images || [])
        .map((_, workIndex) => workId(collectionIndex, workIndex))
        .filter((wid) => !usedWorks.has(wid));
      if (!missingWorks.length) return;
      const id = collectionId(collectionIndex);
      const existing = collections.find((collection) => collection.id === id);
      if (existing) {
        existing.works.push(...missingWorks);
      } else {
        collections.push({
          id,
          title: sourceCollection.name,
          works: missingWorks,
        });
      }
      missingWorks.forEach((wid) => usedWorks.add(wid));
    });

    return { collections };
  }

  function applyArrangementToManifest(manifest, content, versionKey) {
    const works = manifestWorkIndex(manifest);
    const arrangement = normalizeArrangement(content, versionKey, manifest);
    return {
      collections: arrangement.collections.map((collection) => {
        const originalIndex = sourceCollectionIndex(collection.id);
        const workItems = collection.works
          .map((wid) => works.get(wid))
          .filter(Boolean);
        return {
          id: collection.id,
          name: collection.title,
          images: workItems.map((work) => work.image),
          workItems,
          originalIndex,
          arrangementCollectionId: collection.id,
        };
      }).filter((collection) => collection.images.length || !collection.id.startsWith('collection.')),
    };
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
    workId,
    manifestWorkIndex,
    defaultArrangement,
    getArrangement,
    normalizeArrangement,
    applyArrangementToManifest,
    defaultContent,
    mergeContent,
  };
})();

window.PortfolioSocialPrototype = (() => {
  const MODES = ['none', 'likes', 'comments', 'likes-comments', 'notes', 'all'];
  const SAMPLE_COMMENTS = ['i love this!', 'so pretty :0', 'woah :3'];

  const PAGE_NOTES = [
    { x: 8, y: 16, text: 'Prototype: visitors could leave a note here.' },
    { x: 72, y: 24, text: 'Artist-facing demo: likes and comments are not saved.' },
    { x: 58, y: 76, text: 'Notes could become critique, guestbook, or commission interest.' },
  ];

  function hash(value) {
    return String(value || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  }

  function countFor(workId) {
    return 3 + (hash(workId) % 28);
  }

  function commentsFor(label, workId) {
    return [{
      author: 'Visitor',
      body: SAMPLE_COMMENTS[hash(workId || label) % SAMPLE_COMMENTS.length],
    }];
  }

  function removeExisting(root) {
    root.querySelectorAll('.social-prototype-actions, .social-prototype-panel, .social-prototype-notes').forEach((el) => el.remove());
    root.querySelectorAll('.has-social-prototype').forEach((el) => el.classList.remove('has-social-prototype'));
    delete root.dataset.socialPrototype;
  }

  function normalizeMode(mode) {
    return MODES.includes(mode) ? mode : 'none';
  }

  function modeAllows(mode, feature) {
    if (mode === 'all') return true;
    if (feature === 'likes') return mode === 'likes' || mode === 'likes-comments';
    if (feature === 'comments') return mode === 'comments' || mode === 'likes-comments';
    if (feature === 'notes') return mode === 'notes';
    return false;
  }

  function closePanels(root) {
    root.querySelectorAll('.social-prototype-panel').forEach((panel) => panel.remove());
  }

  function openPanel(root, tile, workId, label) {
    closePanels(root);
    const panel = document.createElement('aside');
    panel.className = 'social-prototype-panel';
    panel.setAttribute('aria-label', 'Prototype comments');

    const title = document.createElement('div');
    title.className = 'social-prototype-panel-title';
    title.textContent = label || 'Artwork feedback';

    const badge = document.createElement('span');
    badge.className = 'social-prototype-badge';
    badge.textContent = 'Prototype only';

    const list = document.createElement('div');
    list.className = 'social-prototype-comments';
    commentsFor(label, workId).forEach((comment) => {
      const item = document.createElement('p');
      item.className = 'social-prototype-comment';
      item.innerHTML = `<strong>${PortfolioContent.escapeHtml(comment.author)}</strong> ${PortfolioContent.escapeHtml(comment.body)}`;
      list.appendChild(item);
    });

    const form = document.createElement('form');
    form.className = 'social-prototype-form';
    form.innerHTML = `
      <input type="text" placeholder="Leave a sample note" aria-label="Sample note">
      <button type="submit">Add</button>
    `;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      const body = String(input?.value || '').trim();
      if (!body) return;
      const item = document.createElement('p');
      item.className = 'social-prototype-comment';
      item.innerHTML = `<strong>You</strong> ${PortfolioContent.escapeHtml(body)}`;
      list.appendChild(item);
      input.value = '';
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'social-prototype-close';
    close.setAttribute('aria-label', 'Close prototype comments');
    close.textContent = '×';
    close.addEventListener('click', () => panel.remove());

    panel.append(close, title, badge, list, form);
    tile.appendChild(panel);
  }

  function mountWorkControls(root, mode) {
    const tiles = Array.from(root.querySelectorAll('[data-model-kind="work"]'))
      .filter((tile) => tile.querySelector('img') && !tile.closest('.directory-tree'));
    const showLikes = modeAllows(mode, 'likes');
    const showComments = modeAllows(mode, 'comments');
    if (!showLikes && !showComments) return;

    tiles.forEach((tile) => {
      if (tile.querySelector('.social-prototype-actions')) return;
      const workId = tile.dataset.workId || `${tile.dataset.collectionIndex || 0}_${tile.dataset.workIndex || 0}`;
      const label = tile.dataset.modelLabel || 'Artwork';
      tile.classList.add('has-social-prototype');

      const actions = document.createElement('div');
      actions.className = 'social-prototype-actions';

      if (showLikes) {
        const like = document.createElement('button');
        like.type = 'button';
        like.className = 'social-prototype-like';
        like.setAttribute('aria-pressed', 'false');
        like.innerHTML = `<span aria-hidden="true">♡</span><span>${countFor(workId)}</span>`;
        like.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const pressed = like.getAttribute('aria-pressed') === 'true';
          like.setAttribute('aria-pressed', pressed ? 'false' : 'true');
          like.firstElementChild.textContent = pressed ? '♡' : '♥';
          like.lastElementChild.textContent = String(countFor(workId) + (pressed ? 0 : 1));
        });
        actions.appendChild(like);
      }

      if (showComments) {
        const comments = document.createElement('button');
        comments.type = 'button';
        comments.className = 'social-prototype-comment-btn';
        comments.textContent = 'Notes';
        comments.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openPanel(root, tile, workId, label);
        });
        actions.appendChild(comments);
      }

      tile.appendChild(actions);
    });
  }

  function mountPageNotes(root, presentationId) {
    if (root.querySelector('.social-prototype-notes')) return;
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    const notes = document.createElement('div');
    notes.className = 'social-prototype-notes';
    notes.setAttribute('aria-label', 'Prototype page notes');

    PAGE_NOTES.forEach((note, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'social-prototype-note';
      item.style.setProperty('--note-x', `${note.x}%`);
      item.style.setProperty('--note-y', `${note.y}%`);
      item.style.setProperty('--note-tilt', `${index % 2 === 0 ? -2 : 2}deg`);
      item.textContent = note.text;
      item.title = 'Prototype page note';
      notes.appendChild(item);
    });

    root.appendChild(notes);
    root.dataset.socialPrototype = presentationId || 'enabled';
  }

  function mount(root, options = {}) {
    if (!root || options.enabled === false) return;
    const mode = normalizeMode(options.mode);
    removeExisting(root);
    if (mode === 'none') return;
    mountWorkControls(root, mode);
    if (modeAllows(mode, 'notes')) mountPageNotes(root, options.presentationId);
    root.dataset.socialPrototype = mode;
  }

  return { mount };
})();
