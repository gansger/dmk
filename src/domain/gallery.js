import { postPublicPath } from '../services/seo.js';
import { clampNumber } from './slider.js';

// The "gallery" collection is the site's media library: one record per photo,
// whether it was uploaded to the library or came with a news post (admin or
// Telegram). Files are stored once; a post photo's record points to the same
// file as the post. The public gallery is the library's visible photos.

function safeDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

export function normalizeGalleryItem(input = {}, previous = {}) {
  const now = new Date().toISOString();
  const url = String(input.url ?? previous.url ?? '').trim().slice(0, 2000);
  return {
    id: previous.id || crypto.randomUUID(),
    url,
    // Small copy for grids; the full photo opens in the viewer.
    thumbUrl: String(input.thumbUrl ?? previous.thumbUrl ?? '').trim().slice(0, 2000),
    width: safeDimension(input.width ?? previous.width),
    height: safeDimension(input.height ?? previous.height),
    caption: String(input.caption ?? previous.caption ?? '').trim().slice(0, 220),
    alt: String(input.alt ?? previous.alt ?? input.caption ?? previous.caption ?? '').trim().slice(0, 220),
    order: clampNumber(input.order ?? previous.order, 0, 10000, 0),
    // "Show in gallery". Post photos can be hidden here without touching the post.
    enabled: Boolean(input.enabled ?? previous.enabled ?? true),
    source: previous.source || (input.source === 'post' ? 'post' : 'upload'),
    postId: previous.postId ?? (input.source === 'post' ? input.postId : null) ?? null,
    takenAt: input.takenAt ?? previous.takenAt ?? previous.createdAt ?? now,
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

// Newest first, like the photo app on a phone.
export function sortedGalleryItems(items = []) {
  return [...items].sort(
    (a, b) =>
      String(b.takenAt || b.createdAt || '').localeCompare(String(a.takenAt || a.createdAt || '')) ||
      Number(a.order || 0) - Number(b.order || 0)
  );
}

function postPhotos(post) {
  const photos = (post.media || [])
    .filter((item) => item?.type === 'image' && item.url)
    .map((item) => ({ url: item.url, thumbUrl: item.thumbUrl || '', width: item.width, height: item.height }));
  if (post.coverImage && !photos.some((photo) => photo.url === post.coverImage)) {
    photos.unshift({ url: post.coverImage, thumbUrl: '' });
  }
  return photos;
}

// Keeps the library in step with news posts: adds records for new post photos,
// drops records of photos that were removed from their post or whose post was
// deleted. Settings changed in the library (caption, hidden) are kept.
export function syncPostPhotos(posts = [], items = []) {
  const wanted = new Map();
  for (const post of posts) {
    for (const photo of postPhotos(post)) {
      if (!wanted.has(photo.url)) wanted.set(photo.url, { post, photo });
    }
  }

  let changed = false;
  const kept = items.filter((item) => {
    if (item.source !== 'post') return true;
    const entry = wanted.get(item.url);
    if (entry && entry.post.id === item.postId) return true;
    changed = true;
    return false;
  });

  const known = new Set(kept.map((item) => item.url));
  for (const [url, { post, photo }] of wanted) {
    if (known.has(url)) continue;
    kept.push(
      normalizeGalleryItem({
        url,
        thumbUrl: photo.thumbUrl,
        width: photo.width,
        height: photo.height,
        caption: post.title,
        alt: post.title,
        source: 'post',
        postId: post.id,
        takenAt: post.publishedAt || post.createdAt
      })
    );
    changed = true;
  }

  return { items: changed ? sortedGalleryItems(kept) : items, changed };
}

// What visitors see: shown photos whose post (if any) is published, with a
// link to that post for the viewer.
export function publicGalleryItems(items = [], posts = []) {
  const published = new Map(posts.filter((post) => post.status === 'published').map((post) => [post.id, post]));
  return sortedGalleryItems(items)
    .filter((item) => item.enabled && item.url && (!item.postId || published.has(item.postId)))
    .map((item) => {
      const post = item.postId ? published.get(item.postId) : null;
      return {
        id: item.id,
        url: item.url,
        thumbUrl: item.thumbUrl || item.url,
        width: item.width,
        height: item.height,
        caption: item.caption,
        alt: item.alt || item.caption || post?.title || 'Фото',
        takenAt: item.takenAt || item.createdAt,
        postTitle: post?.title || null,
        postUrl: post ? postPublicPath(post) : null
      };
    });
}

// Library listing for the admin, with the post each photo belongs to.
export function adminGalleryItems(items = [], posts = []) {
  const byId = new Map(posts.map((post) => [post.id, post]));
  return sortedGalleryItems(items).map((item) => {
    const post = item.postId ? byId.get(item.postId) : null;
    return { ...item, postTitle: post?.title || null, postStatus: post?.status || null };
  });
}
