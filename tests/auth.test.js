import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { adminCredentials, startServer } from './helpers/server.js';

describe('admin authentication', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.stop());

  test('anonymous session is rejected', async () => {
    const response = await server.request('/api/auth/session');
    assert.equal(response.status, 401);
    assert.equal(response.json.authenticated, false);
  });

  test('private API requires a session', async () => {
    const response = await server.request('/api/posts', { auth: false });
    assert.equal(response.status, 401);
  });

  test('wrong password is rejected', async () => {
    const response = await server.request('/api/auth/login', {
      method: 'POST',
      body: { username: adminCredentials.username, password: 'wrong' },
      auth: false
    });
    assert.equal(response.status, 401);
  });

  test('login sets a hardened session cookie and opens private API', async () => {
    const response = await server.login();
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /^cms_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);

    assert.equal((await server.request('/api/auth/session')).status, 200);
    assert.equal((await server.request('/api/posts')).status, 200);
  });

  test('logout revokes the session on the server', async () => {
    await server.login();
    const before = await server.request('/api/auth/session');
    assert.equal(before.status, 200);

    assert.equal((await server.request('/api/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await server.request('/api/auth/session')).status, 401);
    server.logoutLocally();
  });

  test('password change validates input and invalidates sessions', async () => {
    await server.login();
    const mismatch = await server.request('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: adminCredentials.password, password: 'new-password-1', passwordConfirmation: 'other' }
    });
    assert.equal(mismatch.status, 400);

    const wrongCurrent = await server.request('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: 'wrong', password: 'new-password-1', passwordConfirmation: 'new-password-1' }
    });
    assert.equal(wrongCurrent.status, 400);

    const changed = await server.request('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: adminCredentials.password, password: 'new-password-1', passwordConfirmation: 'new-password-1' }
    });
    assert.equal(changed.status, 200);
    assert.equal((await server.request('/api/auth/session')).status, 401);

    server.logoutLocally();
    assert.equal((await server.login()).status, 401);
    assert.equal((await server.login({ ...adminCredentials, password: 'new-password-1' })).status, 200);
  });
});

describe('login lockout', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.stop());

  test('blocks the IP after 8 failed attempts, even with the right password', async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await server.login({ ...adminCredentials, password: 'wrong' });
      assert.equal(response.status, 401);
    }
    assert.equal((await server.login({ ...adminCredentials, password: 'wrong' })).status, 429);
    assert.equal((await server.login()).status, 429);
  });
});
