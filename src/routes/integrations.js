import { withRuntimeSecrets } from '../core/config.js';
import { limitedString } from '../core/format.js';
import { appendEvent, read, write } from '../core/store.js';
import { readBody, routeParams, sendJson } from '../core/http.js';
import { mergeIntegrations, sanitizeIntegrations } from '../domain/integrations.js';
import { ensureUniqueSlug, syncPublishedPostPages } from '../domain/posts.js';
import { createBitrixLead, testBitrix } from '../integrations/bitrix.js';
import { importTelegramUpdates, telegramUpdateToPost, testTelegram } from '../integrations/telegram.js';
import { askAssistant } from '../services/assistant.js';

const leadCommentsMaxLength = 2000;

async function handleTelegramWebhook(request, response) {
  const integrations = withRuntimeSecrets(await read('integrations'));
  const telegram = integrations.telegram || {};
  const secret = request.headers['x-telegram-bot-api-secret-token'];
  if (!telegram.webhookSecret) {
    sendJson(response, 503, { error: 'Telegram webhook secret is not configured' });
    return true;
  }
  if (secret !== telegram.webhookSecret) {
    sendJson(response, 401, { error: 'Invalid Telegram webhook secret' });
    return true;
  }
  const update = await readBody(request);
  const updateChatId =
    update.channel_post?.chat?.id ||
    update.message?.chat?.id ||
    update.edited_channel_post?.chat?.id ||
    update.edited_message?.chat?.id;
  if (telegram.chatId && String(updateChatId) !== String(telegram.chatId)) {
    sendJson(response, 200, { imported: false, skipped: 'chat_mismatch' });
    return true;
  }
  const post = await telegramUpdateToPost(update, 'main-site', {
    autoPublish: Boolean(telegram.autoPublish),
    config: telegram
  });
  if (!post) {
    sendJson(response, 200, { imported: false });
    return true;
  }
  const posts = await read('posts');
  const existing = posts.find((item) => item.sourceId === post.sourceId);
  if (existing) {
    const knownFiles = new Set((existing.media || []).map((item) => item.sourceFileId).filter(Boolean));
    const appended = (post.media || []).filter((item) => !knownFiles.has(item.sourceFileId));
    existing.media = [...(existing.media || []), ...appended].map((item, index) => ({ ...item, isCover: index === 0 }));
    existing.coverImage = existing.media[0]?.url || existing.coverImage || null;
    existing.content = existing.content || post.content;
    existing.excerpt = existing.excerpt || post.excerpt;
    existing.updatedAt = new Date().toISOString();
    await write('posts', posts);
    await syncPublishedPostPages(posts);
    await appendEvent('telegram.webhook_media_appended', { id: existing.id, count: appended.length });
    sendJson(response, 200, { imported: false, updated: true, post: existing });
    return true;
  }
  const nextPost = ensureUniqueSlug(posts, post);
  const nextPosts = [nextPost, ...posts];
  await write('posts', nextPosts);
  await syncPublishedPostPages(nextPosts);
  await appendEvent('telegram.webhook_import', { id: nextPost.id, title: nextPost.title });
  sendJson(response, 200, { imported: true, post: nextPost });
  return true;
}

export async function handleIntegrationsApi({ request, response, method, pathname }) {
  if (method === 'GET' && pathname === '/api/integrations') {
    sendJson(response, 200, sanitizeIntegrations(withRuntimeSecrets(await read('integrations'))));
    return true;
  }

  if (method === 'POST' && pathname === '/api/integrations') {
    const body = await readBody(request);
    const previous = await read('integrations');
    const next = mergeIntegrations(previous, body);
    await write('integrations', next);
    await appendEvent('integrations.updated', {
      enabled: {
        telegram: Boolean(next.telegram?.enabled),
        bitrix: Boolean(next.bitrix?.enabled),
        ai: Boolean(next.ai?.enabled)
      }
    });
    sendJson(response, 200, sanitizeIntegrations(withRuntimeSecrets(next)));
    return true;
  }

  const params = routeParams('/api/integrations/:name/test', pathname);
  if (params && method === 'POST') {
    const integrations = withRuntimeSecrets(await read('integrations'));
    if (params.name === 'telegram') sendJson(response, 200, await testTelegram(integrations.telegram));
    else if (params.name === 'bitrix') sendJson(response, 200, await testBitrix(integrations.bitrix));
    else if (params.name === 'ai') {
      const result = await askAssistant({
        config: integrations.ai,
        knowledge: await read('knowledge'),
        memory: await read('memory'),
        message: 'Say a short connection test sentence.'
      });
      sendJson(response, 200, { ok: true, message: result.answer, mode: result.mode });
    } else sendJson(response, 404, { error: 'Unknown integration' });
    return true;
  }

  if (method === 'POST' && pathname === '/api/integrations/telegram/import') {
    const integrations = await read('integrations');
    const runtimeIntegrations = withRuntimeSecrets(integrations);
    const posts = await read('posts');
    const result = await importTelegramUpdates(runtimeIntegrations.telegram, posts);
    const nextPosts = [...result.imported, ...posts];
    await write('posts', nextPosts);
    await syncPublishedPostPages(nextPosts);
    integrations.telegram.lastUpdateId = result.nextUpdateId;
    await write('integrations', integrations);
    await appendEvent('telegram.import', { count: result.imported.length });
    sendJson(response, 200, result);
    return true;
  }

  if (method === 'POST' && pathname === '/api/integrations/telegram/webhook') {
    return handleTelegramWebhook(request, response);
  }

  if (method === 'POST' && pathname === '/api/integrations/bitrix/lead') {
    const integrations = withRuntimeSecrets(await read('integrations'));
    if (!integrations.bitrix?.enabled) {
      sendJson(response, 503, { error: 'Bitrix integration is disabled' });
      return true;
    }
    const body = await readBody(request);
    const lead = {
      title: limitedString(body.title, 200),
      name: limitedString(body.name, 200),
      phone: limitedString(body.phone, 50),
      email: limitedString(body.email, 200),
      comments: limitedString(body.comments, leadCommentsMaxLength)
    };
    if (!lead.phone && !lead.email) {
      sendJson(response, 400, { error: 'Укажите телефон или email.' });
      return true;
    }
    const leadId = await createBitrixLead(integrations.bitrix, lead);
    await appendEvent('bitrix.lead_created', { leadId });
    sendJson(response, 201, { leadId });
    return true;
  }

  return false;
}
