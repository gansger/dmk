import { appendEvent, read, write } from '../core/store.js';
import { readBody, routeParams, sendJson, sendNoContent } from '../core/http.js';
import { normalizeGalleryItem, sortedGalleryItems } from '../domain/gallery.js';

export async function handleGalleryApi({ request, response, method, pathname }) {
  if (method === 'GET' && pathname === '/api/gallery') {
    sendJson(response, 200, sortedGalleryItems(await read('gallery')));
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

  const params = routeParams('/api/gallery/:id', pathname);
  if (params && method === 'PUT') {
    const body = await readBody(request);
    const gallery = await read('gallery');
    const index = gallery.findIndex((item) => item.id === params.id);
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

  if (params && method === 'DELETE') {
    const gallery = await read('gallery');
    const nextGallery = gallery.filter((item) => item.id !== params.id);
    if (nextGallery.length === gallery.length) {
      sendJson(response, 404, { error: 'Фото не найдено' });
      return true;
    }
    await write('gallery', nextGallery);
    await appendEvent('gallery.deleted', { id: params.id });
    sendNoContent(response);
    return true;
  }

  return false;
}
