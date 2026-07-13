window.PortfolioSupabase = (() => {
  function config() {
    return window.PORTFOLIO_SUPABASE || {};
  }

  function isConfigured() {
    const cfg = config();
    return Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  }

  let cachedClient = null;
  function client() {
    if (!isConfigured()) return null;
    if (!cachedClient) {
      const cfg = config();
      cachedClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    }
    return cachedClient;
  }

  function normalizeUsername(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  function usernameFromLocation() {
    const params = new URLSearchParams(window.location.search);
    return normalizeUsername(params.get('user') || params.get('username') || '');
  }

  function setUsernameInUrl(username) {
    const normalized = normalizeUsername(username);
    const url = new URL(window.location.href);
    if (normalized) url.searchParams.set('user', normalized);
    else url.searchParams.delete('user');
    window.history.replaceState({}, '', url);
    return normalized;
  }

  async function session() {
    const sb = client();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  }

  async function user() {
    const current = await session();
    return current?.user || null;
  }

  async function signInAnonymously() {
    const sb = client();
    if (!sb) throw new Error('Supabase is not configured.');
    const existing = await user();
    if (existing) return existing;
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    return data?.user || null;
  }

  async function ensureUser() {
    const existing = await user();
    if (existing) return existing;
    return signInAnonymously();
  }

  async function signOut() {
    const sb = client();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function loadPortfolio(username) {
    const sb = client();
    const normalized = normalizeUsername(username);
    if (!sb || !normalized) return null;
    const { data, error } = await sb
      .from('portfolios')
      .select('username, theme_json, content_json, updated_at')
      .eq('username', normalized)
      .maybeSingle();
    if (error) {
      console.warn('[supabase] load failed:', error.message);
      return null;
    }
    return data || null;
  }

  async function savePortfolio(username, theme, content) {
    const sb = client();
    const normalized = normalizeUsername(username);
    if (!sb) throw new Error('Supabase is not configured.');
    if (!normalized) throw new Error('Choose a username before saving to Supabase.');
    const currentUser = await ensureUser();
    if (!currentUser) throw new Error('Could not create a Supabase session.');

    const row = {
      user_id: currentUser.id,
      username: normalized,
      theme_json: theme,
      content_json: content,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from('portfolios')
      .upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    setUsernameInUrl(normalized);
    return row;
  }

  return {
    client,
    isConfigured,
    loadPortfolio,
    normalizeUsername,
    savePortfolio,
    session,
    setUsernameInUrl,
    signInAnonymously,
    signOut,
    user,
    usernameFromLocation,
  };
})();
