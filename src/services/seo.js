import { excerptFrom } from '../core/format.js';

const textFieldNames = new Set([
  'brandHtml',
  'buttonHtml',
  'contactHtml',
  'copyrightHtml',
  'emptyTextHtml',
  'emptyTitleHtml',
  'eyebrowHtml',
  'html',
  'labelHtml',
  'textHtml',
  'titleHtml'
]);
const blockTextPriority = new Map([
  ['hero', 0],
  ['text', 1],
  ['container', 1],
  ['rightPanel', 2],
  ['posts', 3],
  ['slider', 4],
  ['headerNav', 10],
  ['sideMenu', 10],
  ['footer', 10]
]);
const fieldTextPriority = new Map([
  ['textHtml', 0],
  ['html', 0],
  ['titleHtml', 1],
  ['eyebrowHtml', 2],
  ['emptyTextHtml', 3],
  ['emptyTitleHtml', 3],
  ['brandHtml', 10],
  ['contactHtml', 10],
  ['copyrightHtml', 10],
  ['labelHtml', 10],
  ['buttonHtml', 10],
  ['items', 11]
]);

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll('&#039;', '&apos;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueText(values) {
  const seen = new Set();
  return values
    .map((value) => stripHtml(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function pageTextParts(page) {
  const parts = [];
  const blocks = [...(page?.blocks || [])].sort(
    (left, right) =>
      (blockTextPriority.get(left.type) ?? 5) - (blockTextPriority.get(right.type) ?? 5)
  );
  for (const block of blocks) {
    if (block.enabled === false) continue;
    const fields = Object.entries(block.fields || {}).sort(
      ([left], [right]) => (fieldTextPriority.get(left) ?? 5) - (fieldTextPriority.get(right) ?? 5)
    );
    for (const [key, value] of fields) {
      if (textFieldNames.has(key) && typeof value === 'string') parts.push(value);
      if (key === 'items' && Array.isArray(value)) {
        parts.push(...value.map((item) => item?.label).filter(Boolean));
      }
    }
  }
  return uniqueText(parts);
}

function firstPageImage(page) {
  for (const block of page?.blocks || []) {
    const fields = block.fields || {};
    for (const key of ['image', 'imageUrl', 'logoUrl', 'backgroundImage']) {
      if (typeof fields[key] === 'string' && fields[key].trim()) return fields[key].trim();
    }
    if (typeof fields.html === 'string') {
      const match = fields.html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match?.[1]) return match[1];
    }
  }
  return '';
}

function sideMenuLogo(pages) {
  const sideMenu = (pages?.home?.blocks || []).find((block) => block.type === 'sideMenu');
  return sideMenu?.fields?.logoUrl || '';
}

function firstHeaderValue(value) {
  return String(Array.isArray(value) ? value[0] : value || '')
    .split(',')[0]
    .trim();
}

function configuredBaseUrl() {
  const value = String(process.env.CMS_SITE_URL || '').trim();
  if (!value) return '';
  try {
    return new URL(value).toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function siteBaseUrl(request) {
  const configured = configuredBaseUrl();
  if (configured) return configured;

  const protocol =
    firstHeaderValue(request.headers['x-forwarded-proto']) ||
    (request.socket.encrypted ? 'https' : 'http');
  const host = firstHeaderValue(request.headers['x-forwarded-host']) || request.headers.host || 'localhost';
  return `${protocol}://${host}`;
}

export function pagePublicPath(pageId) {
  if (!pageId || pageId === 'home') return '/';
  return `/${encodeURIComponent(pageId)}`;
}

export function postPublicPath(post) {
  return `/news/${encodeURIComponent(post?.slug || '')}`;
}

export function isGeneratedPostPage(page) {
  return Boolean((page?.blocks || []).some((block) => block.fields?.generatedFromPostId));
}

function absoluteUrl(value, baseUrl) {
  if (!value) return '';
  try {
    return new URL(value, `${baseUrl}/`).toString();
  } catch {
    return '';
  }
}

function siteName(pages) {
  return String(process.env.CMS_SITE_NAME || pages?.home?.title || 'Сайт').trim();
}

function pageDescription(page) {
  const custom = String(page?.seo?.description || '').trim();
  if (custom) return excerptFrom(custom, 180);

  const title = String(page?.title || '').trim().toLowerCase();
  const text = pageTextParts(page).find((part) => part.toLowerCase() !== title) || '';
  return excerptFrom(text || process.env.CMS_DEFAULT_DESCRIPTION || page?.title || '', 180);
}

function seoTitle({ page, post, pages }) {
  const custom = String(post?.seoTitle || page?.seo?.title || '').trim();
  if (custom) return custom;

  const name = siteName(pages);
  const title = String(post?.title || page?.title || name).trim();
  if (!title || title === name || page?.id === 'home') return title || name;
  return `${title} | ${name}`;
}

function seoDescription({ page, post }) {
  const custom = String(post?.seoDescription || page?.seo?.description || '').trim();
  if (custom) return excerptFrom(custom, 180);
  return excerptFrom(post?.excerpt || post?.content || pageDescription(page), 180);
}

function seoImage({ page, post, baseUrl }) {
  const value = page?.seo?.image || post?.coverImage || firstPageImage(page);
  return absoluteUrl(value, baseUrl);
}

function structuredData({ baseUrl, canonicalUrl, title, description, image, page, post, pages }) {
  const name = siteName(pages);
  const homeUrl = absoluteUrl('/', baseUrl);
  const organizationId = `${homeUrl}#organization`;
  const websiteId = `${homeUrl}#website`;
  const logo = absoluteUrl(sideMenuLogo(pages), baseUrl);
  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name,
      url: homeUrl,
      ...(logo ? { logo: { '@type': 'ImageObject', url: logo } } : {})
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      name,
      url: homeUrl,
      inLanguage: 'ru-RU',
      publisher: { '@id': organizationId }
    }
  ];

  if (post) {
    graph.push({
      '@type': 'NewsArticle',
      '@id': `${canonicalUrl}#article`,
      headline: post.title,
      description,
      mainEntityOfPage: { '@id': canonicalUrl },
      ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
      ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
      ...(image ? { image: [image] } : {}),
      author: { '@id': organizationId },
      publisher: { '@id': organizationId },
      isPartOf: { '@id': websiteId },
      inLanguage: 'ru-RU'
    });
  } else {
    graph.push({
      '@type': 'WebPage',
      '@id': canonicalUrl,
      name: title,
      description,
      url: canonicalUrl,
      isPartOf: { '@id': websiteId },
      about: { '@id': organizationId },
      inLanguage: 'ru-RU',
      ...(page?.updatedAt ? { dateModified: page.updatedAt } : {})
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderSeoHead({ page, post, pages, baseUrl, canonicalUrl, statusCode }) {
  const title = seoTitle({ page, post, pages });
  const description = seoDescription({ page, post });
  const image = seoImage({ page, post, baseUrl });
  const noIndex = statusCode === 404 || Boolean(post?.noIndex || page?.seo?.noIndex);
  const robots = noIndex
    ? 'noindex,nofollow'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const type = post ? 'article' : 'website';
  const schema = structuredData({ baseUrl, canonicalUrl, title, description, image, page, post, pages });

  return {
    title,
    noIndex,
    head: `
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:locale" content="ru_RU">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${escapeHtml(siteName(pages))}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
    <script type="application/ld+json">${jsonForScript(schema)}</script>`
  };
}

function renderPageNavigation(pages, currentPageId) {
  const links = Object.values(pages || {})
    .filter((page) => page?.id && page.id !== currentPageId && !page.seo?.noIndex && !isGeneratedPostPage(page))
    .sort((left, right) => String(left.title).localeCompare(String(right.title), 'ru'))
    .map((page) => `<a href="${pagePublicPath(page.id)}">${escapeHtml(page.title)}</a>`)
    .join('');

  if (!links) return '';
  return `<nav class="seo-fallback-nav" aria-label="Страницы сайта">${links}</nav>`;
}

function renderRecentPosts(page, posts) {
  const postsBlock = (page?.blocks || []).find((block) => block.type === 'posts');
  if (postsBlock?.enabled !== true) return '';

  const links = (posts || [])
    .filter((post) => post.status === 'published')
    .sort((left, right) => String(right.publishedAt || '').localeCompare(String(left.publishedAt || '')))
    .slice(0, 20)
    .map((post) => `<li><a href="${postPublicPath(post)}">${escapeHtml(post.title)}</a></li>`)
    .join('');

  if (!links) return '';
  return `<section><h2>Публикации</h2><ul>${links}</ul></section>`;
}

function renderFallback({ page, post, pages, posts }) {
  if (post) {
    const paragraphs = String(post.content || '')
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p>${escapeHtml(part).replaceAll('\n', '<br>')}</p>`)
      .join('');
    const cover = post.coverImage
      ? `<img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}">`
      : '';
    const published = post.publishedAt
      ? `<time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(new Date(post.publishedAt).toLocaleDateString('ru-RU'))}</time>`
      : '';
    return `
      <section class="seo-fallback" data-seo-fallback>
        <article>
          <a href="${pagePublicPath('novosti')}">Назад к новостям</a>
          ${published}
          <h1>${escapeHtml(post.title)}</h1>
          ${cover}
          ${paragraphs || `<p>${escapeHtml(post.excerpt || '')}</p>`}
        </article>
        ${renderPageNavigation(pages, page?.id)}
      </section>`;
  }

  const paragraphs = pageTextParts(page)
    .filter((part) => part.toLowerCase() !== String(page?.title || '').toLowerCase())
    .slice(0, 24)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join('');

  return `
    <section class="seo-fallback" data-seo-fallback>
      <article>
        <h1>${escapeHtml(page?.title || 'Страница')}</h1>
        ${paragraphs}
      </article>
      ${renderRecentPosts(page, posts)}
      ${renderPageNavigation(pages, page?.id)}
    </section>`;
}

export function renderPublicSiteHtml({ template, request, page, pages, posts, post = null, statusCode = 200, canonicalPath }) {
  const baseUrl = siteBaseUrl(request);
  const path = canonicalPath || (post ? postPublicPath(post) : pagePublicPath(page?.id));
  const canonicalUrl = absoluteUrl(path, baseUrl);
  const metadata = renderSeoHead({ page, post, pages, baseUrl, canonicalUrl, statusCode });
  const state = `<script>window.__CMS_PAGE_ID__=${jsonForScript(page?.id || 'home')};</script>`;

  return {
    html: template
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
      .replace('<!-- CMS_SEO_HEAD -->', metadata.head)
      .replace('<!-- CMS_SEO_BODY -->', renderFallback({ page, post, pages, posts }))
      .replace('<!-- CMS_SEO_STATE -->', state),
    noIndex: metadata.noIndex
  };
}

export function renderRobotsTxt(request) {
  const baseUrl = siteBaseUrl(request);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /edit',
    'Disallow: /api/',
    `Sitemap: ${absoluteUrl('/sitemap.xml', baseUrl)}`,
    ''
  ].join('\n');
}

function validLastModified(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function renderSitemapXml({ request, pages, posts }) {
  const baseUrl = siteBaseUrl(request);
  const entries = [];

  for (const page of Object.values(pages || {})) {
    if (!page?.id || page.seo?.noIndex || isGeneratedPostPage(page)) continue;
    entries.push({
      loc: absoluteUrl(pagePublicPath(page.id), baseUrl),
      lastmod: validLastModified(page.updatedAt)
    });
  }

  for (const post of posts || []) {
    if (post.status !== 'published' || post.noIndex || !post.slug) continue;
    entries.push({
      loc: absoluteUrl(postPublicPath(post), baseUrl),
      lastmod: validLastModified(post.updatedAt || post.publishedAt)
    });
  }

  const urls = entries
    .filter((entry) => entry.loc)
    .map(
      (entry) => `
  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    ${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}
  </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`;
}
