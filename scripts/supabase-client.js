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

  function normalizeParticipantId(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  function participantIdFromLocation() {
    const params = new URLSearchParams(window.location.search);
    return normalizeParticipantId(params.get('participant') || '');
  }

  function setParticipantIdInUrl(participantId) {
    const normalized = normalizeParticipantId(participantId);
    const url = new URL(window.location.href);
    if (normalized) url.searchParams.set('participant', normalized);
    else url.searchParams.delete('participant');
    window.history.replaceState({}, '', url);
    return normalized;
  }

  function artSourceFromLocation() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('art') === 'example') return 'example';
    return participantIdFromLocation() ? 'participant' : 'example';
  }

  function setArtSourceInUrl(source) {
    const url = new URL(window.location.href);
    const normalized = source === 'participant' && participantIdFromLocation()
      ? 'participant'
      : 'example';
    url.searchParams.set('art', normalized);
    window.history.replaceState({}, '', url);
    return normalized;
  }

  function portfolioApiUrl(pathname) {
    const params = new URLSearchParams();
    params.set('art', artSourceFromLocation());
    const participantId = participantIdFromLocation();
    if (participantId) params.set('participant', participantId);
    return `${pathname}?${params.toString()}`;
  }

  function staticContentModelUrl() {
    const participantId = participantIdFromLocation();
    if (artSourceFromLocation() === 'participant' && participantId) {
      return `./models/participants/${encodeURIComponent(participantId)}.json`;
    }
    return './models/content.json';
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

  async function invoke(functionName, body) {
    const sb = client();
    if (!sb) throw new Error('Supabase is not configured.');
    await ensureUser();
    const { data, error } = await sb.functions.invoke(functionName, { body });
    if (error) {
      let message = error.message || `Could not call ${functionName}.`;
      try {
        const details = await error.context?.json?.();
        if (details?.error) message = details.error;
      } catch {
        // Keep the SDK message when the response body is not JSON.
      }
      throw new Error(message);
    }
    return data;
  }

  async function signOut() {
    const sb = client();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function loadPortfolio(participantId) {
    const sb = client();
    const normalized = normalizeParticipantId(participantId);
    if (!sb || !normalized) return null;
    const { data, error } = await sb
      .from('portfolios')
      .select('participant_id, theme_json, content_json, updated_at')
      .eq('participant_id', normalized)
      .maybeSingle();
    if (error) {
      console.warn('[supabase] load failed:', error.message);
      return null;
    }
    return data || null;
  }

  async function savePortfolio(participantId, theme, content) {
    const sb = client();
    const normalized = normalizeParticipantId(participantId);
    if (!sb) throw new Error('Supabase is not configured.');
    if (!normalized) throw new Error('Enter your participant ID before saving.');
    const currentUser = await ensureUser();
    if (!currentUser) throw new Error('Could not create a Supabase session.');

    const row = {
      user_id: currentUser.id,
      participant_id: normalized,
      theme_json: theme,
      content_json: content,
      updated_at: new Date().toISOString(),
    };

    const updates = {
      theme_json: theme,
      content_json: content,
      updated_at: row.updated_at,
    };
    const { data: existing, error: updateError } = await sb
      .from('portfolios')
      .update(updates)
      .eq('participant_id', normalized)
      .select('participant_id')
      .maybeSingle();
    if (updateError) throw updateError;

    if (!existing) {
      const { error: insertError } = await sb.from('portfolios').insert(row);
      if (insertError) throw insertError;
    }
    setParticipantIdInUrl(normalized);
    return row;
  }

  return {
    client,
    artSourceFromLocation,
    isConfigured,
    invoke,
    loadPortfolio,
    normalizeParticipantId,
    participantIdFromLocation,
    portfolioApiUrl,
    savePortfolio,
    session,
    setParticipantIdInUrl,
    setArtSourceInUrl,
    signInAnonymously,
    signOut,
    staticContentModelUrl,
    user,
  };
})();
