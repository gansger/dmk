import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { publicTeachers, reorderTeachers } from '../src/domain/teachers.js';
import { startServer } from './helpers/server.js';

test('public teachers: in order, hidden left out, preview preferred', () => {
  const result = publicTeachers([
    { id: '1', name: 'Вторая', url: '/2.jpg', thumbUrl: '/2-t.jpg', order: 1, enabled: true },
    { id: '2', name: 'Скрытая', url: '/3.jpg', order: 0, enabled: false },
    { id: '3', name: 'Первая', url: '/1.jpg', thumbUrl: '', order: 0, enabled: true }
  ]);
  assert.deepEqual(result.map((item) => item.name), ['Первая', 'Вторая']);
  assert.equal(result[0].photoUrl, '/1.jpg');
  assert.equal(result[1].photoUrl, '/2-t.jpg');
});

test('reorder: listed first, the rest keep their place after them', () => {
  const items = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }];
  const order = (list) => [...list].sort((x, y) => x.order - y.order).map((item) => item.id);
  assert.deepEqual(order(reorderTeachers(items, ['c', 'a'])), ['c', 'a', 'b']);
});

describe('teachers API', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.stop());

  test('changing the list requires an administrator', async () => {
    assert.equal((await server.request('/api/teachers')).status, 401);
    assert.equal((await server.request('/api/teachers', { method: 'POST', body: { name: 'Иванова' } })).status, 401);
    assert.equal((await server.request('/api/public/teachers')).status, 200);
  });

  test('adds, edits, orders, hides and deletes a teacher', async () => {
    await server.login();
    assert.equal((await server.request('/api/teachers', { method: 'POST', body: { name: '  ' } })).status, 400, 'a name is required');

    const first = (await server.request('/api/teachers', { method: 'POST', body: { name: 'Иванова Анна', position: 'Преподаватель', url: '/uploads/editor/a.jpg', thumbUrl: '/uploads/editor/a-t.jpg' } })).json;
    const second = (await server.request('/api/teachers', { method: 'POST', body: { name: 'Петров Пётр' } })).json;
    assert.deepEqual((await server.request('/api/public/teachers')).json.map((item) => item.name), ['Иванова Анна', 'Петров Пётр']);

    await server.request('/api/teachers/order', { method: 'POST', body: { ids: [second.id, first.id] } });
    assert.deepEqual((await server.request('/api/public/teachers')).json.map((item) => item.name), ['Петров Пётр', 'Иванова Анна']);

    await server.request(`/api/teachers/${second.id}`, { method: 'PUT', body: { position: 'Методист' } });
    const edited = (await server.request('/api/teachers')).json.find((item) => item.id === second.id);
    assert.equal(edited.position, 'Методист');
    assert.equal(edited.name, 'Петров Пётр', 'other fields stay');

    await server.request(`/api/teachers/${second.id}`, { method: 'PUT', body: { enabled: false } });
    assert.deepEqual((await server.request('/api/public/teachers')).json.map((item) => item.name), ['Иванова Анна']);

    assert.equal((await server.request(`/api/teachers/${second.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await server.request(`/api/teachers/${second.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await server.request('/api/teachers')).json.length, 1);
  });

  test('a page with the teachers block lists them for search engines', async () => {
    await server.request('/api/pages/pedagogi', {
      method: 'POST',
      body: { title: 'Педагоги', blocks: [{ id: 'teachers', type: 'teachers', enabled: true, order: 30, fields: {} }] }
    });
    const page = await server.request('/pedagogi');
    assert.equal(page.status, 200);
    assert.match(page.text, /<img src="\/uploads\/editor\/a-t.jpg" alt="Иванова Анна"/);
    assert.match(page.text, /<h3>Иванова Анна<\/h3><p>Преподаватель<\/p>/);
    assert.equal((page.text.match(/<h1/g) || []).length, 1);
  });
});
