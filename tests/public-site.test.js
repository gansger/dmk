import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startServer } from './helpers/server.js';

describe('public site', () => {
  let server;
  let post;
  before(async () => {
    server = await startServer();
    await server.login();
    await server.request('/api/pages/test-page', {
      method: 'POST',
      body: { title: 'Тестовая страница', blocks: [{ id: 'text', type: 'text', fields: { html: '<p>Привет</p>' } }] }
    });
    const created = await server.request('/api/posts', {
      method: 'POST',
      body: { title: 'Публичная новость', content: 'Текст новости' }
    });
    post = (await server.request(`/api/posts/${created.json.id}/publish`, { method: 'POST' })).json;
    server.logoutLocally();
  });
  after(() => server.stop());

  test('home page is server-rendered with page state and security headers', async () => {
    const response = await server.request('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.text, /<script id="cmsPageState" type="application\/json">\{"pageId":"home"\}<\/script>/);
    assert.doesNotMatch(response.text, /<script>/, 'inline executable scripts would be blocked by CSP');

    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('strict-transport-security'), null, 'HSTS only over HTTPS');
  });

  test('HSTS is sent behind an HTTPS proxy', async () => {
    const response = await server.request('/', { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.match(response.headers.get('strict-transport-security'), /max-age=31536000/);
  });

  test('custom page renders by its path', async () => {
    const response = await server.request('/test-page');
    assert.equal(response.status, 200);
    assert.match(response.text, /"pageId":"test-page"/);
    assert.match(response.text, /Тестовая страница/);
  });

  test('published post renders at /news/:slug', async () => {
    const response = await server.request(`/news/${post.slug}`);
    assert.equal(response.status, 200);
    assert.match(response.text, /Публичная новость/);
  });

  test('unknown page is a noindex 404', async () => {
    const response = await server.request('/no-such-page');
    assert.equal(response.status, 404);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  });

  test('legacy URLs redirect permanently', async () => {
    const site = await server.request('/site.html');
    assert.equal(site.status, 301);
    assert.equal(site.headers.get('location'), '/');

    const page = await server.request('/?page=test-page');
    assert.equal(page.status, 301);
    assert.equal(page.headers.get('location'), '/test-page');

    const legacyPost = await server.request(`/?post=${post.slug}`);
    assert.equal(legacyPost.status, 301);
    assert.equal(legacyPost.headers.get('location'), `/news/${post.slug}`);
  });

  test('robots.txt and sitemap.xml', async () => {
    const robots = await server.request('/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.text, /Sitemap:/);

    const sitemap = await server.request('/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    assert.match(sitemap.text, /\/test-page<\/loc>/);
    assert.match(sitemap.text, new RegExp(`/news/${post.slug}</loc>`));
  });

  test('admin shows login page and editor redirects anonymous visitors', async () => {
    const admin = await server.request('/admin');
    assert.equal(admin.status, 200);
    assert.match(admin.text, /login\.js/);

    const edit = await server.request('/edit?page=home');
    assert.equal(edit.status, 302);
    assert.equal(edit.headers.get('location'), `/admin?next=${encodeURIComponent('/edit?page=home')}`);
  });

  test('path traversal is refused', async () => {
    const traversal = await server.request('/..%2Fpackage.json');
    assert.notEqual(traversal.status, 200);
  });

  test('public JSON API exposes only published content', async () => {
    const posts = await server.request('/api/public/posts');
    assert.equal(posts.status, 200);
    assert.ok(posts.json.every((item) => item.status === 'published'));
    assert.ok(posts.json.some((item) => item.id === post.id && item.pageUrl === `/news/${post.slug}`));

    const page = await server.request('/api/public/page/test-page');
    assert.equal(page.status, 200);
    assert.equal(page.json.title, 'Тестовая страница');

    assert.equal((await server.request('/api/public/page/missing')).status, 404);
    assert.equal((await server.request('/api/health')).json.ok, true);
  });
});
