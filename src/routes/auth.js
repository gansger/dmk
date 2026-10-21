import { appendEvent } from '../core/store.js';
import { readBody, sendJson } from '../core/http.js';
import { clientIp } from '../core/rate-limit.js';
import {
  adminCredentialsConfigured,
  authenticateAdmin,
  canAttemptAdminLogin,
  changeAdminPassword,
  clearFailedAdminLogins,
  createAdminSession,
  expiredSessionCookie,
  recordFailedAdminLogin,
  revokeAdminSession,
  sessionCookie,
  sessionUser
} from '../services/auth.js';

export async function handleAuthApi({ request, response, method, pathname }) {
  if (method === 'GET' && pathname === '/api/auth/session') {
    const user = sessionUser(request);
    sendJson(response, user ? 200 : 401, user ? { authenticated: true, user } : { authenticated: false });
    return true;
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!adminCredentialsConfigured()) {
      sendJson(response, 503, { error: 'CMS admin credentials are not configured.' });
      return true;
    }
    // Failed attempts are kept in SQLite, so a restart does not reset the lockout.
    const loginKey = clientIp(request);
    if (!canAttemptAdminLogin(loginKey)) {
      sendJson(response, 429, { error: 'Too many login attempts. Try again later.' });
      return true;
    }

    const body = await readBody(request);
    if (!authenticateAdmin(body.username || '', body.password || '')) {
      recordFailedAdminLogin(loginKey);
      sendJson(response, 401, { error: 'Неверный логин или пароль.' });
      return true;
    }

    clearFailedAdminLogins(loginKey);
    const token = createAdminSession(body.username);
    await appendEvent('auth.login', { username: body.username });
    sendJson(response, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(token, request) });
    return true;
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const user = sessionUser(request);
    revokeAdminSession(request);
    if (user) await appendEvent('auth.logout', { username: user.username });
    sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': expiredSessionCookie(request) });
    return true;
  }

  if (method === 'POST' && pathname === '/api/auth/password') {
    const user = sessionUser(request);
    if (!user) {
      sendJson(response, 401, { error: 'Требуется авторизация администратора.' });
      return true;
    }

    const body = await readBody(request);
    if (body.password !== body.passwordConfirmation) {
      sendJson(response, 400, { error: 'Подтверждение нового пароля не совпадает.' });
      return true;
    }

    const result = changeAdminPassword(user.username, body.currentPassword || '', body.password || '');
    if (!result.ok) {
      sendJson(response, 400, { error: result.error });
      return true;
    }

    await appendEvent('auth.password_changed', { username: user.username });
    sendJson(response, 200, { changed: true }, { 'Set-Cookie': expiredSessionCookie(request) });
    return true;
  }

  return false;
}
