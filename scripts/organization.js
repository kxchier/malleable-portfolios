/** Shared controls for choosing how collection folders are shown. */
window.PortfolioOrganization = (() => {
  const STORAGE_KEY = 'portfolio.organizationMode';
  const INDEX_KEY = 'portfolio.organizationIndex';
  const MODES = ['all', 'single', 'flat'];

  function collectionTitle(content, collection, index) {
    if (!window.PortfolioContent) return collection.name;
    return PortfolioContent.getText(content, PortfolioContent.collectionId(index), collection.name);
  }

  function clampIndex(index, manifest) {
    const max = Math.max(0, manifest.collections.length - 1);
    return Math.min(max, Math.max(0, index || 0));
  }

  function getInitialState(manifest) {
    const savedMode = localStorage.getItem(STORAGE_KEY);
    const savedIndex = parseInt(localStorage.getItem(INDEX_KEY), 10);
    return {
      mode: MODES.includes(savedMode) ? savedMode : 'all',
      index: clampIndex(Number.isFinite(savedIndex) ? savedIndex : 0, manifest),
    };
  }

  function visibleCollections(manifest, state) {
    if (state.mode === 'flat') {
      return [{
        id: 'all-artwork',
        originalIndex: null,
        name: 'All artwork',
        images: manifest.collections.flatMap((collection) => collection.images),
      }];
    }

    if (state.mode === 'single') {
      const index = clampIndex(state.index, manifest);
      return [{
        id: PortfolioContent.collectionId(index),
        originalIndex: index,
        ...manifest.collections[index],
      }];
    }

    return manifest.collections.map((collection, index) => ({
      id: PortfolioContent.collectionId(index),
      originalIndex: index,
      ...collection,
    }));
  }

  function createControls({ manifest, content, onChange }) {
    const state = getInitialState(manifest);
    const controls = document.createElement('section');
    controls.className = 'organization-controls';
    controls.innerHTML = `
      <div class="organization-row">
        <span class="organization-label">Browse</span>
        <button type="button" class="organization-btn" data-mode="all">All collections</button>
        <button type="button" class="organization-btn" data-mode="single">Focus one</button>
        <button type="button" class="organization-btn" data-mode="flat">Gallery wall</button>
      </div>
      <div class="organization-row organization-picker-row">
        <button type="button" class="organization-step" data-step="-1" aria-label="Previous folder">‹</button>
        <select class="organization-select" aria-label="Choose folder"></select>
        <button type="button" class="organization-step" data-step="1" aria-label="Next folder">›</button>
      </div>
    `;

    const buttons = [...controls.querySelectorAll('.organization-btn')];
    const select = controls.querySelector('.organization-select');
    const pickerRow = controls.querySelector('.organization-picker-row');

    manifest.collections.forEach((collection, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = collectionTitle(content, collection, index);
      select.appendChild(option);
    });

    function commit() {
      state.index = clampIndex(state.index, manifest);
      localStorage.setItem(STORAGE_KEY, state.mode);
      localStorage.setItem(INDEX_KEY, String(state.index));
      buttons.forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === state.mode);
      });
      select.value = String(state.index);
      pickerRow.hidden = state.mode !== 'single';
      onChange(visibleCollections(manifest, state), state);
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        commit();
      });
    });

    select.addEventListener('change', () => {
      state.index = parseInt(select.value, 10);
      commit();
    });

    controls.querySelectorAll('.organization-step').forEach((button) => {
      button.addEventListener('click', () => {
        const step = parseInt(button.dataset.step, 10);
        const count = manifest.collections.length;
        state.index = (state.index + step + count) % count;
        commit();
      });
    });

    commit();
    return controls;
  }

  return {
    createControls,
    visibleCollections,
  };
})();
