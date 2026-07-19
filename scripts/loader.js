// Load manifest, theme, content, and Walo models on page init.
//
// When the local editor (scripts/serve.js) is running, we read the content model LIVE
// from /api/content-model so the page always reflects the current Art/ folder. When
// deployed to GitHub Pages (static, no server) that call 404s and we fall back to
// models/content.json or manifest.json.
function canUseLocalPortfolioApi() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
}

async function fetchManifest() {
  if (canUseLocalPortfolioApi()) {
    try {
      const res = await fetch('/api/manifest');
      if (res.ok) return await res.json();
    } catch (e) {
      // local server not running — fall through to the static file
    }
  }
  return fetch('./manifest.json').then((r) => r.json());
}

async function fetchContent(theme) {
  try {
    const file = await fetch('./content.json').then((r) => r.json());
    if (file?.text && Object.keys(file.text).length > 0) return file;
  } catch (e) {
    // fall through
  }
  if (theme?.content?.text) return theme.content;
  return { text: {} };
}

async function fetchContentModel() {
  if (window.PortfolioModels) {
    return PortfolioModels.fetchContentModel();
  }
  if (canUseLocalPortfolioApi()) {
    try {
      const res = await fetch('/api/content-model');
      if (res.ok) return await res.json();
    } catch (e) {
      // fall through
    }
  }
  try {
    return await fetch('./models/content.json').then((r) => r.json());
  } catch (e) {
    return null;
  }
}

function toManifestFromContent(content) {
  const worksById = Object.fromEntries((content.works || []).map((w) => [w.id, w]));
  return {
    collections: (content.collections || []).map((col) => ({
      id: col.id,
      name: col.title,
      images: (col.works || []).flatMap((wid) => worksById[wid]?.images || []),
      workItems: (col.works || []).map((wid) => worksById[wid]).filter(Boolean),
    })),
  };
}

async function loadData() {
  const [themeRaw, contentModel] = await Promise.all([
    fetch('./theme.json').then((r) => r.json()),
    fetchContentModel(),
  ]);
  let themeSource = themeRaw;

  let manifest;
  let contentModelResolved = contentModel;

  if (contentModelResolved) {
    manifest = toManifestFromContent(contentModelResolved);
  } else {
    manifest = await fetchManifest();
    if (window.PortfolioModels) {
      contentModelResolved = PortfolioModels.manifestToContentStub?.(manifest)
        || null;
    }
  }

  let rawContent = await fetchContent(themeRaw);
  const participantId = window.PortfolioSupabase?.participantIdFromLocation?.() || '';
  if (participantId && window.PortfolioSupabase?.isConfigured?.()) {
    const remote = await window.PortfolioSupabase.loadPortfolio(participantId);
    if (remote?.theme_json) themeSource = remote.theme_json;
    if (remote?.content_json) rawContent = remote.content_json;
    if (remote) document.documentElement.dataset.participantId = participantId;
  }

  const theme = { ...themeSource };
  delete theme.content;

  const content = window.PortfolioContent
    ? PortfolioContent.mergeContent(rawContent, manifest)
    : rawContent;

  // Apply theme as CSS variables
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  if (window.PortfolioContent) {
    PortfolioContent.applyTypographyVars(theme, root);
  } else {
    Object.entries(theme.typography).forEach(([key, value]) => {
      const size = typeof value === 'string' ? value : value.fontSize;
      root.style.setProperty(`--font-${key}`, size);
    });
  }
  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--space-${key}`, value);
  });

  return { manifest, theme, content, contentModel: contentModelResolved };
}

// Store in window for access from other scripts
window.appData = loadData();
