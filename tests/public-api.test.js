import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startServer } from './helpers/server.js';

const ask = (server, body, options = {}) =>
  server.request('/api/ai/assistant', { method: 'POST', body, auth: false, ...options });

describe('public AI assistant', () => {
  let server;
  before(async () => {
    server = await startServer({ CMS_AI_LIMIT_PER_IP: '3' });
  });
  after(() => server.stop());

  test('validates the message and answers locally without an API key', async () => {
    assert.equal((await ask(server, { message: '   ' })).status, 400);
    assert.equal((await ask(server, { message: 'x'.repeat(2001) })).status, 400);

    const response = await ask(server, { message: 'Когда приём?', visitorId: 'visitor-1' });
    assert.equal(response.status, 200);
    assert.equal(response.json.mode, 'local-draft');
  });

  test('is rate limited per IP with Retry-After', async () => {
    // The limit is 3 per window and the previous test already used all three.
    const limited = await ask(server, { message: 'Ещё вопрос' });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  });

  test('logged-in admin is not rate limited', async () => {
    await server.login();
    assert.equal((await ask(server, { message: 'Вопрос админа' }, { auth: true })).status, 200);
  });
});

describe('public Bitrix lead', () => {
  let server;
  before(async () => {
    server = await startServer({ CMS_LEAD_LIMIT_PER_IP: '2' });
  });
  after(() => server.stop());

  test('is refused while the integration is disabled, and rate limited', async () => {
    const lead = { name: 'Иван', phone: '+70000000000' };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await server.request('/api/integrations/bitrix/lead', { method: 'POST', body: lead, auth: false });
      assert.equal(response.status, 503);
    }
    const limited = await server.request('/api/integrations/bitrix/lead', { method: 'POST', body: lead, auth: false });
    assert.equal(limited.status, 429);
  });
});

describe('public Telegram webhook', () => {
  let server;
  before(async () => {
    server = await startServer({ TELEGRAM_WEBHOOK_SECRET: 'hook-secret' });
  });
  after(() => server.stop());

  test('requires the secret header', async () => {
    const update = { message: { message_id: 1, chat: { id: 1 }, text: 'hi' } };
    const missing = await server.request('/api/integrations/telegram/webhook', { method: 'POST', body: update, auth: false });
    assert.equal(missing.status, 401);

    const wrong = await server.request('/api/integrations/telegram/webhook', {
      method: 'POST',
      body: update,
      auth: false,
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'nope' }
    });
    assert.equal(wrong.status, 401);
  });
});
