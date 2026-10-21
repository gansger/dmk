import { appendEvent, read, write } from '../core/store.js';
import { readBody, routeParams, sendJson } from '../core/http.js';
import { normalizePage, pageWithSharedLayout, syncSharedLayoutBlocks } from '../domain/pages.js';
import { ensurePublishedPostPages } from '../domain/posts.js';

export async function handlePagesApi({ request, response, method, pathname }) {
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

  return false;
}
