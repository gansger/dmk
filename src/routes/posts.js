import { appendEvent, read, write } from '../core/store.js';
import { readBody, routeParams, sendJson, sendNoContent } from '../core/http.js';
import {
  ensurePublishedPostPages,
  ensureUniqueSlug,
  normalizePost,
  postPageId,
  publicPost,
  syncPublishedPostPages
} from '../domain/posts.js';
import { clampNumber, defaultSliderSettings, normalizeImageFit, normalizeSliderSettings, sliderPosts } from '../domain/slider.js';

// Posts and the home page slider built from them.
export async function handlePostsApi({ request, response, method, pathname }) {
  if (method === 'GET' && pathname === '/api/posts') {
    sendJson(response, 200, await read('posts'));
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

  let params = routeParams('/api/posts/:id', pathname);
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

  return false;
}
