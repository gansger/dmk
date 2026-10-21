import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { publicGalleryItems, syncPostPhotos } from '../src/domain/gallery.js';
import { startServer } from './helpers/server.js';

const post = (id, photos, extra = {}) => ({
  id,
  title: `Новость ${id}`,
  slug: `news-${id}`,
  status: 'published',
  publishedAt: '2026-05-01T10:00:00.000Z',
  media: photos.map((url) => ({ type: 'image', url, thumbUrl: `${url}.thumb` })),
  ...extra
});

describe('syncPostPhotos', () => {
  test('adds post photos once, with the post as caption and date', () => {
    const { items, changed } = syncPostPhotos([post('a', ['/u/1.jpg', '/u/2.jpg'])], []);
    assert.equal(changed, true);
    assert.equal(items.length, 2);
    assert.equal(items[0].source, 'post');
    assert.equal(items[0].postId, 'a');
    assert.equal(items[0].caption, 'Новость a');
    assert.equal(items[0].thumbUrl, items[0].url + '.thumb');
    assert.equal(items[0].takenAt, '2026-05-01T10:00:00.000Z');
    assert.equal(syncPostPhotos([post('a', ['/u/1.jpg', '/u/2.jpg'])], items).changed, false);
  });

  test('keeps library settings and drops photos removed from the post', () => {
    const first = syncPostPhotos([post('a', ['/u/1.jpg', '/u/2.jpg'])], []).items;
    first.find((item) => item.url === '/u/1.jpg').enabled = false;
    first.find((item) => item.url === '/u/1.jpg').caption = 'Своя подпись';
    const { items } = syncPostPhotos([post('a', ['/u/1.jpg'])], first);
    assert.equal(items.length, 1);
    assert.equal(items[0].enabled, false);
    assert.equal(items[0].caption, 'Своя подпись');
    assert.deepEqual(syncPostPhotos([], items).items, []);
  });

  test('never touches uploaded library photos', () => {
    const uploaded = { id: 'u', url: '/u/own.jpg', source: 'upload', enabled: true };
    assert.deepEqual(syncPostPhotos([], [uploaded]).items, [uploaded]);
  });
});

test('public gallery: newest first, hidden and unpublished left out, post link added', () => {
  const posts = [post('a', []), post('d', [], { status: 'draft' })];
  const items = [
    { id: '1', url: '/1.jpg', enabled: true, takenAt: '2026-01-01', source: 'upload' },
    { id: '2', url: '/2.jpg', enabled: true, takenAt: '2026-03-01', source: 'post', postId: 'a' },
    { id: '3', url: '/3.jpg', enabled: false, takenAt: '2026-04-01', source: 'upload' },
    { id: '4', url: '/4.jpg', enabled: true, takenAt: '2026-05-01', source: 'post', postId: 'd' }
  ];
  const result = publicGalleryItems(items, posts);
  assert.deepEqual(result.map((item) => item.id), ['2', '1']);
  assert.equal(result[0].postUrl, '/news/news-a');
  assert.equal(result[1].thumbUrl, '/1.jpg', 'falls back to the full photo');
});

describe('media library API', () => {
  let server;
  before(async () => {
    server = await startServer();
    await server.login();
  });
  after(() => server.stop());

  test('photos of a published post appear in the gallery and leave with the post', async () => {
    const created = await server.request('/api/posts', {
      method: 'POST',
      body: { title: 'День открытых дверей', media: [{ type: 'image', url: '/uploads/editor/open-day.jpg', thumbUrl: '/uploads/editor/open-day-thumb.jpg' }] }
    });
    const library = (await server.request('/api/gallery')).json;
    const photo = library.find((item) => item.url === '/uploads/editor/open-day.jpg');
    assert.equal(photo.source, 'post');
    assert.equal(photo.postStatus, 'draft');
    assert.ok(!(await server.request('/api/public/gallery')).json.some((item) => item.id === photo.id), 'draft post photos stay private');

    await server.request(`/api/posts/${created.json.id}/publish`, { method: 'POST' });
    const visible = (await server.request('/api/public/gallery')).json.find((item) => item.id === photo.id);
    assert.equal(visible.postUrl, `/news/${created.json.slug}`);
    assert.equal(visible.thumbUrl, '/uploads/editor/open-day-thumb.jpg');

    assert.equal((await server.request(`/api/gallery/${photo.id}`, { method: 'DELETE' })).status, 400, 'post photos are hidden, not deleted');
    await server.request(`/api/gallery/${photo.id}`, { method: 'PUT', body: { enabled: false, url: '/evil.jpg' } });
    const hidden = (await server.request('/api/gallery')).json.find((item) => item.id === photo.id);
    assert.equal(hidden.enabled, false);
    assert.equal(hidden.url, '/uploads/editor/open-day.jpg', 'the file of a post photo cannot be swapped here');

    await server.request(`/api/posts/${created.json.id}`, { method: 'DELETE' });
    assert.ok(!(await server.request('/api/gallery')).json.some((item) => item.id === photo.id));
  });

  test('uploaded photos keep their preview and date; limit works', async () => {
    for (const day of ['01', '02', '03']) {
      await server.request('/api/gallery', {
        method: 'POST',
        body: { url: `/uploads/editor/${day}.jpg`, thumbUrl: `/uploads/editor/${day}-t.jpg`, takenAt: `2026-02-${day}T12:00:00.000Z`, caption: day }
      });
    }
    const limited = (await server.request('/api/public/gallery?limit=2')).json;
    assert.deepEqual(limited.map((item) => item.caption), ['03', '02']);
  });

  test('the gallery page exists and lists photos for image search', async () => {
    const page = await server.request('/fotogalereya');
    assert.equal(page.status, 200);
    assert.match(page.text, /<h1[^>]*>Фотогалерея<\/h1>/);
    assert.match(page.text, /<img src="\/uploads\/editor\/03-t.jpg" alt="03"/);
    assert.match((await server.request('/')).text, /<a href="\/fotogalereya">Все фото<\/a>/);
  });
});
