/** Local-only AI provider configuration for the authoring server.
 * This file is loaded only by Node, not by the browser.
 *
 * Put real keys in a local .env file, never in tracked source:
 *   WALO_AI_PROVIDER=anthropic
 *   ANTHROPIC_API_KEY=<your Anthropic key>
 *   OPENAI_API_KEY=<your OpenAI key>
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

loadDotEnv();

const AI_PROVIDER = (process.env.WALO_AI_PROVIDER || 'anthropic').toLowerCase();

const LOCAL_API_KEYS = {
  anthropic: '',
  cerebras: '',
  openai: '',
};

const API_KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY || LOCAL_API_KEYS.anthropic,
  cerebras: process.env.CEREBRAS_API_KEY || LOCAL_API_KEYS.cerebras,
  openai: process.env.OPENAI_API_KEY || LOCAL_API_KEYS.openai,
};

function apiKeyFor(provider) {
  return API_KEYS[provider] || '';
}

module.exports = {
  AI_PROVIDER,
  API_KEYS,
  apiKeyFor,
};
