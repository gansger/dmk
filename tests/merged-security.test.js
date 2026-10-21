import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { adminCredentials, startServer } from './helpers/server.js';

describe('cross-site request protection', () => {
  let server;
  before(async () => {
    server = await startServer();
    await server.login();
  });
  after(() => server.stop());

  test('admin changes from another site are refused', async () => {
    const response = await server.request('/api/posts', {
      method: 'POST',
      body: { title: 'Forged' },
      headers: { Origin: 'https://evil.example' }
    });
    assert.equal(response.status, 403);
  });

  test('requests from the site itself are allowed', async () => {
    const response = await server.request('/api/posts', {
      method: 'POST',
      body: { title: 'Own' },
      headers: { Origin: server.baseUrl }
    });
    assert.equal(response.status, 201);
  });

  test('public widgets may be called from other sites', async () => {
    const response = await server.request('/api/ai/assistant', {
      method: 'POST',
      body: { message: 'Привет' },
      headers: { Origin: 'https://partner.example' },
      auth: false
    });
    assert.equal(response.status, 200);
  });
});

describe('uploads and login lockout', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.stop());

  test('a file that only claims to be an image is refused', async () => {
    await server.login();
    const fake = Buffer.from('<script>alert(1)</script>').toString('base64');
    const response = await server.request('/api/uploads/images', {
      method: 'POST',
      body: { name: 'x.png', data: `data:image/png;base64,${fake}` }
    });
    assert.equal(response.status, 400);
    server.logoutLocally();
  });

  test('failed logins are counted in the database', async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      assert.equal((await server.login({ ...adminCredentials, password: 'wrong-password' })).status, 401);
    }
    assert.equal((await server.login()).status, 429);
  });
});
