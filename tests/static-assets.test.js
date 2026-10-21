import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { rootDir, startServer } from './helpers/server.js';

async function contentHash(fileName) {
  return createHash('sha256').update(await readFile(path.join(rootDir, 'public', fileName))).digest('hex').slice(0, 12);
}

describe('static asset versioning', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.stop());

  test('public pages link assets by content hash', async () => {
    const home = await server.request('/');
    assert.ok(home.text.includes(`src="/site.js?v=${await contentHash('site.js')}"`));
    assert.ok(home.text.includes(`href="/site.css?v=${await contentHash('site.css')}"`));
    assert.ok(home.text.includes(`src="/boot.js?v=${await contentHash('boot.js')}"`));
  });

  test('admin and login pages are versioned too', async () => {
    const login = await server.request('/admin');
    assert.ok(login.text.includes(`src="/login.js?v=${await contentHash('login.js')}"`));
    assert.ok(login.text.includes(`href="/styles.css?v=${await contentHash('styles.css')}"`));
    assert.equal(login.headers.get('cache-control'), 'no-store');

    await server.login();
    const admin = await server.request('/admin');
    assert.ok(admin.text.includes(`src="/app.js?v=${await contentHash('app.js')}"`));
    server.logoutLocally();
  });

  test('only the current hash is cached forever', async () => {
    const hash = await contentHash('site.js');
    const current = await server.request(`/site.js?v=${hash}`);
    assert.equal(current.status, 200);
    assert.equal(current.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(current.headers.get('etag'), `"${hash}"`);

    for (const pathname of ['/site.js', '/site.js?v=old']) {
      const response = await server.request(pathname);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-cache', `${pathname} must be revalidated`);
    }
  });

  test('unchanged file answers 304 to If-None-Match', async () => {
    const first = await server.request('/site.css');
    const etag = first.headers.get('etag');
    assert.ok(etag);

    const revalidated = await server.request('/site.css', { headers: { 'If-None-Match': etag } });
    assert.equal(revalidated.status, 304);
    assert.equal(revalidated.text, '');

    const stale = await server.request('/site.css', { headers: { 'If-None-Match': '"something-else"' } });
    assert.equal(stale.status, 200);
  });
});
