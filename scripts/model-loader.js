/** Load Walo schema, content model, presentation spec, and theme. */
window.PortfolioModels = (() => {
  function canUseLocalPortfolioApi() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
  }

  function toManifestView(content) {
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

  async function fetchContentModel() {
    if (canUseLocalPortfolioApi()) {
      try {
        const url = window.PortfolioSupabase?.portfolioApiUrl?.('/api/content-model') || '/api/content-model';
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (e) {
        // local server not running
      }
    }
    try {
      const url = window.PortfolioSupabase?.staticContentModelUrl?.() || './models/content.json';
      return await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`content model unavailable (${r.status})`);
        return r.json();
      });
    } catch (e) {
      return null;
    }
  }

  async function fetchContentOverrides(theme) {
    try {
      const file = await fetch('./content.json').then((r) => r.json());
      if (file?.text && Object.keys(file.text).length > 0) return file;
    } catch (e) {
      // fall through
    }
    if (theme?.content?.text) return theme.content;
    return { text: {} };
  }

  async function fetchPresentation(presentationId) {
    try {
      const res = await fetch(`./presentations/${presentationId}.json`);
      if (res.ok) return await res.json();
    } catch (e) {
      // fall through
    }
    return fetch(`./generated/${presentationId}/presentation.json`).then((r) => r.json());
  }

  async function load(presentationId, options = {}) {
    const [contentModel, presentation, themeRaw, schema] = await Promise.all([
      options.contentModel ? Promise.resolve(options.contentModel) : fetchContentModel(),
      options.presentation ? Promise.resolve(options.presentation) : fetchPresentation(presentationId),
      options.theme
        ? Promise.resolve(options.theme)
        : fetch('./theme.json').then((r) => r.json()),
      Object.prototype.hasOwnProperty.call(options, 'schema')
        ? Promise.resolve(options.schema)
        : fetch('./models/schema.json').then((r) => r.json()).catch(() => null),
    ]);

    let manifest;
    let content = contentModel;

    if (!content) {
      manifest = await fetchManifestLegacy();
      content = manifestToContentStub(manifest);
    } else {
      manifest = toManifestView(content);
    }

    const rawContentOverrides = options.contentOverrides || (await fetchContentOverrides(themeRaw));
    const theme = { ...(options.theme || themeRaw) };
    delete theme.content;

    const contentOverrides = window.PortfolioContent
      ? PortfolioContent.mergeContent(rawContentOverrides, manifest)
      : rawContentOverrides;

    if (window.PortfolioContent && presentationId) {
      manifest = PortfolioContent.applyArrangementToManifest(manifest, contentOverrides, presentationId);
    }

    return {
      schema,
      content,
      presentation,
      theme,
      manifest,
      contentOverrides,
    };
  }

  async function fetchManifestLegacy() {
    if (canUseLocalPortfolioApi()) {
      try {
        const url = window.PortfolioSupabase?.portfolioApiUrl?.('/api/manifest') || '/api/manifest';
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (e) {
        // fall through
      }
    }
    return fetch('./manifest.json').then((r) => r.json());
  }

  function manifestToContentStub(manifest) {
    const works = [];
    const collections = (manifest.collections || []).map((col, colIndex) => {
      const workIds = (col.images || []).map((imagePath, workIndex) => {
        const sourceWork = col.workItems?.[workIndex] || {};
        const workId = sourceWork.id || `work_${colIndex}_${workIndex}`;
        works.push({
          id: workId,
          title: sourceWork.title || imagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || workId,
          images: [imagePath],
          ...(sourceWork.description ? { description: sourceWork.description } : {}),
          ...(sourceWork.medium ? { medium: sourceWork.medium } : {}),
          ...(sourceWork.year ? { year: sourceWork.year } : {}),
          ...(sourceWork.link ? { link: sourceWork.link } : {}),
          ...(sourceWork.tags ? { tags: sourceWork.tags } : {}),
        });
        return workId;
      });
      return {
        id: `collection_${colIndex}`,
        title: col.name,
        works: workIds,
      };
    });
    return {
      portfolio: { id: 'portfolio_1', title: 'My Art Portfolio', artist: 'artist_1' },
      artist: { id: 'artist_1', name: 'My Art Portfolio' },
      collections,
      works,
    };
  }

  return {
    load,
    toManifestView,
    fetchContentModel,
    fetchManifestLegacy,
    manifestToContentStub,
  };
})();
