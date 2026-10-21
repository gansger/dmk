import { read, write } from '../core/store.js';
import { excerptFrom, slugify } from '../core/format.js';
import { pagePublicPath, postPublicPath } from '../services/seo.js';
import { sharedPageBlocks } from './pages.js';
import { clampNumber, normalizeImageFit } from './slider.js';

export function normalizePost(input, previous = {}) {
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

export function ensureUniqueSlug(posts, post) {
  const used = new Set(posts.filter((item) => item.id !== post.id).map((item) => item.slug));
  let slug = post.slug;
  let index = 2;
  while (used.has(slug)) {
    slug = `${post.slug}-${index}`;
    index += 1;
  }
  return { ...post, slug };
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function postPageId(post) {
  return `post-${slugify(post.slug || post.title || post.id)}`;
}

export function publicPost(post) {
  return {
    ...post,
    pageId: postPageId(post),
    pageUrl: postPublicPath(post)
  };
}

export function publishedPostForPage(posts, pageId) {
  return posts.find((post) => post.status === 'published' && postPageId(post) === pageId);
}

function formatPublishedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(date);
}

function googleDriveFileId(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return '';
    return url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] || '';
  } catch {
    return '';
  }
}

function generateVideoPlayer(url) {
  if (!url) return '';
  const fileId = googleDriveFileId(url);
  if (fileId) {
    return `
      <div style="position: relative; width: 100%; padding-top: 56.25%; border-radius: 8px; margin-bottom: 24px; overflow: hidden; background: #000;">
        <iframe src="https://drive.google.com/file/d/${escapeHtml(fileId)}/preview" style="position: absolute; top: -56px; left: 0; width: 100%; height: calc(100% + 56px); border: none;" allow="autoplay" allowfullscreen></iframe>
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

export function postPageFromPost(post, pages, previous = {}) {
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

export function ensurePublishedPostPages(posts, pages) {
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

export async function syncPublishedPostPages(posts) {
  const pages = await read('pages');
  if (ensurePublishedPostPages(posts, pages)) await write('pages', pages);
}
