import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const envPath = path.join(rootDir, '.env.local');

function redactSensitiveText(value) {
  return String(value)
    .replace(/\/file\/bot[^/\s?]+/gi, '/file/bot[REDACTED]')
    .replace(/\/bot[^/\s?]+/gi, '/bot[REDACTED]')
    .replace(/\b\d{6,}:[a-zA-Z0-9_-]{20,}\b/g, '[REDACTED_TELEGRAM_TOKEN]')
    .replace(/\bsk-[a-zA-Z0-9:_-]{12,}\b/g, '[REDACTED_API_KEY]');
}

function redactSensitiveValue(value) {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactSensitiveValue(nested)]));
}

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(dataDir, fileName), 'utf8'));
}

async function writeJson(fileName, value) {
  await writeFile(path.join(dataDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readEnv() {
  try {
    const text = await readFile(envPath, 'utf8');
    return new Map(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separator = line.indexOf('=');
          const key = line.slice(0, separator).trim();
          const raw = line.slice(separator + 1).trim();
          let value = raw;
          try {
            value = JSON.parse(raw);
          } catch {}
          return [key, String(value)];
        })
    );
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
}

async function writeEnv(env) {
  const preferredOrder = [
    'CMS_ADMIN_USERNAME',
    'CMS_ADMIN_PASSWORD',
    'CMS_DB_PATH',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'BITRIX_WEBHOOK_URL',
    'OPENAI_API_KEY'
  ];
  const keys = [...new Set([...preferredOrder, ...env.keys()])].filter((key) => env.has(key));
  const text = keys.map((key) => `${key}=${JSON.stringify(env.get(key))}`).join('\n');
  await writeFile(envPath, `${text}\n`, 'utf8');
}

const integrations = await readJson('integrations.json');
const events = await readJson('events.json');
const env = await readEnv();
let generatedAdminPassword = false;

const secretMappings = [
  ['telegram', 'botToken', 'TELEGRAM_BOT_TOKEN'],
  ['telegram', 'webhookSecret', 'TELEGRAM_WEBHOOK_SECRET'],
  ['bitrix', 'webhookUrl', 'BITRIX_WEBHOOK_URL'],
  ['ai', 'apiKey', 'OPENAI_API_KEY']
];

for (const [group, field, envName] of secretMappings) {
  const value = integrations[group]?.[field];
  if (value && !env.has(envName)) env.set(envName, String(value));
  if (integrations[group]) delete integrations[group][field];
}

if (!env.has('CMS_ADMIN_USERNAME')) env.set('CMS_ADMIN_USERNAME', 'admin');
if (!env.has('CMS_ADMIN_PASSWORD')) {
  env.set('CMS_ADMIN_PASSWORD', randomBytes(18).toString('base64url'));
  generatedAdminPassword = true;
}

await writeEnv(env);
await writeJson('integrations.json', integrations);
await writeJson('events.json', redactSensitiveValue(events));

const store = await import('../src/core/store.js');
await store.ensureDataFiles();
for (const collection of ['posts', 'sites', 'integrations', 'settings', 'pages', 'knowledge', 'memory', 'events']) {
  await store.write(collection, await store.read(collection));
}

console.log(`SQLite database ready: ${store.getDatabasePath()}`);
console.log('Legacy JSON secrets and sensitive event payloads were scrubbed.');
if (generatedAdminPassword) console.log('A CMS admin password was generated and saved in .env.local.');
