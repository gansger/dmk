import { appendEvent, read, write } from '../core/store.js';
import { readBody, routeParams, sendJson, sendNoContent } from '../core/http.js';
import { adminGalleryItems, normalizeGalleryItem, publicGalleryItems, sortedGalleryItems } from '../domain/gallery.js';

// Media library ("gallery" collection) and the public photo gallery.
export async function handleGalleryApi({ request, response, url, method, pathname }) {
  if (method === 'GET' && pathname === '/api/gallery') {
    const [gallery, posts] = await Promise.all([read('gallery'), read('posts')]);
    sendJson(response, 200, adminGalleryItems(gallery, posts));
    return true;
  }

  if (method === 'GET' && pathname === '/api/public/gallery') {
    const [gallery, posts] = await Promise.all([read('gallery'), read('posts')]);
    const items = publicGalleryItems(gallery, posts);
    const limit = Number(url.searchParams.get('limit') || 0);
    sendJson(response, 200, limit > 0 ? items.slice(0, limit) : items);
    return true;
  }

  if (method === 'POST' && pathname === '/api/gallery') {
    const body = await readBody(request);
    const gallery = await read('gallery');
    // Uploads only; post photos enter the library through their post.
    const item = normalizeGalleryItem({ ...body, source: 'upload', postId: null });
    if (!item.url) {
      sendJson(response, 400, { error: 'Загрузите фото для галереи.' });
      return true;
    }
    await write('gallery', sortedGalleryItems([item, ...gallery]));
    await appendEvent('gallery.created', { id: item.id, caption: item.caption });
    sendJson(response, 201, item);
    return true;
  }

  const params = routeParams('/api/gallery/:id', pathname);
  if (params && method === 'PUT') {
    const body = await readBody(request);
    const gallery = await read('gallery');
    const index = gallery.findIndex((item) => item.id === params.id);
    if (index === -1) {
      sendJson(response, 404, { error: 'Фото не найдено' });
      return true;
    }
    // A post photo's file belongs to the post: only its library settings change.
    const input = gallery[index].source === 'post' ? { ...body, url: undefined, thumbUrl: undefined } : body;
    const item = normalizeGalleryItem(input, gallery[index]);
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

  if (params && method === 'DELETE') {
    const gallery = await read('gallery');
    const item = gallery.find((entry) => entry.id === params.id);
    if (!item) {
      sendJson(response, 404, { error: 'Фото не найдено' });
      return true;
    }
    if (item.source === 'post') {
      sendJson(response, 400, { error: 'Это фото из новости. Его можно скрыть из галереи или удалить из самой новости.' });
      return true;
    }
    await write('gallery', gallery.filter((entry) => entry.id !== params.id));
    await appendEvent('gallery.deleted', { id: params.id });
    sendNoContent(response);
    return true;
  }

  return false;
}
