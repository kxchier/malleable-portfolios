/** Shared model-provider client for Walo AI calls. */
const { AI_PROVIDER, apiKeyFor } = require('./ai-config.js');
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULTS = {
  cerebras: process.env.CEREBRAS_MODEL || 'zai-glm-4.7',
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
};

function normalizeProvider(provider) {
  const value = String(provider || AI_PROVIDER || 'anthropic').toLowerCase();
  return value === 'anthropic' ? 'anthropic' : 'cerebras';
}

function providerLabel(provider) {
  return normalizeProvider(provider) === 'anthropic' ? 'Anthropic' : 'Cerebras';
}

function extractProviderText(provider, data) {
  if (normalizeProvider(provider) === 'anthropic') {
    return (data?.content || [])
      .map((part) => {
        if (typeof part === 'string') return part;
        return part?.text || '';
      })
      .join('\n');
  }

  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};
  const content = message.content ?? choice.text ?? data?.output_text;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || part?.content || '')).join('\n');
  }
  return '';
}

function stopReason(provider, data) {
  if (normalizeProvider(provider) === 'anthropic') return data?.stop_reason || 'unknown';
  return data?.choices?.[0]?.finish_reason || data?.choices?.[0]?.finishReason || 'unknown';
}

async function callCerebras({ apiKey, system, user, maxTokens, temperature, responseFormat }) {
  const body = {
    model: DEFAULTS.cerebras,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (temperature != null) body.temperature = temperature;
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(CEREBRAS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new Error(`Cerebras API error (${res.status}): ${msg}`);
  }
  return { data, text: extractProviderText('cerebras', data), stopReason: stopReason('cerebras', data) };
}

async function callAnthropic({ apiKey, system, user, maxTokens }) {
  const body = {
    model: DEFAULTS.anthropic,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new Error(`Anthropic API error (${res.status}): ${msg}`);
  }
  return { data, text: extractProviderText('anthropic', data), stopReason: stopReason('anthropic', data) };
}

async function callTextModel(options) {
  const provider = normalizeProvider(options.provider);
  const apiKey = options.apiKey || apiKeyFor(provider);
  if (!apiKey) throw new Error(`missing ${providerLabel(provider)} API key in scripts/ai-config.js or environment`);
  const resolved = { ...options, provider, apiKey };
  if (provider === 'anthropic') return callAnthropic(resolved);
  return callCerebras(resolved);
}

module.exports = {
  callTextModel,
  normalizeProvider,
  providerLabel,
};
