import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { knowledgeMatchQuery } from '../src/core/knowledge-index.js';
import { startServer } from './helpers/server.js';

test('match query drops stop words, folds ё and searches by word stem', () => {
  assert.equal(knowledgeMatchQuery('Когда приём документов?'), '"прие"* OR "документ"*');
  assert.equal(knowledgeMatchQuery('Есть ли общежития?'), '"общежит"*');
  assert.equal(knowledgeMatchQuery('и в на ?!'), '');
  // FTS5 operators typed by a visitor become quoted plain terms, never query syntax.
  assert.equal(knowledgeMatchQuery('"quotes" OR NEAR('), '"quote"* OR "or"* OR "near"*');
});

describe('knowledge search', () => {
  let server;
  const ids = {};
  before(async () => {
    server = await startServer();
    await server.login();
    const records = {
      admission: { title: 'Приём документов', content: 'Документы принимаются с 20 июня по 15 августа.', tags: ['абитуриентам'] },
      dorm: { title: 'Общежитие', content: 'Иногородним студентам предоставляется общежитие.' },
      fees: { title: 'Стоимость обучения', content: 'Обучение на платной основе стоит 90 000 рублей в год.' }
    };
    for (const [key, body] of Object.entries(records)) {
      ids[key] = (await server.request('/api/knowledge', { method: 'POST', body })).json.id;
    }
  });
  after(() => server.stop());

  const search = async (q) => (await server.request(`/api/knowledge/search?q=${encodeURIComponent(q)}`)).json;

  test('finds records by different word forms', async () => {
    assert.equal((await search('когда приема документов'))[0].id, ids.admission);
    assert.equal((await search('Есть ли общежития?'))[0].id, ids.dorm);
    assert.equal((await search('сколько стоит обучение'))[0].id, ids.fees);
    assert.equal((await search('абитуриенты'))[0].id, ids.admission, 'tags are searchable');
  });

  test('returns nothing for unrelated questions and empty input', async () => {
    assert.deepEqual(await search('погода на марсе'), []);
    assert.deepEqual(await search(''), []);
  });

  test('index follows edits and deletions', async () => {
    await server.request(`/api/knowledge/${ids.dorm}`, { method: 'PUT', body: { title: 'Проживание', content: 'Хостел рядом с колледжем.' } });
    assert.deepEqual(await search('общежитие'), []);
    assert.equal((await search('хостел'))[0].id, ids.dorm);

    await server.request(`/api/knowledge/${ids.dorm}`, { method: 'DELETE' });
    assert.deepEqual(await search('хостел'), []);
  });

  test('assistant answers from the relevant record only', async () => {
    const response = await server.request('/api/ai/assistant', {
      method: 'POST',
      body: { message: 'Когда начинается приём документов?' }
    });
    assert.equal(response.json.mode, 'local-draft');
    assert.match(response.json.answer, /20 июня/);
    assert.doesNotMatch(response.json.answer, /90 000/);
  });

  test('search requires admin session', async () => {
    const response = await server.request('/api/knowledge/search?q=test', { auth: false });
    assert.equal(response.status, 401);
  });
});
