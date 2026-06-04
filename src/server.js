import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appendEvent, ensureDataFiles, read, write } from './core/store.js';
import { getRootDir, withRuntimeSecrets } from './core/config.js';
import { excerptFrom, maskSecret, slugify } from './core/format.js';
import { readBody, routeParams, sendHtml, sendJson, sendNoContent, sendRedirect, sendText, serveFile, serveStatic } from './core/http.js';
import { createBitrixLead, testBitrix } from './integrations/bitrix.js';
import { importTelegramUpdates, telegramUpdateToPost, testTelegram } from './integrations/telegram.js';
import { askAssistant } from './services/assistant.js';
import {
  isGeneratedPostPage,
  pagePublicPath,
  postPublicPath,
  renderPublicSiteHtml,
  renderRobotsTxt,
  renderSitemapXml
} from './services/seo.js';
import {
  adminCredentialsConfigured,
  authenticateAdmin,
  changeAdminPassword,
  createAdminSession,
  expiredSessionCookie,
  revokeAdminSession,
  sessionCookie,
  sessionUser
} from './services/auth.js';
import { startTelegramScheduler } from './services/scheduler.js';

const rootDir = getRootDir();
const publicDir = path.join(rootDir, 'public');
const port = Number(process.env.PORT || 3003);
let publicSiteTemplate;
const loginAttempts = new Map();
const editorUploadMaxBytes = 8 * 1024 * 1024;
const editorUploadBodyMaxBytes = 12 * 1024 * 1024;
const editorUploadTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

const defaultSliderSettings = {
  enabled: true,
  autoplay: true,
  intervalMs: 6500,
  transitionMs: 450,
  showControls: true,
  showDots: true,
  pauseOnHover: true,
  maxItems: 6,
  imageFit: 'cover',
  imagePositionX: 50,
  imagePositionY: 50
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeImageFit(value, fallback = 'cover') {
  return ['cover', 'contain'].includes(value) ? value : fallback;
}

function normalizeSliderSettings(input = {}, previous = {}) {
  const base = { ...defaultSliderSettings, ...previous };
  return {
    enabled: Boolean(input.enabled ?? base.enabled),
    autoplay: Boolean(input.autoplay ?? base.autoplay),
    intervalMs: clampNumber(input.intervalMs ?? base.intervalMs, 1500, 60000, defaultSliderSettings.intervalMs),
    transitionMs: clampNumber(input.transitionMs ?? base.transitionMs, 100, 3000, defaultSliderSettings.transitionMs),
    showControls: Boolean(input.showControls ?? base.showControls),
    showDots: Boolean(input.showDots ?? base.showDots),
    pauseOnHover: Boolean(input.pauseOnHover ?? base.pauseOnHover),
    maxItems: clampNumber(input.maxItems ?? base.maxItems, 1, 20, defaultSliderSettings.maxItems),
    imageFit: normalizeImageFit(input.imageFit ?? base.imageFit, defaultSliderSettings.imageFit),
    imagePositionX: clampNumber(input.imagePositionX ?? base.imagePositionX, 0, 100, defaultSliderSettings.imagePositionX),
    imagePositionY: clampNumber(input.imagePositionY ?? base.imagePositionY, 0, 100, defaultSliderSettings.imagePositionY)
  };
}

function sanitizeIntegrations(integrations) {
  return {
    ...integrations,
    telegram: {
      ...integrations.telegram,
      botToken: maskSecret(integrations.telegram?.botToken),
      webhookSecret: maskSecret(integrations.telegram?.webhookSecret)
    },
    bitrix: {
      ...integrations.bitrix,
      webhookUrl: maskSecret(integrations.bitrix?.webhookUrl)
    },
    ai: {
      ...integrations.ai,
      apiKey: maskSecret(integrations.ai?.apiKey)
    }
  };
}

function mergeIntegrations(previous, next) {
  const merged = structuredClone(previous);
  for (const [group, value] of Object.entries(next || {})) {
    merged[group] = { ...(merged[group] || {}) };
    for (const [key, fieldValue] of Object.entries(value || {})) {
      if (
        (group === 'telegram' && ['botToken', 'webhookSecret'].includes(key)) ||
        (group === 'bitrix' && key === 'webhookUrl') ||
        (group === 'ai' && key === 'apiKey')
      ) {
        continue;
      }
      merged[group][key] = fieldValue;
    }
  }
  return merged;
}

function loginAttemptKey(request) {
  return request.socket.remoteAddress || 'unknown';
}

function canAttemptLogin(request) {
  const cutoff = Date.now() - 15 * 60 * 1000;
  const key = loginAttemptKey(request);
  const recent = (loginAttempts.get(key) || []).filter((timestamp) => timestamp > cutoff);
  loginAttempts.set(key, recent);
  return recent.length < 8;
}

function recordFailedLogin(request) {
  const key = loginAttemptKey(request);
  loginAttempts.set(key, [...(loginAttempts.get(key) || []), Date.now()]);
}

async function readJsonBodyWithLimit(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
}

function editorUploadExtension(mimeType) {
  return editorUploadTypes.get(String(mimeType || '').toLowerCase()) || '';
}

async function handleEditorImageUpload(request, response) {
  const body = await readJsonBodyWithLimit(request, editorUploadBodyMaxBytes);
  const dataUrl = String(body.data || '');
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]+)$/i);
  if (!match) {
    sendJson(response, 400, { error: 'Нужен файл изображения JPG, PNG, WebP или GIF.' });
    return true;
  }

  const mimeType = match[1].toLowerCase();
  const extension = editorUploadExtension(mimeType);
  const base64 = match[2].replace(/\s+/g, '');
  if (!extension || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
    sendJson(response, 400, { error: 'Некорректный файл изображения.' });
    return true;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    sendJson(response, 400, { error: 'Пустой файл изображения.' });
    return true;
  }
  if (buffer.length > editorUploadMaxBytes) {
    sendJson(response, 413, { error: 'Фото слишком большое. Максимум 8 МБ.' });
    return true;
  }

  const uploadDir = path.join(publicDir, 'uploads', 'editor');
  await mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  await writeFile(path.join(uploadDir, fileName), buffer);

  const url = `/uploads/editor/${fileName}`;
  await appendEvent('editor.image_uploaded', {
    url,
    name: String(body.name || 'image').slice(0, 140),
    size: buffer.length,
    type: mimeType
  });
  sendJson(response, 201, { url, name: body.name || fileName, size: buffer.length, type: mimeType });
  return true;
}

