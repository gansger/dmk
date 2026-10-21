import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPublicDir } from '../core/config.js';
import { read, write } from '../core/store.js';
import { sendHtml, sendRedirect, sendText, serveFile, versionAssetUrls } from '../core/http.js';
import { publicGalleryItems } from '../domain/gallery.js';
import { ensurePublishedPostPages, postPageFromPost, postPageId, publishedPostForPage } from '../domain/posts.js';
import {
  isGeneratedPostPage,
  pagePublicPath,
  postPublicPath,
  renderPublicSiteHtml,
  renderRobotsTxt,
  renderSitemapXml
} from '../services/seo.js';
import { sessionUser } from '../services/auth.js';

const publicDir = getPublicDir();
let publicSiteTemplate;

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
    template: await versionAssetUrls(await getPublicSiteTemplate(), publicDir),
    request,
    page,
    pages,
    posts,
    gallery: publicGalleryItems(await read('gallery'), posts),
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

// Public pages, admin/editor entry points, robots.txt and sitemap.xml.
export async function handleSiteRoute({ request, response, url }) {
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
