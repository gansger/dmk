import { mkdir, readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getRootDir, redactSensitiveValue, stripIntegrationSecrets } from './config.js';

const rootDir = getRootDir();
const dataDir = path.join(rootDir, 'data');
const databasePath = path.resolve(rootDir, process.env.CMS_DB_PATH || path.join('data', 'cms.sqlite'));
const arrayCollections = new Set(['posts', 'sites', 'knowledge', 'memory', 'events', 'gallery']);
let database;
let initialization;

const defaults = {
  posts: [],
  gallery: [],
  sites: [
    {
      id: 'main-site',
      name: 'Main Site',
      domain: 'localhost',
      basePath: '/',
      theme: 'default',
      enabled: true,
      createdAt: new Date().toISOString()
    }
  ],
  integrations: {
    telegram: {
      enabled: false,
      mode: 'polling',
      autoPublish: false,
      chatId: '',
      lastUpdateId: 0
    },
    bitrix: {
      enabled: false,
      defaultAssignedById: ''
    },
    ai: {
      enabled: false,
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      systemPrompt: 'You are a helpful website assistant. Answer clearly, politely, and use the site knowledge base.'
    }
  },
  settings: {
    slider: {
      enabled: true,
      autoplay: true,
      intervalMs: 6500,
      transitionMs: 450,
      showControls: true,
      showDots: true,
      pauseOnHover: true,
      maxItems: 6,
      imageFit: 'cover',
      imagePositionX: 50,
      imagePositionY: 50
    }
  },
  pages: {
    home: {
      id: 'home',
      title: 'Дагестанский медицинский колледж',
      updatedAt: new Date().toISOString(),
      blocks: [
        {
          id: 'hero',
          type: 'hero',
          enabled: true,
          order: 0,
          fields: {
            eyebrowHtml: 'CMS Engine',
            titleHtml: 'Публикации сайта',
            textHtml: 'Материалы появляются здесь после публикации в админке.'
          }
        },
        {
          id: 'slider',
          type: 'slider',
          enabled: true,
          order: 10,
          fields: {
            labelHtml: 'Избранное',
            buttonHtml: 'Открыть пост'
          }
        },
        {
          id: 'posts',
          type: 'posts',
          enabled: true,
          order: 20,
          fields: {
            emptyTitleHtml: 'Пока нет публикаций',
            emptyTextHtml: 'Опубликуйте первый материал в админке.'
          }
        },
        {
          id: 'gallery',
          type: 'gallery',
          enabled: true,
          order: 30,
          fields: {
            titleHtml: 'Фотогалерея',
            limit: 12
          }
        }
      ]
    }
  },
  knowledge: [
    {
      id: 'core-positioning',
      title: 'CMS Engine Vision',
      kind: 'product',
      tags: ['cms', 'strategy'],
      content: 'The engine manages websites, posts, integrations, knowledge, and AI assistant behavior from one admin panel.',
      updatedAt: new Date().toISOString()
    }
  ],
  memory: [
    {
      id: 'future-roadmap-memory',
      type: 'project',
      scope: 'engine',
      key: 'long_term_goal',
      value: 'Build a reusable CMS platform for creating client sites with automated publishing and integrations.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  events: []
};

function dataPath(collection) {
  return path.join(dataDir, `${collection}.json`);
}

function sanitizedCollection(collection, value) {
  if (collection === 'integrations') return stripIntegrationSecrets(value);
  if (collection === 'events') return redactSensitiveValue(value);
  return value;
}

function openDatabase() {
  if (database) return database;

  mkdirSync(path.dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cms_items (
      collection TEXT NOT NULL,
      item_key TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, item_key)
    );

    CREATE INDEX IF NOT EXISTS cms_items_collection_position
      ON cms_items (collection, position);

    CREATE TABLE IF NOT EXISTS cms_collections (
      name TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      initialized_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS admin_sessions_expires_at
      ON admin_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS admin_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_key TEXT NOT NULL,
      attempted_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS admin_login_attempts_key_time
      ON admin_login_attempts (attempt_key, attempted_at);

    CREATE INDEX IF NOT EXISTS admin_login_attempts_time
      ON admin_login_attempts (attempted_at);
  `);
  return database;
}

function writeCollection(collection, value) {
  const db = openDatabase();
  const now = new Date().toISOString();
  const kind = arrayCollections.has(collection) ? 'array' : 'object';
  const safeValue = sanitizedCollection(collection, value);
  const entries =
    kind === 'array'
      ? safeValue.map((item, index) => [`${index}:${item.id || crypto.randomUUID()}`, item, index])
      : Object.entries(safeValue).map(([key, item], index) => [key, item, index]);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM cms_items WHERE collection = ?').run(collection);
    const insert = db.prepare(`
      INSERT INTO cms_items (collection, item_key, position, value_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const [key, item, position] of entries) {
      insert.run(collection, key, position, JSON.stringify(item), now);
    }
    db.prepare(`
      INSERT INTO cms_collections (name, kind, initialized_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET kind = excluded.kind, updated_at = excluded.updated_at
    `).run(collection, kind, now, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return safeValue;
}

function collectionInitialized(collection) {
  return Boolean(openDatabase().prepare('SELECT 1 FROM cms_collections WHERE name = ?').get(collection));
}

async function importLegacyData() {
  await mkdir(dataDir, { recursive: true });
  openDatabase();

  for (const [collection, fallback] of Object.entries(defaults)) {
    if (collectionInitialized(collection)) continue;
    let value = fallback;
    try {
      value = JSON.parse(await readFile(dataPath(collection), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    writeCollection(collection, value);
  }
}

export function getDatabase() {
  return openDatabase();
}

export function getDatabasePath() {
  return databasePath;
}

export async function ensureDataFiles() {
  initialization ||= importLegacyData();
  await initialization;
}

export async function read(collection) {
  await ensureDataFiles();
  const rows = openDatabase()
    .prepare('SELECT item_key, value_json FROM cms_items WHERE collection = ? ORDER BY position, item_key')
    .all(collection);

  if (arrayCollections.has(collection)) return rows.map((row) => JSON.parse(row.value_json));
  return Object.fromEntries(rows.map((row) => [row.item_key, JSON.parse(row.value_json)]));
}

export async function write(collection, value) {
  await ensureDataFiles();
  return writeCollection(collection, value);
}

export async function appendEvent(type, payload = {}) {
  await ensureDataFiles();
  const event = {
    id: crypto.randomUUID(),
    type,
    payload: redactSensitiveValue(payload),
    createdAt: new Date().toISOString()
  };

  const db = openDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE cms_items SET position = position + 1 WHERE collection = ?').run('events');
    db.prepare(`
      INSERT INTO cms_items (collection, item_key, position, value_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('events', event.id, 0, JSON.stringify(event), event.createdAt);
    db.prepare('DELETE FROM cms_items WHERE collection = ? AND position >= ?').run('events', 500);
    db.prepare('UPDATE cms_collections SET updated_at = ? WHERE name = ?').run(event.createdAt, 'events');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return event;
}