function clearFailedLogins(request) {
  loginAttempts.delete(loginAttemptKey(request));
}

function isPublicApi(method, pathname) {
  if (pathname.startsWith('/api/auth/')) return true;
  if (method === 'GET' && pathname === '/api/health') return true;
  if (method === 'GET' && pathname.startsWith('/api/public/')) return true;
  if (method === 'POST' && pathname === '/api/ai/assistant') return true;
  if (method === 'POST' && pathname === '/api/integrations/bitrix/lead') return true;
  if (method === 'POST' && pathname === '/api/integrations/telegram/webhook') return true;
  return false;
}

async function handleAuthApi(request, response, pathname, method) {
  if (method === 'GET' && pathname === '/api/auth/session') {
    const user = sessionUser(request);
    sendJson(response, user ? 200 : 401, user ? { authenticated: true, user } : { authenticated: false });
    return true;
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!adminCredentialsConfigured()) {
      sendJson(response, 503, { error: 'CMS admin credentials are not configured.' });
      return true;
    }
    if (!canAttemptLogin(request)) {
      sendJson(response, 429, { error: 'Too many login attempts. Try again later.' });
      return true;
    }

    const body = await readBody(request);
    if (!authenticateAdmin(body.username || '', body.password || '')) {
      recordFailedLogin(request);
      sendJson(response, 401, { error: 'Неверный логин или пароль.' });
      return true;
    }

    clearFailedLogins(request);
    const token = createAdminSession(body.username);
    await appendEvent('auth.login', { username: body.username });
    sendJson(response, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(token, request) });
    return true;
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const user = sessionUser(request);
    revokeAdminSession(request);
    if (user) await appendEvent('auth.logout', { username: user.username });
    sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': expiredSessionCookie(request) });
    return true;
  }

  if (method === 'POST' && pathname === '/api/auth/password') {
    const user = sessionUser(request);
    if (!user) {
      sendJson(response, 401, { error: 'Требуется авторизация администратора.' });
      return true;
    }

    const body = await readBody(request);
    if (body.password !== body.passwordConfirmation) {
      sendJson(response, 400, { error: 'Подтверждение нового пароля не совпадает.' });
      return true;
    }

    const result = changeAdminPassword(user.username, body.currentPassword || '', body.password || '');
    if (!result.ok) {
      sendJson(response, 400, { error: result.error });
      return true;
    }

    await appendEvent('auth.password_changed', { username: user.username });
    sendJson(response, 200, { changed: true }, { 'Set-Cookie': expiredSessionCookie(request) });
    return true;
  }

  return false;
}

function editRedirect(url) {
  const params = new URLSearchParams(url.searchParams);
  params.delete('edit');
  const query = params.toString();
  return `/edit${query ? `?${query}` : ''}`;
}

