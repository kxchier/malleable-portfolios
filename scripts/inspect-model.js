/** Inspect panel — view underlying Walo / Jelly data models in edit mode. */
window.PortfolioInspect = (() => {
  const TABS = [
    { id: 'content', label: 'Content' },
    { id: 'presentation', label: 'Presentation' },
    { id: 'schema', label: 'Schema' },
    { id: 'theme', label: 'Theme' },
  ];

  function mergeContentForInspect(contentModel, contentOverrides) {
    if (!contentModel) return null;
    const copy = JSON.parse(JSON.stringify(contentModel));
    const text = contentOverrides?.text || {};

    if (text['portfolio.title']?.content != null) {
      copy.portfolio.title = text['portfolio.title'].content;
      if (copy.artist) copy.artist.name = text['portfolio.title'].content;
    }

    copy.collections?.forEach((col, i) => {
      const override = text[`collection.${i}`]?.content;
      if (override != null) col.title = override;
    });

    return copy;
  }

  function formatPrimitive(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
  }

  function renderTree(value, key = null) {
    const row = document.createElement('div');
    row.className = 'inspect-tree-node';

    if (value !== null && typeof value === 'object') {
      const isArray = Array.isArray(value);
      const keys = isArray ? value.map((_, i) => i) : Object.keys(value);
      const empty = keys.length === 0;

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'inspect-tree-head' + (empty ? ' inspect-tree-head--empty' : '');
      head.disabled = empty;

      const marker = document.createElement('span');
      marker.className = 'inspect-tree-marker';
      marker.textContent = empty ? '·' : '▾';

      const label = document.createElement('span');
      label.className = 'inspect-tree-label';
      const typeLabel = isArray ? `Array(${keys.length})` : 'Object';
      label.textContent = key != null ? `${key}: ${typeLabel}` : typeLabel;

      head.append(marker, label);
      row.appendChild(head);

      if (!empty) {
        const body = document.createElement('div');
        body.className = 'inspect-tree-body';
        keys.forEach((k) => {
          body.appendChild(renderTree(value[k], isArray ? null : k));
        });
        row.appendChild(body);

        head.addEventListener('click', () => {
          const collapsed = row.classList.toggle('inspect-tree-node--collapsed');
          marker.textContent = collapsed ? '▸' : '▾';
        });
      }

      return row;
    }

    const leaf = document.createElement('div');
    leaf.className = 'inspect-tree-leaf';
    if (key != null) {
      const k = document.createElement('span');
      k.className = 'inspect-tree-key';
      k.textContent = `${key}: `;
      leaf.appendChild(k);
    }
    const v = document.createElement('span');
    v.className = 'inspect-tree-value';
    v.textContent = formatPrimitive(value);
    leaf.appendChild(v);
    row.appendChild(leaf);
    return row;
  }

  function mount(panel, { getState, onRefresh }) {
    let activeTab = 'content';
    let schemaCache = null;
    let presentationCache = new Map();

    panel.innerHTML = `
      <div class="inspect-panel-head">
        <h2>Inspect model</h2>
        <button type="button" class="inspect-close-btn" aria-label="Close inspect panel">×</button>
      </div>
      <div class="inspect-tabs" role="tablist"></div>
      <div class="inspect-toolbar">
        <button type="button" class="inspect-copy-btn">Copy JSON</button>
        <span class="inspect-meta"></span>
      </div>
      <div class="inspect-body" role="tabpanel"></div>
    `;

    const tabsEl = panel.querySelector('.inspect-tabs');
    const bodyEl = panel.querySelector('.inspect-body');
    const metaEl = panel.querySelector('.inspect-meta');
    const copyBtn = panel.querySelector('.inspect-copy-btn');

    TABS.forEach((tab) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inspect-tab';
      btn.dataset.tab = tab.id;
      btn.textContent = tab.label;
      btn.setAttribute('role', 'tab');
      btn.addEventListener('click', () => {
        activeTab = tab.id;
        render();
      });
      tabsEl.appendChild(btn);
    });

    panel.querySelector('.inspect-close-btn').addEventListener('click', () => {
      panel.dispatchEvent(new CustomEvent('inspect-close'));
    });

    copyBtn.addEventListener('click', async () => {
      const data = await resolveTabData(activeTab);
      if (!data) return;
      const text = JSON.stringify(data, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied ✓';
        setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1500);
      } catch {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1500);
      }
    });

    async function loadSchema() {
      if (schemaCache) return schemaCache;
      try {
        schemaCache = await fetch('./models/schema.json').then((r) => r.json());
      } catch {
        schemaCache = { error: 'Could not load models/schema.json' };
      }
      return schemaCache;
    }

    async function loadPresentation(presentationId) {
      if (presentationCache.has(presentationId)) {
        return presentationCache.get(presentationId);
      }
      try {
        const data = await fetch(`./presentations/${presentationId}.json`).then((r) => r.json());
        presentationCache.set(presentationId, data);
        return data;
      } catch {
        try {
          const data = await fetch(`./generated/${presentationId}/presentation.json`).then((r) => r.json());
          presentationCache.set(presentationId, data);
          return data;
        } catch {
          return { error: `Could not load presentation for ${presentationId}` };
        }
      }
    }

    async function resolveTabData(tabId) {
      const state = getState();
      if (tabId === 'content') {
        return mergeContentForInspect(state.contentModel, state.contentOverrides);
      }
      if (tabId === 'presentation') {
        const id = state.presentationId || 'grid';
        return loadPresentation(id);
      }
      if (tabId === 'schema') return loadSchema();
      if (tabId === 'theme') return state.theme || {};
      return null;
    }

    async function render() {
      tabsEl.querySelectorAll('.inspect-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
      });

      const data = await resolveTabData(activeTab);
      bodyEl.innerHTML = '';

      if (!data) {
        bodyEl.innerHTML = '<p class="inspect-empty">No model data loaded. Start the local server and refresh.</p>';
        metaEl.textContent = '';
        return;
      }

      const tree = renderTree(data);
      tree.classList.add('inspect-tree-root');
      bodyEl.appendChild(tree);

      if (activeTab === 'content' && data.works) {
        metaEl.textContent = `${data.collections?.length || 0} collections · ${data.works.length} works`;
      } else if (activeTab === 'presentation' && data.metaphor) {
        metaEl.textContent = `${data.layout_family || data.id} · ${data.metaphor}`;
      } else if (activeTab === 'schema' && data.task) {
        metaEl.textContent = `task: ${data.task}`;
      } else {
        metaEl.textContent = '';
      }
    }

    async function refresh() {
      presentationCache.delete(getState().presentationId || 'grid');
      await render();
      onRefresh?.();
    }

    render();

    return { refresh, setTab: (id) => { activeTab = id; render(); } };
  }

  return { mount, mergeContentForInspect };
})();
