import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const envFile = path.join(rootDir, '.env.local');

try {
  process.loadEnvFile(envFile);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const secretFields = {
  telegram: {
    botToken: 'TELEGRAM_BOT_TOKEN',
    webhookSecret: 'TELEGRAM_WEBHOOK_SECRET'
  },
  bitrix: {
    webhookUrl: 'BITRIX_WEBHOOK_URL'
  },
  ai: {
    apiKey: 'OPENAI_API_KEY'
  }
};

export function getRootDir() {
  return rootDir;
}

export function withRuntimeSecrets(integrations = {}) {
  const merged = structuredClone(integrations);

  for (const [group, fields] of Object.entries(secretFields)) {
    merged[group] = { ...(merged[group] || {}) };
    for (const [field, envName] of Object.entries(fields)) {
      merged[group][field] = process.env[envName] || '';
    }
  }

  return merged;
}

export function stripIntegrationSecrets(integrations = {}) {
  const stripped = structuredClone(integrations);

  for (const [group, fields] of Object.entries(secretFields)) {
    if (!stripped[group]) continue;
    for (const field of Object.keys(fields)) delete stripped[group][field];
  }

  return stripped;
}

export function redactSensitiveText(value) {
  return String(value)
    .replace(/\/file\/bot[^/\s?]+/gi, '/file/bot[REDACTED]')
    .replace(/\/bot[^/\s?]+/gi, '/bot[REDACTED]')
    .replace(/\b\d{6,}:[a-zA-Z0-9_-]{20,}\b/g, '[REDACTED_TELEGRAM_TOKEN]')
    .replace(/\bsk-[a-zA-Z0-9:_-]{12,}\b/g, '[REDACTED_API_KEY]');
}

export function redactSensitiveValue(value) {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactSensitiveValue(nested)]));
}
