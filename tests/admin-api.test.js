import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { rootDir, startServer } from './helpers/server.js';

describe('admin API', () => {
  let server;
  before(async () => {
    server = await startServer();
    await server.login();
  });
  after(() => server.stop());

  test('posts: create, unique slug, update, publish, delete', async () => {
    const first = await server.request('/api/posts', { method: 'POST', body: { title: 'Day news', content: 'Body' } });
    assert.equal(first.status, 201);
    assert.equal(first.json.status, 'draft');
    assert.equal(first.json.slug, 'day-news');

    const second = await server.request('/api/posts', { method: 'POST', body: { title: 'Day news' } });
    assert.equal(second.json.slug, 'day-news-2');

    const updated = await server.request(`/api/posts/${first.json.id}`, { method: 'PUT', body: { title: 'Renamed' } });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.title, 'Renamed');
    assert.equal(updated.json.createdAt, first.json.createdAt);

    const draftPublic = await server.request('/api/public/posts');
    assert.ok(!draftPublic.json.some((item) => item.id === first.json.id), 'drafts are not public');

    const published = await server.request(`/api/posts/${first.json.id}/publish`, { method: 'POST' });
    assert.equal(published.json.status, 'published');
    assert.ok(published.json.publishedAt);

    const pages = await server.request('/api/pages');
    assert.ok(pages.json.some((page) => page.id === 'post-day-news'), 'published post gets a generated page');

    assert.equal((await server.request(`/api/posts/${first.json.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await server.request(`/api/posts/${first.json.id}`, { method: 'DELETE' })).status, 404);
    const pagesAfter = await server.request('/api/pages');
    assert.ok(!pagesAfter.json.some((page) => page.id === 'post-day-news'), 'generated page is removed with the post');

    assert.equal((await server.request('/api/posts/missing', { method: 'PUT', body: {} })).status, 404);
  });

  test('slider: toggle post and reorder', async () => {
    const created = await server.request('/api/posts', { method: 'POST', body: { title: 'Slide' } });
    await server.request(`/api/posts/${created.json.id}/publish`, { method: 'POST' });

    const toggled = await server.request(`/api/posts/${created.json.id}/slider`, {
      method: 'POST',
      body: { showInSlider: true, sliderImagePositionX: 500 }
    });
    assert.equal(toggled.json.showInSlider, true);
    assert.equal(toggled.json.sliderImagePositionX, 100, 'position is clamped');

    const publicSlider = await server.request('/api/public/slider');
    assert.ok(publicSlider.json.posts.some((item) => item.id === created.json.id));

    const reordered = await server.request('/api/slider/reorder', { method: 'POST', body: { ids: [created.json.id] } });
    assert.equal(reordered.status, 200);
    assert.equal(reordered.json[0].id, created.json.id);
  });

  test('slider settings are clamped', async () => {
    const response = await server.request('/api/slider/settings', {
      method: 'POST',
      body: { intervalMs: 10, maxItems: 999, imageFit: 'stretch' }
    });
    assert.equal(response.json.intervalMs, 1500);
    assert.equal(response.json.maxItems, 20);
    assert.equal(response.json.imageFit, 'cover');
    assert.deepEqual((await server.request('/api/slider/settings')).json, response.json);
  });

  test('pages: save, shared layout from home, delete', async () => {
    const home = await server.request('/api/pages/home');
    assert.equal(home.status, 200);

    const saved = await server.request('/api/pages/about', {
      method: 'POST',
      body: { title: 'About', seo: { title: 'x'.repeat(300) }, blocks: [{ id: 'b1', type: 'text', fields: { html: 'Hi' } }] }
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.id, 'about');
    assert.equal(saved.json.seo.title.length, 180);
    assert.ok(saved.json.blocks.some((block) => block.id === 'b1'));

    const homeLayoutTypes = home.json.blocks.map((block) => block.type).filter((type) => ['headerNav', 'sideMenu', 'footer'].includes(type));
    const aboutTypes = saved.json.blocks.map((block) => block.type);
    for (const type of homeLayoutTypes) assert.ok(aboutTypes.includes(type), `about page inherits ${type} from home`);

    assert.equal((await server.request('/api/pages/home', { method: 'DELETE' })).status, 400);
    assert.equal((await server.request('/api/pages/about', { method: 'DELETE' })).status, 200);
    assert.equal((await server.request('/api/pages/about')).status, 404);
  });

  test('gallery: validation, create, update, delete', async () => {
    assert.equal((await server.request('/api/gallery', { method: 'POST', body: { caption: 'No url' } })).status, 400);

    const created = await server.request('/api/gallery', { method: 'POST', body: { url: '/uploads/a.jpg', caption: 'A' } });
    assert.equal(created.status, 201);

    const updated = await server.request(`/api/gallery/${created.json.id}`, { method: 'PUT', body: { caption: 'B', enabled: false } });
    assert.equal(updated.json.caption, 'B');
    const publicGallery = await server.request('/api/public/gallery');
    assert.ok(!publicGallery.json.some((item) => item.id === created.json.id), 'disabled photos are hidden');

    assert.equal((await server.request(`/api/gallery/${created.json.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await server.request(`/api/gallery/${created.json.id}`, { method: 'DELETE' })).status, 404);
  });

  test('knowledge and memory records', async () => {
    const created = await server.request('/api/knowledge', { method: 'POST', body: { title: 'Приём', content: 'С 20 июня' } });
    assert.equal(created.status, 201);
    const updated = await server.request(`/api/knowledge/${created.json.id}`, { method: 'PUT', body: { content: 'С 1 июля' } });
    assert.equal(updated.json.content, 'С 1 июля');
    assert.equal(updated.json.title, 'Приём');
    assert.equal((await server.request(`/api/knowledge/${created.json.id}`, { method: 'DELETE' })).status, 204);
    assert.ok(!(await server.request('/api/knowledge')).json.some((item) => item.id === created.json.id));

    const memory = await server.request('/api/memory', { method: 'POST', body: { key: 'tone', value: 'formal' } });
    assert.equal(memory.json.scope, 'engine');
    assert.ok((await server.request('/api/memory')).json.some((item) => item.id === memory.json.id));
  });

  test('integrations: secrets are never stored or returned', async () => {
    const saved = await server.request('/api/integrations', {
      method: 'POST',
      body: { telegram: { chatId: '-100', botToken: 'leak' }, ai: { model: 'test-model', apiKey: 'leak' } }
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.telegram.chatId, '-100');
    assert.equal(saved.json.ai.model, 'test-model');
    assert.doesNotMatch(saved.text, /leak/);
    assert.doesNotMatch((await server.request('/api/integrations')).text, /leak/);

    assert.equal((await server.request('/api/integrations/unknown/test', { method: 'POST' })).status, 404);
  });

  test('dashboard totals', async () => {
    const response = await server.request('/api/dashboard');
    assert.equal(response.status, 200);
    assert.equal(typeof response.json.totals.posts, 'number');
    assert.ok(Array.isArray(response.json.events));
  });

  test('image upload: validation and storage', async () => {
    const invalid = await server.request('/api/uploads/images', { method: 'POST', body: { data: 'data:text/plain;base64,aGk=' } });
    assert.equal(invalid.status, 400);

    const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const uploaded = await server.request('/api/uploads/images', {
      method: 'POST',
      body: { name: 'pixel.png', data: `data:image/png;base64,${pixel}` }
    });
    assert.equal(uploaded.status, 201);
    assert.match(uploaded.json.url, /^\/uploads\/editor\/.+\.png$/);

    const file = await server.request(uploaded.json.url, { auth: false });
    assert.equal(file.status, 200);
    await rm(path.join(rootDir, 'public', uploaded.json.url));
  });

  test('unknown API route is 404', async () => {
    assert.equal((await server.request('/api/nope')).status, 404);
  });
});
