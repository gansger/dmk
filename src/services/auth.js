import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '../core/store.js';

const sessionCookieName = 'cms_session';
const sessionTtlMs = Number(process.env.CMS_SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const passwordMinLength = 10;
const passwordMaxLength = 256;
const loginAttemptWindowMs = 15 * 60 * 1000;
const loginAttemptLimit = 8;
let lastSessionCleanupAt = 0;
let lastLoginAttemptCleanupAt = 0;

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredUsername() {
  return String(process.env.CMS_ADMIN_USERNAME || '').trim();
}

function passwordDigest(password, salt) {
  return scryptSync(String(password), salt, 64).toString('base64url');
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString('base64url');
  return { salt, digest: passwordDigest(password, salt) };
}

function ensureAdminAccount() {
  const username = configuredUsername();
  const password = process.env.CMS_ADMIN_PASSWORD;
  if (!username || !password) return false;

  const db = getDatabase();
  if (db.prepare('SELECT 1 FROM admin_users WHERE username = ?').get(username)) return true;

  const now = new Date().toISOString();
  const record = passwordRecord(password);
  db.prepare(`
    INSERT INTO admin_users (username, password_hash, password_salt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, record.digest, record.salt, now, now);
  return true;
}

function cookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        if (separator === -1) return [part, ''];
        try {
          return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
        } catch {
          return [part.slice(0, separator), ''];
        }
      })
  );
}

function isSecureRequest(request) {
  return Boolean(request.socket.encrypted) || request.headers['x-forwarded-proto'] === 'https';
}

function cookie(value, request, maxAgeSeconds) {
  const parts = [
    `${sessionCookieName}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

function clearExpiredSessions() {
  const now = Date.now();
  if (now - lastSessionCleanupAt < 60 * 1000) return;
  lastSessionCleanupAt = now;
  getDatabase().prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

function loginAttemptKey(value) {
  return hash(`admin-login:${String(value || 'unknown')}`);
}

function clearExpiredLoginAttempts(now = Date.now()) {
  if (now - lastLoginAttemptCleanupAt < 60 * 1000) return;
  lastLoginAttemptCleanupAt = now;
  getDatabase()
    .prepare('DELETE FROM admin_login_attempts WHERE attempted_at <= ?')
    .run(now - loginAttemptWindowMs);
}

export function canAttemptAdminLogin(value) {
  const now = Date.now();
  clearExpiredLoginAttempts(now);
  const row = getDatabase()
    .prepare(`
      SELECT COUNT(*) AS attempts
      FROM admin_login_attempts
      WHERE attempt_key = ? AND attempted_at > ?
    `)
    .get(loginAttemptKey(value), now - loginAttemptWindowMs);
  return Number(row?.attempts || 0) < loginAttemptLimit;
}

export function recordFailedAdminLogin(value) {
  const now = Date.now();
  clearExpiredLoginAttempts(now);
  getDatabase()
    .prepare('INSERT INTO admin_login_attempts (attempt_key, attempted_at) VALUES (?, ?)')
    .run(loginAttemptKey(value), now);
}

export function clearFailedAdminLogins(value) {
  getDatabase()
    .prepare('DELETE FROM admin_login_attempts WHERE attempt_key = ?')
    .run(loginAttemptKey(value));
}

export function adminCredentialsConfigured() {
  return ensureAdminAccount();
}

export function authenticateAdmin(username, password) {
  if (!adminCredentialsConfigured()) return false;
  if (typeof password !== 'string' || password.length > passwordMaxLength) return false;
  const account = getDatabase()
    .prepare('SELECT password_hash, password_salt FROM admin_users WHERE username = ?')
    .get(String(username));
  return Boolean(account) && safeEqual(passwordDigest(password, account.password_salt), account.password_hash);
}

export function changeAdminPassword(username, currentPassword, nextPassword) {
  if (!authenticateAdmin(username, currentPassword)) {
    return { ok: false, error: 'Текущий пароль указан неверно.' };
  }
  if (typeof nextPassword !== 'string' || nextPassword.length < passwordMinLength) {
    return { ok: false, error: `Новый пароль должен содержать не менее ${passwordMinLength} символов.` };
  }
  if (nextPassword.length > passwordMaxLength) {
    return { ok: false, error: `Новый пароль не должен превышать ${passwordMaxLength} символов.` };
  }
  if (safeEqual(currentPassword, nextPassword)) {
    return { ok: false, error: 'Новый пароль должен отличаться от текущего.' };
  }

  const record = passwordRecord(nextPassword);
  const db = getDatabase();
  db.prepare(`
    UPDATE admin_users
    SET password_hash = ?, password_salt = ?, updated_at = ?
    WHERE username = ?
  `).run(record.digest, record.salt, new Date().toISOString(), username);
  db.prepare('DELETE FROM admin_sessions WHERE username = ?').run(username);
  return { ok: true };
}

export function createAdminSession(username) {
  clearExpiredSessions();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  getDatabase()
    .prepare('INSERT INTO admin_sessions (token_hash, username, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hash(token), username, expiresAt, new Date().toISOString());
  return token;
}

export function sessionUser(request) {
  clearExpiredSessions();
  const token = cookies(request)[sessionCookieName];
  if (!token) return null;
  return getDatabase()
    .prepare('SELECT username FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .get(hash(token), new Date().toISOString()) || null;
}

export function revokeAdminSession(request) {
  const token = cookies(request)[sessionCookieName];
  if (token) getDatabase().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hash(token));
}

export function sessionCookie(token, request) {
  return cookie(token, request, Math.floor(sessionTtlMs / 1000));
}

export function expiredSessionCookie(request) {
  return cookie('', request, 0);
}
