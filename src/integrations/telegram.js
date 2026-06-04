import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { excerptFrom, firstSentenceFrom, slugify } from '../core/format.js';
import { getRootDir } from '../core/config.js';

function messageText(message) {
  return message?.text || message?.caption || '';
}

function messageFromUpdate(update) {
  return update.channel_post || update.message || update.edited_channel_post || update.edited_message;
}

function sourceIdFrom(update) {
  const message = messageFromUpdate(update);
  const chatId = message?.chat?.id ?? 'unknown';
  if (message?.media_group_id) return `telegram:${chatId}:album:${message.media_group_id}`;
  const messageId = message?.message_id ?? update.update_id;
  return `telegram:${chatId}:${messageId}`;
}

function updateChatId(update) {
  const message = messageFromUpdate(update);
  return message?.chat?.id ? String(message.chat.id) : '';
}

function isAllowedChat(update, chatId) {
  if (!chatId) return true;
  return updateChatId(update) === String(chatId);
}

function updateGroupKey(update) {
  const message = messageFromUpdate(update);
  const chatId = message?.chat?.id ?? 'unknown';
  if (message?.media_group_id) return `album:${chatId}:${message.media_group_id}`;
  return `single:${update.update_id}`;
}

function uniqueSlug(existingPosts, baseSlug) {
  const used = new Set(existingPosts.map((post) => post.slug).filter(Boolean));
  let slug = baseSlug;
  let index = 2;
  while (used.has(slug)) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }
  return slug;
}

function largestPhoto(message) {
  if (!Array.isArray(message?.photo) || message.photo.length === 0) return null;
  return [...message.photo].sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
}

function mediaRefsFromMessage(message) {
  const refs = [];
  const photo = largestPhoto(message);
  if (photo) refs.push({ fileId: photo.file_id, width: photo.width, height: photo.height, type: 'image' });

  if (message?.document?.mime_type?.startsWith('image/') && message.document.file_id) {
    refs.push({
      fileId: message.document.file_id,
      width: message.document.thumb?.width,
      height: message.document.thumb?.height,
      type: 'image'
    });
  }

  const video = message?.video || message?.animation;
  if (video && (!video.file_size || video.file_size <= 20 * 1024 * 1024)) {
    refs.push({
      fileId: video.file_id,
      width: video.width,
      height: video.height,
      type: 'video'
    });
  }

  return refs;
}

async function telegramFilePath(config, fileId) {
  const baseUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
  const response = await fetch(`${baseUrl}/bot${config.botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || 'Telegram file lookup failed');
  }
  return payload.result.file_path;
}

async function downloadTelegramMedia(config, ref, postId, index) {
  const filePath = await telegramFilePath(config, ref.fileId);
  const extension = path.extname(filePath) || (ref.type === 'video' ? '.mp4' : '.jpg');
  const safeName = `${postId}-${index + 1}${extension}`;
  const uploadDir = path.join(getRootDir(), 'public', 'uploads', 'telegram');
  const outputPath = path.join(uploadDir, safeName);
  const baseUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
  const url = `${baseUrl}/file/bot${config.botToken}/${filePath}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Telegram media download failed');

  await mkdir(uploadDir, { recursive: true });
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

  return {
    id: crypto.randomUUID(),
    type: ref.type,
    url: `/uploads/telegram/${safeName}`,
    source: 'telegram',
    sourceFileId: ref.fileId,
    width: ref.width || null,
    height: ref.height || null,
    isCover: index === 0,
    createdAt: new Date().toISOString()
  };
}

async function mediaFromUpdates(updates, config, postId) {
  if (!config?.botToken) return [];
  const refs = updates.flatMap((update) => mediaRefsFromMessage(messageFromUpdate(update)));
  const media = [];

  for (let index = 0; index < refs.length; index += 1) {
    media.push(await downloadTelegramMedia(config, refs[index], postId, index));
  }

  return media;
}

export async function telegramUpdateToPost(updateOrUpdates, siteId = 'main-site', options = {}) {
  const updates = Array.isArray(updateOrUpdates) ? updateOrUpdates : [updateOrUpdates];
  const messages = updates.map(messageFromUpdate).filter(Boolean);
  const text = messages.map(messageText).find((value) => value.trim()) || '';
  const hasMedia = messages.some((message) => mediaRefsFromMessage(message).length > 0);
  if (messages.length === 0 || (!text.trim() && !hasMedia)) return null;

  const id = crypto.randomUUID();
  const title = firstSentenceFrom(text, hasMedia ? 'Telegram media post' : 'Telegram post');
  const now = new Date().toISOString();
  const status = options.autoPublish ? 'published' : 'draft';
  const media = await mediaFromUpdates(updates, options.config, id);
  const videoMedia = media.find((m) => m.type === 'video');

  return {
    id,
    siteId,
    title,
    slug: slugify(title),
    excerpt: excerptFrom(text),
    content: text,
    status,
    tags: ['telegram'],
    source: 'telegram',
    sourceId: sourceIdFrom(updates[0]),
    media,
    coverImage: media.find((m) => m.type === 'image')?.url || null,
    videoUrl: videoMedia ? videoMedia.url : null,
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? now : null
  };
}

export async function testTelegram(config) {
  if (!config.botToken) {
    return { ok: false, message: 'Telegram bot token is empty.' };
  }

  const baseUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
  const response = await fetch(`${baseUrl}/bot${config.botToken}/getMe`);
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    return { ok: false, message: payload.description || 'Telegram API rejected the token.' };
  }

  return {
    ok: true,
    message: `Connected as @${payload.result.username}`,
    account: payload.result
  };
}

export async function importTelegramUpdates(config, existingPosts = []) {
  if (!config.botToken) {
    return { imported: [], nextUpdateId: config.lastUpdateId || 0, skipped: 'telegram_token_missing' };
  }

  const offset = Number(config.lastUpdateId || 0) + 1;
  const baseUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
  const url = new URL(`${baseUrl}/bot${config.botToken}/getUpdates`);
  if (offset > 1) url.searchParams.set('offset', String(offset));
  url.searchParams.set('allowed_updates', JSON.stringify(['message', 'channel_post', 'edited_channel_post', 'edited_message']));
  url.searchParams.set('timeout', '0');

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || 'Telegram import failed');
  }

  const existingSources = new Set(existingPosts.map((post) => post.sourceId).filter(Boolean));
  const imported = [];
  let nextUpdateId = Number(config.lastUpdateId || 0);
  const groups = new Map();

  for (const update of payload.result || []) {
    nextUpdateId = Math.max(nextUpdateId, update.update_id);
    if (!isAllowedChat(update, config.chatId)) continue;
    const key = updateGroupKey(update);
    groups.set(key, [...(groups.get(key) || []), update]);
  }

  for (const updates of groups.values()) {
    const post = await telegramUpdateToPost(updates, 'main-site', {
      autoPublish: Boolean(config.autoPublish),
      config
    });
    if (!post || existingSources.has(post.sourceId)) continue;
    post.slug = uniqueSlug([...existingPosts, ...imported], post.slug);
    imported.push(post);
    existingSources.add(post.sourceId);
  }

  return { imported, nextUpdateId };
}
