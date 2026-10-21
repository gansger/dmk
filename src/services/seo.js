import { escapeHtml, parseHtml, sanitizeNodes, serializeHtml, textContent, walkElements } from '../core/html.js';

// Template texts the editor puts into new blocks. They are fine on screen while
// a page is being built, but must never become the search snippet.
const placeholderPhrases = [
  'материалы появляются здесь после публикации в админке',
  'опубликуйте первый материал в админке',
  'пока нет публикаций',
  'новая страница. здесь можно добавить текст, div-блоки, карточки и ссылки',
  'напишите текст, выделите фразу и добавьте ссылку',
  'новый текстовый блок',
  'описание раздела можно изменить прямо здесь',
  'здесь можно добавить обращение, объявление или полезную ссылку',
  'удалите этот текст и разместите здесь свой контент',
  'публикации сайта',
  'cms engine'
];

function withoutPlaceholders(text) {
  let result = String(text || '');
  for (const phrase of placeholderPhrases) {
    result = result.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

function htmlToText(html) {
  return textContent(parseHtml(String(html || '')));
}

// Cuts on a word boundary so a snippet never ends in the middle of a word.
function excerptFrom(text, limit = 180) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
}

function blockOf(page, type) {
  return (page?.blocks || []).find((block) => block.type === type);
}

// Content blocks in the order a visitor sees them, mirroring site.js: the right
// column first, then custom blocks around the news list. The hero block is left
// out on purpose: site.js never shows its text (it removes .site-hero-copy).
function visibleContentBlocks(page) {
  const blocks = page?.blocks || [];
  const rightPanel = blockOf(page, 'rightPanel');
  const posts = blockOf(page, 'posts');
  const postsOrder = Number(posts?.order || 20);
  const custom = blocks
    .filter((block) => ['text', 'container'].includes(block.type) && block.enabled !== false)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  return [
    ...(rightPanel && rightPanel.enabled !== false ? [rightPanel] : []),
    ...custom.filter((block) => Number(block.order || 0) < postsOrder),
    ...(posts?.enabled === true ? [posts] : []),
    ...custom.filter((block) => Number(block.order || 0) >= postsOrder)
  ];
}

function blockHtmlFields(block) {
  const fields = block.fields || {};
  if (block.type === 'posts') return [fields.titleHtml];
  return [fields.titleHtml, fields.html];
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

// Paragraph-like texts of the visible content, placeholders removed. Paragraphs
// come first: they describe a page better than its headings and card labels.
function contentTexts(page) {
  const paragraphs = [];
  const other = [];
  for (const block of visibleContentBlocks(page)) {
    for (const html of blockHtmlFields(block)) {
      const nodes = parseHtml(String(html || ''));
      walkElements(nodes, (element) => {
        if (['p', 'li', 'blockquote'].includes(element.tag)) paragraphs.push(withoutPlaceholders(textContent(element.children)));
      });
      other.push(withoutPlaceholders(textContent(nodes)));
    }
  }
  return { paragraphs: paragraphs.filter(Boolean), other: other.filter(Boolean) };
}

export function pageDescription(page, { posts = [], pages = {} } = {}) {
  const custom = String(page?.seo?.description || '').trim();
  if (custom) return excerptFrom(custom, 180);
  if (page?.id === 'home' && process.env.CMS_DEFAULT_DESCRIPTION) return excerptFrom(process.env.CMS_DEFAULT_DESCRIPTION, 180);

  const title = String(page?.title || '').trim().toLowerCase();
  const { paragraphs, other } = contentTexts(page);
  const meaningful = (text) => text.length >= 40 && text.toLowerCase() !== title;
  const text = paragraphs.find(meaningful) || other.find(meaningful);
  if (text) return excerptFrom(text, 180);

  const published = (posts || []).filter((post) => post.status === 'published');
  if (blockOf(page, 'posts')?.enabled === true && published.length) {
    const titles = published
      .sort((left, right) => String(right.publishedAt || '').localeCompare(String(left.publishedAt || '')))
      .slice(0, 3)
      .map((post) => post.title);
    return excerptFrom(`${page?.title || 'Новости'}: ${titles.join('; ')}`, 180);
  }
  return excerptFrom(process.env.CMS_DEFAULT_DESCRIPTION || `${page?.title || ''} — ${siteName(pages)}`, 180);
}

function seoTitle({ page, post, pages }) {
  const custom = String(post?.seoTitle || page?.seo?.title || '').trim();
  if (custom) return custom;

  const name = siteName(pages);
  const title = String(post?.title || page?.title || name).trim();
  if (!title || title === name || page?.id === 'home') return title || name;
  return `${title} | ${name}`;
}

function seoDescription({ page, post, posts, pages }) {
  const custom = String(post?.seoDescription || page?.seo?.description || '').trim();
  if (custom) return excerptFrom(custom, 180);
  if (post) return excerptFrom(post.excerpt || post.content || post.title, 180);
  return pageDescription(page, { posts, pages });
}

function seoImage({ page, post, baseUrl }) {
  const value = page?.seo?.image || post?.coverImage || firstPageImage(page);
  // Social networks do not show SVG previews (placeholders are SVG).
  if (!value || /\.svg(\?|$)/i.test(value)) return '';
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

function renderSeoHead({ page, post, pages, posts, baseUrl, canonicalUrl, statusCode }) {
  const title = seoTitle({ page, post, pages });
  const description = seoDescription({ page, post, posts, pages });
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
    <meta name="cms-page-id" content="${escapeHtml(page?.id || 'home')}">
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

function escapeXml(value) {
  return escapeHtml(value).replaceAll('&#039;', '&apos;');
}

// Old editor links use ?page=id / ?post=slug; search engines should get clean URLs.
function publicHref(href) {
  const value = String(href || '').trim();
  const query = value.match(/^(?:\/|\/site\.html)?\?(.*)$/);
  if (!query) return value;
  const params = new URLSearchParams(query[1]);
  if (params.get('post')) return `/news/${encodeURIComponent(params.get('post'))}`;
  if (params.get('page')) return pagePublicPath(params.get('page'));
  return '/';
}

function linkedElementHref(attributes) {
  if (attributes['data-link-url']) return publicHref(attributes['data-link-url']);
  if (attributes['data-page-link']) return pagePublicPath(attributes['data-page-link']);
  return '';
}

function containsLink(nodes) {
  let found = false;
  walkElements(nodes, (element) => {
    if (element.tag === 'a') found = true;
  });
  return found;
}

function nearbyHeading(ancestors) {
  for (const ancestor of [...ancestors].reverse().slice(0, 3)) {
    let text = '';
    walkElements(ancestor.children, (element) => {
      if (!text && ['h2', 'h3', 'h4', 'strong', 'figcaption'].includes(element.tag)) text = textContent(element.children);
    });
    if (text) return text;
  }
  return '';
}

// Saved block HTML → clean markup for search engines: nothing executable,
// clean URLs, cards with a page link become real <a href>, images get alt text,
// and only the page-level <h1> stays an h1.
export function renderContentHtml(html, { pageTitle = '' } = {}) {
  const nodes = sanitizeNodes(parseHtml(String(html || '')));

  const transform = (list, ancestors) => {
    for (const node of list) {
      if (node.type !== 'element') continue;
      if (node.tag === 'h1') node.tag = 'h2';
      if (node.tag === 'a' && node.attributes.href) node.attributes.href = publicHref(node.attributes.href);
      if (node.tag === 'img' && !String(node.attributes.alt || '').trim()) {
        node.attributes.alt = nearbyHeading(ancestors) || pageTitle;
      }
      transform(node.children, [...ancestors, node]);

      const href = node.tag === 'a' ? '' : linkedElementHref(node.attributes);
      if (href) {
        delete node.attributes['data-link-url'];
        delete node.attributes['data-page-link'];
        if (containsLink(node.children)) {
          node.children.push({ type: 'element', tag: 'a', attributes: { href, class: 'linked-block-link' }, children: [{ type: 'text', text: textContent(node.children) }] });
        } else {
          node.children = [{ type: 'element', tag: 'a', attributes: { href, class: 'linked-block-wrap' }, children: node.children }];
        }
      }
    }
  };
  transform(nodes, []);
  return serializeHtml(nodes);
}

function renderMenuItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.label)
    .map((item) => {
      const href = publicHref(item.href);
      // "#" leads nowhere: keep the label as text instead of an empty link.
      return href && href !== '#'
        ? `<li><a href="${escapeHtml(href)}">${escapeHtml(item.label)}</a></li>`
        : `<li>${escapeHtml(item.label)}</li>`;
    })
    .join('');
}

function renderLayoutStart(page) {
  const parts = [];
  const header = blockOf(page, 'headerNav');
  if (header && header.enabled !== false) {
    const items = renderMenuItems(header.fields?.items);
    if (items) parts.push(`<nav aria-label="Верхнее меню"><ul>${items}</ul></nav>`);
  }
  const side = blockOf(page, 'sideMenu');
  if (side && side.enabled !== false) {
    const name = htmlToText(side.fields?.titleHtml);
    const logo = side.fields?.logoUrl
      ? `<img src="${escapeHtml(side.fields.logoUrl)}" alt="${escapeHtml(name ? `Логотип: ${name}` : 'Логотип')}">`
      : '';
    const items = renderMenuItems(side.fields?.items);
    parts.push(`<header><a href="/">${logo}${escapeHtml(name)}</a>${items ? `<nav aria-label="Меню разделов"><ul>${items}</ul></nav>` : ''}</header>`);
  }
  return parts.join('');
}

function renderPostsBlock(block, posts) {
  const title = htmlToText(block.fields?.titleHtml) || 'Новости';
  const published = (posts || [])
    .filter((post) => post.status === 'published')
    .sort((left, right) => String(right.publishedAt || '').localeCompare(String(left.publishedAt || '')));
  const limit = Number(block.fields?.limit || 0);
  const items = (limit > 0 ? published.slice(0, limit) : published.slice(0, 50))
    .map((post) => {
      const date = post.publishedAt
        ? ` <time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(new Date(post.publishedAt).toLocaleDateString('ru-RU'))}</time>`
        : '';
      const excerpt = post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : '';
      return `<li><a href="${postPublicPath(post)}">${escapeHtml(post.title)}</a>${date}${excerpt}</li>`;
    })
    .join('');
  return `<section><h2>${escapeHtml(title)}</h2>${items ? `<ul>${items}</ul>` : ''}</section>`;
}

function renderContentBlock(block, context) {
  if (block.type === 'posts') return renderPostsBlock(block, context.posts);
  const title = htmlToText(block.fields?.titleHtml);
  const content = renderContentHtml(block.fields?.html, context);
  if (!title && !content) return '';
  return `<section>${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${content}</section>`;
}

function renderFooter(page) {
  const footer = blockOf(page, 'footer');
  if (!footer || footer.enabled === false) return '';
  const fields = footer.fields || {};
  const texts = ['brandHtml', 'textHtml', 'contactHtml', 'copyrightHtml']
    .map((key) => renderContentHtml(fields[key]))
    .filter(Boolean)
    .map((html) => `<p>${html}</p>`)
    .join('');
  const items = renderMenuItems(fields.items);
  return `<footer>${texts}${items ? `<nav aria-label="Навигация в подвале"><ul>${items}</ul></nav>` : ''}</footer>`;
}

function renderPageNavigation(pages, currentPageId) {
  const links = Object.values(pages || {})
    .filter((page) => page?.id && page.id !== currentPageId && !page.seo?.noIndex && !isGeneratedPostPage(page))
    .sort((left, right) => String(left.title).localeCompare(String(right.title), 'ru'))
    .map((page) => `<li><a href="${pagePublicPath(page.id)}">${escapeHtml(page.title)}</a></li>`)
    .join('');

  if (!links) return '';
  return `<nav class="seo-fallback-nav" aria-label="Все страницы сайта"><ul>${links}</ul></nav>`;
}

// The same content a visitor sees, as plain server-rendered HTML. Browsers with
// JavaScript replace it with the interactive page; search engines and visitors
// without JavaScript read it as is.
function renderServerContent({ page, pages, posts }) {
  const context = { pageTitle: page?.title || '', posts };
  const content = visibleContentBlocks(page)
    .map((block) => renderContentBlock(block, context))
    .filter(Boolean)
    .join('');
  return `
    <div class="seo-fallback" data-seo-fallback>
      ${renderLayoutStart(page)}
      <article>${content}</article>
      ${renderFooter(page)}
      ${renderPageNavigation(pages, page?.id)}
    </div>`;
}

export function pageHeading({ page, post }) {
  return String(post?.title || page?.seo?.h1 || page?.title || 'Страница').trim();
}

export function renderPublicSiteHtml({ template, request, page, pages, posts, post = null, statusCode = 200, canonicalPath }) {
  const baseUrl = siteBaseUrl(request);
  const path = canonicalPath || (post ? postPublicPath(post) : pagePublicPath(page?.id));
  const canonicalUrl = absoluteUrl(path, baseUrl);
  const metadata = renderSeoHead({ page, post, pages, posts, baseUrl, canonicalUrl, statusCode });
  // Data block, not executable script: it is allowed by the CSP without 'unsafe-inline'.
  const state = `<script id="cmsPageState" type="application/json">${jsonForScript({ pageId: page?.id || 'home' })}</script>`;
  // One <h1> per page. Hidden visually unless the page asks to show it; screen
  // readers and search engines always get it.
  const h1 = `<h1 class="page-h1${page?.seo?.showH1 ? '' : ' visually-hidden'}" id="pageH1">${escapeHtml(pageHeading({ page, post }))}</h1>`;

  return {
    html: template
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
      .replace('<!-- CMS_SEO_HEAD -->', metadata.head)
      .replace('<!-- CMS_PAGE_H1 -->', h1)
      .replace('<!-- CMS_SEO_BODY -->', renderServerContent({ page, pages, posts }))
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
