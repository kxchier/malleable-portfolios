// Load manifest and theme on page init.
//
// When the local editor (scripts/serve.js) is running, we read the manifest LIVE
// from /api/manifest so the page always reflects the current Art/ folder. When
// deployed to GitHub Pages (static, no server) that call 404s and we fall back to
// the committed manifest.json.
async function fetchManifest() {
  try {
    const res = await fetch('/api/manifest');
    if (res.ok) return await res.json();
  } catch (e) {
    // local server not running — fall through to the static file
  }
  return fetch('./manifest.json').then(r => r.json());
}

async function loadData() {
  const [manifest, theme] = await Promise.all([
    fetchManifest(),
    fetch('./theme.json').then(r => r.json())
  ]);

  // Apply theme as CSS variables
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  Object.entries(theme.typography).forEach(([key, value]) => {
    root.style.setProperty(`--font-${key}`, value);
  });
  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--space-${key}`, value);
  });

  return { manifest, theme };
}

// Store in window for access from other scripts
window.appData = loadData();