async function getPublicSiteTemplate() {
  publicSiteTemplate ||= readFile(path.join(publicDir, 'site.html'), 'utf8');
  return publicSiteTemplate;
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function pageIdFromPath(pathname) {
  const match = pathname.match(/^\/([^/]+)\/?$/);
  return match ? decodePathSegment(match[1]) : '';
}

function postSlugFromPath(pathname) {
  const match = pathname.match(/^\/news\/([^/]+)\/?$/);
  return match ? decodePathSegment(match[1]) : '';
}

function publishedPostForPage(posts, pageId) {
  return posts.find((post) => post.status === 'published' && postPageId(post) === pageId);
}

function isLikelyPublicDocumentPath(pathname) {
  return !path.extname(pathname) && !pathname.startsWith('/uploads/');
}

async function publicCollections() {
  const [pages, posts] = await Promise.all([read('pages'), read('posts')]);
  if (ensurePublishedPostPages(posts, pages)) await write('pages', pages);
  return { pages, posts };
}

async function serveRenderedPublicSite(request, response, { page, pages, posts, post = null, statusCode = 200, canonicalPath }) {
  const rendered = renderPublicSiteHtml({
    template: await getPublicSiteTemplate(),
    request,
    page,
    pages,
    posts,
    post,
    statusCode,
    canonicalPath
  });
  sendHtml(response, statusCode, rendered.html, {
    'Cache-Control': 'public, max-age=60',
    ...(rendered.noIndex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {})
  });
  return true;
}

async function handleAppRoute(request, response, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;

  if (url.pathname === '/robots.txt') {
    sendText(response, 200, renderRobotsTxt(request), { 'Cache-Control': 'public, max-age=3600' });
    return true;
  }

  if (url.pathname === '/sitemap.xml') {
    const { pages, posts } = await publicCollections();
    sendText(response, 200, renderSitemapXml({ request, pages, posts }), {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    });
    return true;
  }

  if (url.pathname === '/index.html') {
    sendRedirect(response, '/admin');
    return true;
  }
  if (url.pathname === '/site.html' && url.searchParams.get('edit') === '1') {
    sendRedirect(response, editRedirect(url));
    return true;
  }
  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    return serveFile(response, publicDir, sessionUser(request) ? 'index.html' : 'login.html');
  }
  if (url.pathname === '/edit' || url.pathname === '/edit/') {
    if (!sessionUser(request)) {
      sendRedirect(response, `/admin?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
      return true;
    }
    return serveFile(response, publicDir, 'site.html');
  }

  if (url.pathname !== '/' && url.pathname !== '/site.html' && !isLikelyPublicDocumentPath(url.pathname)) {
    return false;
  }

  const { pages, posts } = await publicCollections();
  const legacyPostSlug = url.searchParams.get('post');
  const legacyPageId = url.searchParams.get('page');

  if ((url.pathname === '/' || url.pathname === '/site.html') && legacyPostSlug) {
    const post = posts.find((item) => item.status === 'published' && item.slug === legacyPostSlug);
    sendRedirect(response, post ? postPublicPath(post) : `/news/${encodeURIComponent(legacyPostSlug)}`, 301);
    return true;
  }

  if ((url.pathname === '/' || url.pathname === '/site.html') && legacyPageId) {
    const post = publishedPostForPage(posts, legacyPageId);
    sendRedirect(response, post ? postPublicPath(post) : pagePublicPath(legacyPageId), 301);
    return true;
  }

  if (url.pathname === '/site.html') {
    sendRedirect(response, '/', 301);
    return true;
  }

  if (url.pathname === '/') {
    const page = pages.home || { id: 'home', title: 'Главная', blocks: [] };
    return serveRenderedPublicSite(request, response, { page, pages, posts });
  }

  const postSlug = postSlugFromPath(url.pathname);
  if (postSlug) {
    const post = posts.find((item) => item.status === 'published' && item.slug === postSlug);
    if (post) {
      const page = pages[postPageId(post)] || postPageFromPost(post, pages);
      return serveRenderedPublicSite(request, response, { page, pages, posts, post });
    }
  }

  const pageId = pageIdFromPath(url.pathname);
  if (pageId) {
    const post = publishedPostForPage(posts, pageId);
    if (post) {
      sendRedirect(response, postPublicPath(post), 301);
      return true;
    }

    const page = pages[pageId];
    if (page && !isGeneratedPostPage(page)) {
      return serveRenderedPublicSite(request, response, { page, pages, posts });
    }
  }

  if (isLikelyPublicDocumentPath(url.pathname)) {
    const page = {
      id: 'not-found',
      title: 'Страница не найдена',
      seo: { noIndex: true },
      blocks: []
    };
    return serveRenderedPublicSite(request, response, {
      page,
      pages,
      posts,
      statusCode: 404,
      canonicalPath: url.pathname
    });
  }

  return false;
}

function normalizePost(input, previous = {}) {
  const now = new Date().toISOString();
  const title = String(input.title || previous.title || 'Untitled post').trim();
  const content = String(input.content || previous.content || '').trim();
  const slug = input.slug ? slugify(input.slug) : previous.slug || slugify(title);

  return {
    id: previous.id || crypto.randomUUID(),
    siteId: input.siteId || previous.siteId || 'main-site',
    title,
    slug,
    excerpt: String(input.excerpt || previous.excerpt || excerptFrom(content)).trim(),
    seoTitle: String(input.seoTitle ?? previous.seoTitle ?? '').trim().slice(0, 180),
    seoDescription: String(input.seoDescription ?? previous.seoDescription ?? '').trim().slice(0, 500),
    noIndex: Boolean(input.noIndex ?? previous.noIndex ?? false),
    content,
    status: input.status || previous.status || 'draft',
    tags: Array.isArray(input.tags) ? input.tags : previous.tags || [],
    source: input.source || previous.source || 'manual',
    sourceId: input.sourceId || previous.sourceId || null,
    videoUrl: input.videoUrl ?? previous.videoUrl ?? null,
    media: Array.isArray(input.media) ? input.media : previous.media || [],
    coverImage: input.coverImage ?? previous.coverImage ?? null,
    showInSlider: input.showInSlider ?? previous.showInSlider ?? false,
    sliderOrder: Number(input.sliderOrder ?? previous.sliderOrder ?? 0),
    sliderImageFit: normalizeImageFit(input.sliderImageFit ?? previous.sliderImageFit, ''),
    sliderImagePositionX: clampNumber(input.sliderImagePositionX ?? previous.sliderImagePositionX, 0, 100, 50),
    sliderImagePositionY: clampNumber(input.sliderImagePositionY ?? previous.sliderImagePositionY, 0, 100, 50),
    createdAt: previous.createdAt || now,
    updatedAt: now,
    publishedAt: input.publishedAt ?? previous.publishedAt ?? null
  };
}

function normalizeGalleryItem(input = {}, previous = {}) {
  const now = new Date().toISOString();
  const url = String(input.url ?? previous.url ?? '').trim().slice(0, 2000);
  return {
    id: previous.id || crypto.randomUUID(),
    url,
    caption: String(input.caption ?? previous.caption ?? '').trim().slice(0, 220),
    alt: String(input.alt ?? previous.alt ?? input.caption ?? previous.caption ?? '').trim().slice(0, 220),
    order: clampNumber(input.order ?? previous.order, 0, 10000, 0),
    enabled: Boolean(input.enabled ?? previous.enabled ?? true),
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

function sortedGalleryItems(items = []) {
  return [...items].sort(
    (a, b) =>
      Number(a.order || 0) - Number(b.order || 0) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}

function ensureUniqueSlug(posts, post) {
  const used = new Set(posts.filter((item) => item.id !== post.id).map((item) => item.slug));
  let slug = post.slug;
  let index = 2;
  while (used.has(slug)) {
    slug = `${post.slug}-${index}`;
    index += 1;
  }
  return { ...post, slug };
}

function sliderPosts(posts, settings = defaultSliderSettings) {
  if (!settings.enabled) return [];
  return posts
    .filter((post) => post.status === 'published' && post.showInSlider)
    .sort((a, b) => Number(a.sliderOrder || 0) - Number(b.sliderOrder || 0) || String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, settings.maxItems);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function postPageId(post) {
  return `post-${slugify(post.slug || post.title || post.id)}`;
}

function postPageUrl(post) {
  return postPublicPath(post);
}

function publicPost(post) {
  return {
    ...post,
    pageId: postPageId(post),
    pageUrl: postPageUrl(post)
  };
}

function formatPublishedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(date);
}

function cloneBlock(block) {
  return block ? JSON.parse(JSON.stringify(block)) : null;
}

const sharedLayoutBlockTypes = ['headerNav', 'sideMenu', 'footer'];

function sharedPageBlocks(pages, previous = {}) {
  const homeBlocks = Array.isArray(pages.home?.blocks) ? pages.home.blocks : [];
  const previousBlocks = Array.isArray(previous.blocks) ? previous.blocks : [];
  return sharedLayoutBlockTypes
    .map((type) => cloneBlock(homeBlocks.find((block) => block.type === type) || previousBlocks.find((block) => block.type === type)))
    .filter(Boolean);
}

function pageWithSharedLayout(page, pages) {
  if (!page || page.id === 'home') return page;

  const sharedBlocks = sharedPageBlocks(pages, page);
  if (!sharedBlocks.length) return page;

  const sharedTypes = new Set(sharedLayoutBlockTypes);
  const pageBlocks = Array.isArray(page.blocks) ? page.blocks : [];
  return {
    ...page,
    blocks: [
      ...sharedBlocks,
      ...pageBlocks.filter((block) => !sharedTypes.has(block.type))
    ]
  };
}

function syncSharedLayoutBlocks(pages) {
  if (!pages.home) return false;

  let changed = false;
  for (const [id, page] of Object.entries(pages)) {
    if (id === 'home') continue;
    const nextPage = pageWithSharedLayout(page, pages);
    if (JSON.stringify(page) !== JSON.stringify(nextPage)) {
      pages[id] = nextPage;
      changed = true;
    }
  }
  return changed;
}

function generateVideoPlayer(url) {
  if (!url) return '';
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `
      <div style="position: relative; width: 100%; padding-top: 56.25%; border-radius: 8px; margin-bottom: 24px; overflow: hidden; background: #000;">
        <iframe src="https://drive.google.com/file/d/${fileId}/preview" style="position: absolute; top: -56px; left: 0; width: 100%; height: calc(100% + 56px); border: none;" allow="autoplay" allowfullscreen></iframe>
      </div>
    `;
  }
  const style = "width: 100%; aspect-ratio: 16/9; border: none; border-radius: 8px; margin-bottom: 24px; display: block; background: #000;";
  return `<video controls class="post-video" src="${escapeHtml(url)}" style="${style}"></video>`;
}

function postDetailHtml(post) {
  const images = (post.media || []).filter((item) => item.type === 'image' && item.url);
  const cover = post.coverImage || images[0]?.url || '';
  const gallery = images.filter((item) => item.url !== cover);

  return `
    <article class="post-detail">
      <a class="read-link" href="${pagePublicPath('novosti')}">Назад к новостям</a>
      <p class="eyebrow">${escapeHtml(formatPublishedDate(post.publishedAt))}</p>
      <h2>${escapeHtml(post.title)}</h2>
      ${cover ? `<img class="post-cover" src="${escapeHtml(cover)}" alt="">` : ''}
      ${generateVideoPlayer(post.videoUrl)}
      <div class="post-body">${escapeHtml(post.content).replaceAll('\n', '<br>')}</div>
      ${
        gallery.length
          ? `<div class="post-gallery">${gallery.map((item) => `<img src="${escapeHtml(item.url)}" alt="">`).join('')}</div>`
          : ''
      }
    </article>
  `;
}

function postPageFromPost(post, pages, previous = {}) {
  return {
    id: postPageId(post),
    title: post.title,
    updatedAt: post.updatedAt || previous.updatedAt || new Date().toISOString(),
    seo: {
      title: post.seoTitle || previous.seo?.title || '',
      description: post.seoDescription || post.excerpt || previous.seo?.description || '',
      image: post.coverImage || previous.seo?.image || '',
      noIndex: Boolean(post.noIndex)
    },
    blocks: [
      ...sharedPageBlocks(pages, previous),
      {
        id: 'slider',
        type: 'slider',
        enabled: false,
        order: 10,
        fields: {
          labelHtml: 'Избранное',
          buttonHtml: 'Открыть пост',
          styles: { maxWidth: 2400, align: 'center', borderRadius: 0, height: 0 }
        }
      },
      {
        id: 'posts',
        type: 'posts',
        enabled: false,
        order: 20,
        fields: {}
      },
      {
        id: `post-content-${post.id}`,
        type: 'text',
        enabled: true,
        order: 30,
        fields: {
          generatedFromPostId: post.id,
          html: postDetailHtml(post),
          styles: {
            backgroundColor: '#ffffff',
            textColor: '#18202f',
            fontSize: 16,
            padding: 22,
            borderRadius: 0,
            maxWidth: 1060,
            height: 0
          }
        }
      }
    ]
  };
}

function ensurePublishedPostPages(posts, pages) {
  let changed = false;
  for (const post of posts.filter((item) => item.status === 'published')) {
    const id = postPageId(post);
    const nextPage = postPageFromPost(post, pages, pages[id]);
    if (JSON.stringify(pages[id]) !== JSON.stringify(nextPage)) {
      pages[id] = nextPage;
      changed = true;
    }
  }
  return changed;
}

async function syncPublishedPostPages(posts) {
  const pages = await read('pages');
  if (ensurePublishedPostPages(posts, pages)) await write('pages', pages);
}

function normalizePageSeo(input = {}, previous = {}) {
  return {
    title: String(input.title ?? previous.title ?? '').trim().slice(0, 180),
    description: String(input.description ?? previous.description ?? '').trim().slice(0, 500),
    image: String(input.image ?? previous.image ?? '').trim().slice(0, 2000),
    noIndex: Boolean(input.noIndex ?? previous.noIndex ?? false)
  };
}

function normalizePage(input = {}, previous = {}) {
  const previousBlocks = Array.isArray(previous.blocks) ? previous.blocks : [];
  const inputBlocks = Array.isArray(input.blocks) ? input.blocks : previousBlocks;

  return {
    id: input.id || previous.id || 'home',
    title: input.title || previous.title || 'Page',
    updatedAt: new Date().toISOString(),
    seo: normalizePageSeo(input.seo, previous.seo),
    blocks: inputBlocks.map((block, index) => {
      const previousBlock = previousBlocks.find((item) => item.id === block.id) || {};
      return {
        id: block.id || crypto.randomUUID(),
        type: block.type || previousBlock.type || 'text',
        enabled: block.enabled ?? previousBlock.enabled ?? true,
        order: Number(block.order ?? previousBlock.order ?? index * 10),
        fields: {
          ...(previousBlock.fields || {}),
          ...(block.fields || {})
        }
      };
    })
  };
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;
  const method = request.method || 'GET';

  if (method === 'GET' && pathname === '/api/health') {
    sendJson(response, 200, { ok: true, name: 'CMS Engine Starter', version: '0.1.0' });
    return true;
  }

  if (method === 'GET' && pathname === '/api/dashboard') {
    const [posts, integrations, knowledge, events, gallery] = await Promise.all([
      read('posts'),
      read('integrations'),
      read('knowledge'),
      read('events'),
      read('gallery')
    ]);
    sendJson(response, 200, {
      totals: {
        posts: posts.length,
        published: posts.filter((post) => post.status === 'published').length,
        drafts: posts.filter((post) => post.status === 'draft').length,
        slider: posts.filter((post) => post.showInSlider).length,
        gallery: gallery.length,
        knowledge: knowledge.length
      },
      integrations: {
        telegram: Boolean(integrations.telegram?.enabled),
        bitrix: Boolean(integrations.bitrix?.enabled),
        ai: Boolean(integrations.ai?.enabled)
      },
      events: events.slice(0, 8)
    });
    return true;
  }

  if (method === 'POST' && pathname === '/api/uploads/images') {
    return handleEditorImageUpload(request, response);
  }

  if (method === 'GET' && pathname === '/api/gallery') {
    sendJson(response, 200, sortedGalleryItems(await read('gallery')));
    return true;
  }

  if (method === 'POST' && pathname === '/api/gallery') {
    const body = await readBody(request);
    const gallery = await read('gallery');
    const item = normalizeGalleryItem(body);
    if (!item.url) {
      sendJson(response, 400, { error: 'Загрузите фото для галереи.' });
      return true;
    }
    const nextGallery = sortedGalleryItems([item, ...gallery]);
    await write('gallery', nextGallery);
    await appendEvent('gallery.created', { id: item.id, caption: item.caption });
    sendJson(response, 201, item);
    return true;
  }

  let galleryParams = routeParams('/api/gallery/:id', pathname);
  if (galleryParams && method === 'PUT') {
    const body = await readBody(request);
    const gallery = await read('gallery');
    const index = gallery.findIndex((item) => item.id === galleryParams.id);
    if (index === -1) {
      sendJson(response, 404, { error: 'Фото не найдено' });
      return true;
    }
    const item = normalizeGalleryItem(body, gallery[index]);
    if (!item.url) {
      sendJson(response, 400, { error: 'Загрузите фото для галереи.' });
      return true;
    }
    gallery[index] = item;
    await write('gallery', sortedGalleryItems(gallery));
    await appendEvent('gallery.updated', { id: item.id, caption: item.caption });
    sendJson(response, 200, item);
    return true;
  }

  if (galleryParams && method === 'DELETE') {
    const gallery = await read('gallery');
    const nextGallery = gallery.filter((item) => item.id !== galleryParams.id);
    if (nextGallery.length === gallery.length) {
      sendJson(response, 404, { error: 'Фото не найдено' });
      return true;
    }
    await write('gallery', nextGallery);
    await appendEvent('gallery.deleted', { id: galleryParams.id });
    sendNoContent(response);
    return true;
  }

  if (method === 'GET' && pathname === '/api/posts') {
    sendJson(response, 200, await read('posts'));
    return true;
  }

  if (method === 'GET' && pathname === '/api/pages') {
    const pages = await read('pages');
    sendJson(
      response,
      200,
      Object.values(pages)
        .map((page) => ({
          id: page.id,
          title: page.title,
          updatedAt: page.updatedAt
        }))
        .sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'))
    );
    return true;
  }

  let params = routeParams('/api/pages/:id', pathname);
  if (params && method === 'GET') {
    const pages = await read('pages');
    const page = pages[params.id];
    if (!page) {
      sendJson(response, 404, { error: 'Page not found' });
      return true;
    }
    sendJson(response, 200, pageWithSharedLayout(page, pages));
    return true;
  }

  if (params && method === 'POST') {
    const body = await readBody(request);
    const pages = await read('pages');
    const page = normalizePage({ ...body, id: params.id }, pages[params.id]);
    pages[params.id] = page;
    if (page.id === 'home') syncSharedLayoutBlocks(pages);
    await write('pages', pages);
    await appendEvent('page.updated', { id: page.id, title: page.title });
    sendJson(response, 200, pageWithSharedLayout(page, pages));
    return true;
  }

  if (params && method === 'DELETE') {
    if (params.id === 'home') {
      sendJson(response, 400, { error: 'Cannot delete home page' });
      return true;
    }
    const pages = await read('pages');
    if (pages[params.id]) {
      delete pages[params.id];
      await write('pages', pages);
      await appendEvent('page.deleted', { id: params.id });
    }
    sendJson(response, 200, { success: true });
    return true;
  }

  if (method === 'GET' && pathname === '/api/slider/settings') {
    const settings = await read('settings');
    sendJson(response, 200, normalizeSliderSettings({}, settings.slider));
    return true;
  }

  if (method === 'POST' && pathname === '/api/slider/settings') {
    const body = await readBody(request);
    const settings = await read('settings');
    settings.slider = normalizeSliderSettings(body, settings.slider);
    await write('settings', settings);
    await appendEvent('slider.settings_updated', settings.slider);
    sendJson(response, 200, settings.slider);
    return true;
  }

  if (method === 'POST' && pathname === '/api/posts') {
    const body = await readBody(request);
    const posts = await read('posts');
    const post = ensureUniqueSlug(posts, normalizePost(body));
    const nextPosts = [post, ...posts];
    await write('posts', nextPosts);
    await syncPublishedPostPages(nextPosts);
    await appendEvent('post.created', { id: post.id, title: post.title });
    sendJson(response, 201, post);
    return true;
  }

  params = routeParams('/api/posts/:id', pathname);
  if (params && method === 'PUT') {
    const body = await readBody(request);
    const posts = await read('posts');
    const index = posts.findIndex((post) => post.id === params.id);
    if (index === -1) {
      sendJson(response, 404, { error: 'Post not found' });
      return true;
    }
    const nextPost = ensureUniqueSlug(posts, normalizePost(body, posts[index]));
    posts[index] = nextPost;
    await write('posts', posts);
    await syncPublishedPostPages(posts);
    await appendEvent('post.updated', { id: nextPost.id, title: nextPost.title });
    sendJson(response, 200, nextPost);
    return true;
  }

  if (params && method === 'DELETE') {
    const posts = await read('posts');
    const deletedPost = posts.find((post) => post.id === params.id);
    const nextPosts = posts.filter((post) => post.id !== params.id);
    if (nextPosts.length === posts.length) {
      sendJson(response, 404, { error: 'Post not found' });
      return true;
    }
    await write('posts', nextPosts);
    if (deletedPost) {
      const pages = await read('pages');
      delete pages[postPageId(deletedPost)];
      await write('pages', pages);
    }
    await appendEvent('post.deleted', { id: params.id });
    sendNoContent(response);
    return true;
  }

  params = routeParams('/api/posts/:id/publish', pathname);
  if (params && method === 'POST') {
    const posts = await read('posts');
    const post = posts.find((item) => item.id === params.id);
    if (!post) {
      sendJson(response, 404, { error: 'Post not found' });
      return true;
    }
    post.status = 'published';
    post.publishedAt = new Date().toISOString();
    post.updatedAt = post.publishedAt;
    await write('posts', posts);
    await syncPublishedPostPages(posts);
    await appendEvent('post.published', { id: post.id, title: post.title });
    sendJson(response, 200, post);
    return true;
  }

  params = routeParams('/api/posts/:id/slider', pathname);
  if (params && method === 'POST') {
    const body = await readBody(request);
    const posts = await read('posts');
    const post = posts.find((item) => item.id === params.id);
    if (!post) {
      sendJson(response, 404, { error: 'Post not found' });
      return true;
    }
    post.showInSlider = body.showInSlider ?? !post.showInSlider;
    post.sliderOrder = Number(body.sliderOrder ?? post.sliderOrder ?? 0);
    post.sliderImageFit = normalizeImageFit(body.sliderImageFit ?? post.sliderImageFit, post.sliderImageFit || '');
    post.sliderImagePositionX = clampNumber(body.sliderImagePositionX ?? post.sliderImagePositionX, 0, 100, 50);
    post.sliderImagePositionY = clampNumber(body.sliderImagePositionY ?? post.sliderImagePositionY, 0, 100, 50);
    post.updatedAt = new Date().toISOString();
    await write('posts', posts);
    await appendEvent('post.slider_updated', { id: post.id, title: post.title, showInSlider: post.showInSlider });
    sendJson(response, 200, post);
    return true;
  }

  if (method === 'POST' && pathname === '/api/slider/reorder') {
    const body = await readBody(request);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const orderMap = new Map(ids.map((id, index) => [id, index * 10]));
    const posts = await read('posts');
    for (const post of posts) {
      if (orderMap.has(post.id)) {
        post.showInSlider = true;
        post.sliderOrder = orderMap.get(post.id);
        post.updatedAt = new Date().toISOString();
      }
    }
    await write('posts', posts);
    await appendEvent('slider.reordered', { count: ids.length });
    sendJson(response, 200, sliderPosts(posts, defaultSliderSettings));
    return true;
  }

  if (method === 'GET' && pathname === '/api/public/posts') {
    const [posts, pages] = await Promise.all([read('posts'), read('pages')]);
    if (ensurePublishedPostPages(posts, pages)) await write('pages', pages);
    sendJson(
      response,
      200,
      posts
        .filter((post) => post.status === 'published')
        .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
        .map(publicPost)
    );
    return true;
  }

  if (method === 'GET' && pathname === '/api/public/slider') {
    const [posts, settings] = await Promise.all([read('posts'), read('settings')]);
    const slider = normalizeSliderSettings({}, settings.slider);
    sendJson(response, 200, {
      settings: slider,
      posts: sliderPosts(posts, slider).map(publicPost)
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/public/gallery') {
    sendJson(
      response,
      200,
      sortedGalleryItems(await read('gallery')).filter((item) => item.enabled && item.url)
    );
    return true;
  }

  params = routeParams('/api/public/page/:id', pathname);
  if (params && method === 'GET') {
    const [posts, pages] = await Promise.all([read('posts'), read('pages')]);
    if (ensurePublishedPostPages(posts, pages)) await write('pages', pages);
    const page = pages[params.id];
    if (!page) {
      sendJson(response, 404, { error: 'Page not found' });
      return true;
    }
    sendJson(response, 200, pageWithSharedLayout(page, pages));
    return true;
  }

  params = routeParams('/api/public/posts/:slug', pathname);
  if (params && method === 'GET') {
    const posts = await read('posts');
    const post = posts.find((item) => item.status === 'published' && item.slug === params.slug);
    if (!post) {
      sendJson(response, 404, { error: 'Post not found' });
      return true;
    }
    sendJson(response, 200, post);
    return true;
  }

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

  params = routeParams('/api/integrations/:name/test', pathname);
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

  if (method === 'POST' && pathname === '/api/integrations/bitrix/lead') {
    const integrations = withRuntimeSecrets(await read('integrations'));
    if (!integrations.bitrix?.enabled) {
      sendJson(response, 503, { error: 'Bitrix integration is disabled' });
      return true;
    }
    const body = await readBody(request);
    const leadId = await createBitrixLead(integrations.bitrix, body);
    await appendEvent('bitrix.lead_created', { leadId });
    sendJson(response, 201, { leadId });
    return true;
  }

  if (method === 'POST' && pathname === '/api/ai/assistant') {
    const body = await readBody(request);
    const integrations = withRuntimeSecrets(await read('integrations'));
    const result = await askAssistant({
      config: integrations.ai,
      knowledge: await read('knowledge'),
      memory: await read('memory'),
      message: body.message || '',
      visitorId: body.visitorId || 'anonymous'
    });
    await appendEvent('ai.assistant_message', { mode: result.mode, visitorId: body.visitorId || 'anonymous' });
    sendJson(response, 200, result);
    return true;
  }

  if (method === 'GET' && pathname === '/api/knowledge') {
    sendJson(response, 200, await read('knowledge'));
    return true;
  }

  if (method === 'POST' && pathname === '/api/knowledge') {
    const body = await readBody(request);
    const knowledge = await read('knowledge');
    const record = {
      id: crypto.randomUUID(),
      title: body.title || 'Knowledge record',
      kind: body.kind || 'note',
      tags: Array.isArray(body.tags) ? body.tags : [],
      content: body.content || '',
      updatedAt: new Date().toISOString()
    };
    await write('knowledge', [record, ...knowledge]);
    await appendEvent('knowledge.created', { id: record.id, title: record.title });
    sendJson(response, 201, record);
    return true;
  }

  params = routeParams('/api/knowledge/:id', pathname);
  if (params && method === 'PUT') {
    const body = await readBody(request);
    const knowledge = await read('knowledge');
    const record = knowledge.find((item) => item.id === params.id);
    if (!record) {
      sendJson(response, 404, { error: 'Knowledge record not found' });
      return true;
    }
    Object.assign(record, {
      title: body.title ?? record.title,
      kind: body.kind ?? record.kind,
      tags: Array.isArray(body.tags) ? body.tags : record.tags,
      content: body.content ?? record.content,
      updatedAt: new Date().toISOString()
    });
    await write('knowledge', knowledge);
    await appendEvent('knowledge.updated', { id: record.id, title: record.title });
    sendJson(response, 200, record);
    return true;
  }

  if (params && method === 'DELETE') {
    const knowledge = await read('knowledge');
    await write('knowledge', knowledge.filter((item) => item.id !== params.id));
    await appendEvent('knowledge.deleted', { id: params.id });
    sendNoContent(response);
    return true;
  }

  if (method === 'GET' && pathname === '/api/memory') {
    sendJson(response, 200, await read('memory'));
    return true;
  }

  if (method === 'POST' && pathname === '/api/memory') {
    const body = await readBody(request);
    const memory = await read('memory');
    const record = {
      id: crypto.randomUUID(),
      type: body.type || 'note',
      scope: body.scope || 'engine',
      key: body.key || 'memory',
      value: body.value || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await write('memory', [record, ...memory]);
    await appendEvent('memory.created', { id: record.id, key: record.key });
    sendJson(response, 201, record);
    return true;
  }

  return false;
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.url.startsWith('/api/')) {
      const method = request.method || 'GET';
      if (await handleAuthApi(request, response, url.pathname, method)) return;
      if (!isPublicApi(method, url.pathname) && !sessionUser(request)) {
        sendJson(response, 401, { error: 'Требуется авторизация администратора.' });
        return;
      }
      const handled = await handleApi(request, response);
      if (!handled) sendJson(response, 404, { error: 'API route not found' });
      return;
    }

    if (await handleAppRoute(request, response, url)) return;
    const served = await serveStatic(request, response, publicDir);
    if (!served) sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(response, statusCode, { error: error.message || 'Server error' });
  }
}

await ensureDataFiles();
startTelegramScheduler();

http.createServer(handleRequest).listen(port, () => {
  console.log(`CMS Engine Starter is running at http://localhost:${port}`);
});
