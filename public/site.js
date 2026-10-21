const root = document.querySelector('#publicPosts');
const siteHeaderNav = document.querySelector('#siteHeaderNav');
const siteSideMenu = document.querySelector('#siteSideMenu');
const siteRightPanel = document.querySelector('#siteRightPanel');
const siteFooter = document.querySelector('#siteFooter');
const urlParams = new URLSearchParams(window.location.search);

const styleOverride = document.createElement('style');
styleOverride.textContent = '.builder-widget-title { border-bottom: none !important; }';
document.head.appendChild(styleOverride);

const slider = {
  root: document.querySelector('#siteSlider'),
  media: document.querySelector('.site-hero-media'),
  label: document.querySelector('#sliderLabel'),
  title: document.querySelector('#sliderTitle'),
  excerpt: document.querySelector('#sliderExcerpt'),
  link: document.querySelector('#sliderLink'),
  controls: document.querySelector('.slider-controls'),
  dots: document.querySelector('#sliderDots'),
  prev: document.querySelector('#sliderPrev'),
  next: document.querySelector('#sliderNext'),
  pause: document.querySelector('#sliderPause'),
  posts: [],
  settings: {
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
  },
  index: 0,
  timer: null,
  paused: false
};
const isEditMode = window.location.pathname === '/edit' || window.location.pathname === '/edit/';
const currentPageId = normalizePageParam(
  serverPageId() || document.querySelector('meta[name="cms-page-id"]')?.content || urlParams.get('page') || pageIdFromPath()
);
let pageState = null;
let pagesIndex = [];
let selectedBuilderBlockId = null;
let selectedDesignTarget = null;
let selectedSideMenuIndex = null;
let selectedHeaderNavIndex = null;
let selectedFooterIndex = null;
let selectedAccordionSectionId = null;
const builderPanelPositionKey = 'cms-builder-panel-position';

if (isEditMode) {
  const editorStyles = document.createElement('link');
  editorStyles.rel = 'stylesheet';
  editorStyles.href = '/editor.css';
  document.head.appendChild(editorStyles);
}

const layoutDefaults = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  position: 'center',
  gap: 16,
  padding: 24,
  maxWidth: 1060,
  height: 0,
  backgroundColor: '#ffffff',
  textColor: '#18202f',
  fontSize: 16,
  fontFamily: 'system-ui',
  fontWeight: 400,
  borderRadius: 8,
  gridColumns: 0,
  flexWrap: 'nowrap'
};

const rightPanelDefaults = {
  ...layoutDefaults,
  display: 'grid',
  flexDirection: 'column',
  gap: 16,
  padding: 14,
  maxWidth: 280,
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  fontSize: 14,
  borderRadius: 0
};

const sliderStyleDefaults = {
  maxWidth: 2400,
  align: 'center',
  borderRadius: 0,
  height: 0
};

const objectStyleDefaults = {
  backgroundColor: '#ffffff',
  textColor: '#18202f',
  fontSize: 16,
  fontFamily: 'system-ui',
  fontWeight: 400,
  padding: 14,
  borderRadius: 0,
  maxWidth: 1200,
  height: 0
};

const headerObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#087789',
  textColor: '#ffffff',
  maxWidth: 2400
};

const sideObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#087789',
  textColor: '#ffffff',
  padding: 0,
  maxWidth: 280
};

const footerObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#075f70',
  textColor: '#ffffff',
  padding: 0,
  maxWidth: 2400
};

const cardObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#eef6f4',
  textColor: '#18202f',
  padding: 34,
  maxWidth: 1200,
  height: 200
};

const sectionObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#ffffff',
  textColor: '#18202f',
  padding: 22,
  borderRadius: 8,
  maxWidth: 1200,
  height: 160
};

const accordionObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#ffffff',
  textColor: '#18202f',
  padding: 0,
  borderRadius: 0,
  maxWidth: 1200,
  height: 0
};

const imageObjectDefaults = {
  ...objectStyleDefaults,
  backgroundColor: '#f8fafc',
  textColor: '#64748b',
  padding: 0,
  borderRadius: 18,
  maxWidth: 1200,
  height: 260
};

const postsDefaults = {
  titleHtml: 'Новости',
  limit: 4,
  cardMinWidth: 360,
  cardHeight: 0,
  coverHeight: 0,
  maxWidth: 2400,
  align: 'center',
  allPageId: 'novosti',
  allLinkText: 'Все новости',
  showAllLink: true,
  emptyTitleHtml: 'Пока нет публикаций',
  emptyTextHtml: 'Опубликуйте первый материал в админке.'
};

const galleryDefaults = {
  titleHtml: 'Фотогалерея',
  limit: 12
};

const defaultHeaderItems = ['Раздел 1', 'Раздел 2', 'Раздел 3', 'Раздел 4'];
const defaultSideItems = [
  'Сведения об образовательной организации',
  'Внутренняя система оценки качества образования',
  'Электронная информационно-образовательная среда',
  'Комплексная безопасность',
  'Образование',
  'Жизнь колледжа',
  'Центр карьеры',
  'Отдел практик',
  'Воспитательная работа',
  'Спортивный клуб',
  'Центр профессионального обучения',
  'Аккредитация',
  'Контакты',
  'Пресс-служба'
];
const defaultFooterItems = [
  { id: 'home', label: 'Главная', href: '/' },
  { id: 'news', label: 'Новости', href: '/novosti' },
  { id: 'contacts', label: 'Контакты', href: '#contacts' }
];
// Cookie notice: its text lives in the (shared) footer block, so it is edited on
// the home page like the rest of the footer. Consent is remembered per browser.
const cookieConsentKey = 'cms-cookie-consent';
const privacyPolicyPath = '/politika-konfidencialnosti';
const cookieNoticeDefaults = {
  html: `Мы используем файлы cookie, чтобы сайт работал корректно и был удобнее для вас. Продолжая пользоваться сайтом, вы соглашаетесь с обработкой файлов cookie и <a href="${privacyPolicyPath}">политикой конфиденциальности</a>.`,
  button: 'Принять'
};

const footerDefaults = {
  brandHtml: 'АНО ПО «Дагестанский медицинский колледж»',
  textHtml: 'Образовательная организация. Новости, документы и полезная информация для студентов и абитуриентов.',
  contactHtml: '<strong>Контакты</strong><br>Добавьте адрес, телефон и электронную почту в режиме редактирования.',
  copyrightHtml: `© ${new Date().getFullYear()} Все права защищены.`,
  items: defaultFooterItems,
  styles: { ...footerObjectDefaults }
};
const editableCardTextSelector = [
  '.builder-card-code',
  '.builder-card-title',
  '.builder-card-text',
  '.builder-card-subtitle',
  '.builder-card-description',
  '.specialty-card-qualification',
  '.specialty-card-more',
  'p',
  'strong'
].join(', ');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

function sanitizePageId(value) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };
  const transliterated = String(value || 'home')
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => map[letter] ?? letter);

  return transliterated
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'home';
}

function normalizePageParam(value) {
  return String(value || 'home')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'home';
}

function serverPageId() {
  try {
    return JSON.parse(document.querySelector('#cmsPageState')?.textContent || '{}').pageId || '';
  } catch {
    return '';
  }
}

function pageIdFromPath() {
  let cleanPath = '';
  try {
    cleanPath = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '');
  } catch {
    return 'home';
  }
  if (!cleanPath || cleanPath === 'site.html' || cleanPath === 'edit') return 'home';
  if (cleanPath.includes('/')) return 'home';
  return cleanPath;
}

function pageUrl(pageId, edit = false) {
  const normalized = normalizePageParam(pageId);
  if (!edit) return normalized === 'home' ? '/' : `/${encodeURIComponent(normalized)}`;

  const params = new URLSearchParams();
  if (normalized !== 'home') params.set('page', normalized);
  const query = params.toString();
  return `/edit${query ? `?${query}` : ''}`;
}

function normalizePublicHref(href) {
  const value = String(href || '').trim();
  if (!value || value.startsWith('#') || /^(?:mailto:|tel:)/i.test(value)) return value;
  if (/^(?:javascript:|data:|vbscript:)/i.test(value)) return '#';

  try {
    const url = new URL(value, `${window.location.origin}/`);
    if (!['http:', 'https:'].includes(url.protocol)) return '#';
    if (url.origin !== window.location.origin) return value;
    const pageId = url.searchParams.get('page');
    const postSlug = url.searchParams.get('post');
    if (pageId && ['/', '/site.html'].includes(url.pathname)) return pageUrl(pageId, false);
    if (postSlug && ['/', '/site.html'].includes(url.pathname)) return `/news/${encodeURIComponent(postSlug)}`;
    if (url.pathname === '/site.html') return '/';
  } catch {
    return '#';
  }

  return value;
}

async function editorFetch(path, options = {}) {
  const response = await fetch(path, options);
  if (response.status === 401) {
    window.location.href = `/admin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error('Требуется авторизация администратора.');
  }
  return response;
}

function pageTitleFromId(pageId) {
  return pagesIndex.find((page) => page.id === pageId)?.title || pageId || 'Дагестанский медицинский колледж';
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(value));
}

function imageMedia(post) {
  return (post.media || []).filter((item) => item.type === 'image' && item.url);
}

function postCover(post) {
  return post.coverImage || imageMedia(post)[0]?.url || '';
}

function sliderImageFit(post) {
  return ['cover', 'contain'].includes(post.sliderImageFit)
    ? post.sliderImageFit
    : slider.settings.imageFit || 'cover';
}

function sliderImagePosition(post) {
  const x = Number.isFinite(Number(post.sliderImagePositionX))
    ? Number(post.sliderImagePositionX)
    : Number(slider.settings.imagePositionX ?? 50);
  const y = Number.isFinite(Number(post.sliderImagePositionY))
    ? Number(post.sliderImagePositionY)
    : Number(slider.settings.imagePositionY ?? 50);
  return `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`;
}

function postPageId(post) {
  return post.pageId || `post-${post.slug || post.id}`;
}

function postUrl(post) {
  return post.pageUrl || pageUrl(postPageId(post), false);
}

function postDetailTemplate(post) {
  const images = imageMedia(post);
  const cover = post.coverImage || images[0]?.url;
  const gallery = images.filter((item) => item.url !== cover);

  return `
    <article class="post-detail">
      <a class="read-link" href="${pageUrl('novosti', false)}">Назад к новостям</a>
      <p class="eyebrow">${escapeHtml(formatDate(post.publishedAt))}</p>
      <h2>${escapeHtml(post.title)}</h2>
      ${post.videoUrl ? generateVideoPlayer(post.videoUrl, false) : (cover ? `<img class="post-cover" src="${escapeHtml(cover)}" alt="">` : '')}
      <div class="post-body">${escapeHtml(post.content).replaceAll('\n', '<br>')}</div>
      ${
        gallery.length
          ? `<div class="post-gallery">${gallery.map((item) => `<img src="${escapeHtml(item.url)}" alt="">`).join('')}</div>`
          : ''
      }
    </article>
  `;
}

function postPageFromPost(post) {
  const header = pageBlock('headerNav');
  const side = pageBlock('sideMenu');
  const footer = pageBlock('footer');
  return {
    id: postPageId(post),
    title: post.title,
    seo: {
      title: post.seoTitle || '',
      description: post.seoDescription || post.excerpt || '',
      image: post.coverImage || '',
      noIndex: Boolean(post.noIndex)
    },
    blocks: [
      header ? deepCopy(header) : null,
      side ? deepCopy(side) : null,
      footer ? deepCopy(footer) : null,
      {
        id: 'slider',
        type: 'slider',
        enabled: false,
        order: 10,
        fields: {
          labelHtml: 'Избранное',
          buttonHtml: 'Открыть пост',
          styles: { ...sliderStyleDefaults }
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
          html: postDetailTemplate(post),
          styles: { ...objectStyleDefaults, padding: 22, maxWidth: 1060 }
        }
      }
    ].filter(Boolean)
  };
}

async function ensurePostPages(posts) {
  await Promise.all(
    posts.map(async (post) => {
      const pageId = postPageId(post);
      const existing = await fetch(`/api/public/page/${encodeURIComponent(pageId)}`);
      if (existing.ok) return;
      await editorFetch(`/api/pages/${encodeURIComponent(pageId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPageFromPost(post))
      });
    })
  );
}

function pageBlock(type) {
  return (pageState?.blocks || []).find((block) => block.type === type);
}

function blockById(id) {
  return (pageState?.blocks || []).find((block) => block.id === id);
}

function fieldHtml(type, field, fallback = '') {
  return pageBlock(type)?.fields?.[field] ?? fallback;
}

function navItemsFrom(labels) {
  return labels.map((label, index) => ({
    id: `item-${index + 1}`,
    label,
    href: '#'
  }));
}

function ensureStructuralBlocks() {
  pageState.blocks = Array.isArray(pageState.blocks) ? pageState.blocks : [];

  if (!pageBlock('headerNav')) {
    pageState.blocks.unshift({
      id: 'site-header-nav',
      type: 'headerNav',
      enabled: true,
      order: -30,
      fields: {
        items: navItemsFrom(defaultHeaderItems),
        styles: {
          ...headerObjectDefaults
        }
      }
    });
  }

  if (!pageBlock('sideMenu')) {
    pageState.blocks.unshift({
      id: 'site-side-menu',
      type: 'sideMenu',
      enabled: true,
      order: -20,
      fields: {
        items: navItemsFrom(defaultSideItems),
        titleHtml: 'Название организации',
        logoUrl: '',
        logoText: 'Лого',
        styles: {
          ...sideObjectDefaults,
          fontSize: 14
        }
      }
    });
  }

  if (!pageBlock('footer')) {
    pageState.blocks.push({
      id: 'site-footer',
      type: 'footer',
      enabled: true,
      order: 1000,
      fields: deepCopy(footerDefaults)
    });
  }

  if (currentPageId === 'home' && !pageBlock('gallery')) {
    pageState.blocks.push({
      id: 'gallery',
      type: 'gallery',
      enabled: true,
      order: 30,
      fields: { ...galleryDefaults }
    });
  }
}

function numericStyle(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

const fontFamilyOptions = ['system-ui', 'Arial, sans-serif', 'Georgia, serif', '"Times New Roman", serif', 'Verdana, sans-serif'];

function normalizedFontFamily(value, fallback = 'system-ui') {
  return fontFamilyOptions.includes(value) ? value : fallback;
}

function normalizeLayoutStyles(styles = {}, defaults = layoutDefaults) {
  const displayOptions = ['block', 'flex', 'grid'];
  const directionOptions = ['row', 'row-reverse', 'column', 'column-reverse'];
  const justifyOptions = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'];
  const alignOptions = ['stretch', 'flex-start', 'center', 'flex-end'];
  const positionOptions = ['left', 'center', 'right'];

  return {
    display: displayOptions.includes(styles.display) ? styles.display : defaults.display,
    flexDirection: directionOptions.includes(styles.flexDirection) ? styles.flexDirection : defaults.flexDirection,
    justifyContent: justifyOptions.includes(styles.justifyContent) ? styles.justifyContent : defaults.justifyContent,
    alignItems: alignOptions.includes(styles.alignItems) ? styles.alignItems : defaults.alignItems,
    position: positionOptions.includes(styles.position) ? styles.position : defaults.position,
    gap: numericStyle(styles.gap, defaults.gap, 0, 96),
    padding: numericStyle(styles.padding, defaults.padding, 0, 120),
    maxWidth: numericStyle(styles.maxWidth, defaults.maxWidth, 240, 1600),
    height: numericStyle(styles.height, defaults.height, 0, 2000),
    backgroundColor: styles.backgroundColor || defaults.backgroundColor,
    textColor: styles.textColor || defaults.textColor,
    fontSize: numericStyle(styles.fontSize, defaults.fontSize, 10, 72),
    fontFamily: normalizedFontFamily(styles.fontFamily, defaults.fontFamily),
    fontWeight: numericStyle(styles.fontWeight, defaults.fontWeight, 100, 900),
    borderRadius: numericStyle(styles.borderRadius, defaults.borderRadius, 0, 48),
    gridColumns: numericStyle(styles.gridColumns, defaults.gridColumns || 0, 0, 12),
    flexWrap: ['nowrap', 'wrap', 'wrap-reverse'].includes(styles.flexWrap) ? styles.flexWrap : (defaults.flexWrap || 'nowrap')
  };
}

function normalizeObjectStyles(styles = {}, defaults = objectStyleDefaults) {
  return {
    backgroundColor: styles.backgroundColor || defaults.backgroundColor,
    textColor: styles.textColor || defaults.textColor,
    fontSize: numericStyle(styles.fontSize, defaults.fontSize, 10, 72),
    fontFamily: normalizedFontFamily(styles.fontFamily, defaults.fontFamily),
    fontWeight: numericStyle(styles.fontWeight, defaults.fontWeight, 100, 900),
    padding: numericStyle(styles.padding, defaults.padding, 0, 120),
    borderRadius: numericStyle(styles.borderRadius, defaults.borderRadius, 0, 96),
    maxWidth: numericStyle(styles.maxWidth, defaults.maxWidth, 180, 2400),
    height: numericStyle(styles.height, defaults.height, 0, 2000)
  };
}

function applyObjectStyles(element, styles = {}, options = {}, defaults = objectStyleDefaults) {
  if (!element) return;
  const objectStyles = normalizeObjectStyles(styles, defaults);
  element.style.backgroundColor = objectStyles.backgroundColor;
  element.style.color = objectStyles.textColor;
  element.style.fontSize = `${objectStyles.fontSize}px`;
  element.style.fontFamily = objectStyles.fontFamily;
  element.style.fontWeight = String(objectStyles.fontWeight);
  element.style.padding = `${objectStyles.padding}px`;
  element.style.borderRadius = `${objectStyles.borderRadius}px`;
  if (options.useMaxWidth !== false) {
    element.style.maxWidth = `${objectStyles.maxWidth}px`;
  }
  element.style.minHeight = objectStyles.height > 0 ? `${objectStyles.height}px` : '';
}

function applyCardStyles(element, styles = {}) {
  applyObjectStyles(element, styles, {}, cardObjectDefaults);
  const cardStyles = normalizeObjectStyles(styles, cardObjectDefaults);
  element.querySelectorAll(editableCardTextSelector).forEach((child) => {
    child.style.color = cardStyles.textColor;
  });
}

function setSideWidth(width) {
  siteSideMenu?.closest('.site-body-shell')?.style.setProperty('--side-width', `${width}px`);
}

function escapeSelector(value) {
  return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
}

function colorToHex(value, fallback) {
  if (!value) return fallback;
  if (value.startsWith('#')) return value;
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return fallback;
  return `#${match
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')}`;
}

function readInlineObjectStyles(element, defaults = objectStyleDefaults) {
  if (!element) return normalizeObjectStyles({}, defaults);
  return normalizeObjectStyles(
    {
      backgroundColor: colorToHex(element.style.backgroundColor, defaults.backgroundColor),
      textColor: colorToHex(element.style.color, defaults.textColor),
      fontSize: Number.parseFloat(element.style.fontSize),
      fontFamily: element.style.fontFamily,
      fontWeight: Number.parseFloat(element.style.fontWeight),
      padding: Number.parseFloat(element.style.padding),
      borderRadius: Number.parseFloat(element.style.borderRadius),
      maxWidth: Number.parseFloat(element.style.maxWidth),
      height: Number.parseFloat(element.style.minHeight)
    },
    defaults
  );
}

function applyLinkedElementState(element) {
  if (!element) return;
  const pageId = element.dataset.pageLink || '';
  const linkUrl = normalizePublicHref(element.dataset.linkUrl || (pageId ? pageUrl(pageId, false) : ''));
  if (!linkUrl) {
    element.classList.remove('linked-block');
    return;
  }

  element.dataset.linkUrl = linkUrl;
  element.classList.add('linked-block');
  if (isEditMode) return;

  // A real link stretched over the card (see .linked-block-link): search engines
  // follow it and the card title becomes its anchor text. Not added in the
  // editor, so it never gets saved into the page.
  let link = element.querySelector(':scope > .linked-block-link');
  if (!link) {
    const label = (element.querySelector('h2, h3, h4, strong')?.textContent || element.textContent || '').replace(/s+/g, ' ').trim();
    link = document.createElement('a');
    link.className = 'linked-block-link';
    link.innerHTML = `<span class="visually-hidden">${escapeHtml(label)}</span>`;
    element.append(link);
  }
  link.href = linkUrl;
}

function plainText(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  return template.content.textContent.replace(/s+/g, ' ').trim();
}

// Public site only: images without a description get the nearest heading or the
// page title, so neither search engines nor screen readers meet an empty alt.
function fillMissingAlts(container) {
  if (isEditMode || !container) return;
  container.querySelectorAll('img').forEach((image) => {
    if (image.getAttribute('alt')?.trim()) return;
    let alt = '';
    for (let parent = image.parentElement, depth = 0; parent && depth < 3 && !alt; parent = parent.parentElement, depth += 1) {
      alt = parent.querySelector('h2, h3, h4, strong, figcaption')?.textContent.trim() || '';
    }
    image.alt = alt || pageState?.title || '';
  });
}

// One <h1> per page: the page heading from SEO settings or the page title.
function renderPageHeading() {
  if (!pageState) return;
  let heading = document.querySelector('#pageH1');
  if (!heading) {
    heading = document.createElement('h1');
    heading.id = 'pageH1';
    document.querySelector('.site-main-column')?.prepend(heading);
  }
  heading.textContent = pageState.seo?.h1 || pageState.title || '';
  heading.className = pageState.seo?.showH1 ? 'page-h1' : 'page-h1 visually-hidden';
}

function applyBlockLayout(element, styles = {}) {
  if (!element) return;
  const layout = normalizeLayoutStyles(styles);
  element.style.display = layout.display;
  element.style.flexDirection = layout.flexDirection;
  element.style.justifyContent = layout.justifyContent;
  element.style.alignItems = layout.alignItems;
  element.style.gap = `${layout.gap}px`;
  element.style.padding = `${layout.padding}px`;
  element.style.width = `min(100%, ${layout.maxWidth}px)`;
  element.style.maxWidth = `${layout.maxWidth}px`;
  element.style.minHeight = layout.height > 0 ? `${layout.height}px` : '';
  element.style.flexWrap = layout.flexWrap || 'nowrap';
  if (layout.display === 'grid' && layout.gridColumns > 0) {
    element.style.gridTemplateColumns = `repeat(${layout.gridColumns}, 1fr)`;
  } else {
    element.style.gridTemplateColumns = '';
  }
  if (layout.position === 'left') {
    element.style.marginLeft = '0';
    element.style.marginRight = 'auto';
    element.style.textAlign = 'left';
  } else if (layout.position === 'right') {
    element.style.marginLeft = 'auto';
    element.style.marginRight = '0';
    element.style.textAlign = 'right';
  } else {
    element.style.marginLeft = 'auto';
    element.style.marginRight = 'auto';
    element.style.textAlign = 'center';
  }
  element.style.backgroundColor = layout.backgroundColor;
  element.style.color = layout.textColor;
  element.style.fontSize = `${layout.fontSize}px`;
  element.style.fontFamily = layout.fontFamily;
  element.style.fontWeight = String(layout.fontWeight);
  element.style.borderRadius = `${layout.borderRadius}px`;
}

function setRightWidth(width) {
  const row = document.querySelector('#siteFeatureRow');
  if (!row) return;
  row.style.setProperty('--right-width', `${Math.max(0, Number(width) || 0)}px`);
}

function renderRightPanel() {
  if (!siteRightPanel) return;
  const block = pageBlock('rightPanel');
  const row = document.querySelector('#siteFeatureRow');
  const isVisible = Boolean(block && block.enabled !== false);

  siteRightPanel.hidden = !isVisible;
  row?.classList.toggle('has-right-panel', isVisible);
  if (!isVisible) {
    setRightWidth(0);
    siteRightPanel.innerHTML = '';
    return;
  }

  const styles = normalizeLayoutStyles(block.fields?.styles || rightPanelDefaults, rightPanelDefaults);
  setRightWidth(styles.maxWidth);
  // No whitespace around the saved html: it is read back with innerHTML on save,
  // and template indentation would pile up in the database on every save.
  siteRightPanel.innerHTML = `<div class="right-panel-content custom-block-content" data-block-id="${block.id}" data-edit-block="${block.id}" data-edit-field="html">${(block.fields?.html || widgetTemplate()).trim()}</div>`;
  const content = siteRightPanel.querySelector('.right-panel-content');
  applyBlockLayout(content, styles);
  prepareImageItems(content);
  prepareContainerItems(content);
  if (isEditMode) {
    siteRightPanel.classList.add('builder-block');
    siteRightPanel.onclick = (event) => {
      if (event.target.closest('.builder-widget-remove, .builder-section-remove, .builder-card-remove, .builder-image-remove')) return;
      selectedBuilderBlockId = block.id;
      selectDesignTarget({ type: 'rightPanel', id: block.id });
      syncLayoutControls();
    };
  }
}

function selectedBuilderBlock() {
  return (pageState?.blocks || []).find((block) => block.id === selectedBuilderBlockId);
}

function selectedDesignBlock() {
  if (!selectedDesignTarget) return null;
  if (['card', 'section', 'widget', 'image', 'accordion'].includes(selectedDesignTarget.type)) {
    const element = selectedDesignElement();
    return element ? { type: selectedDesignTarget.type, fields: { styles: readInlineObjectStyles(element, objectDefaultsForSelectedTarget()) } } : null;
  }
  if (selectedDesignTarget.type === 'rightPanel') return pageBlock('rightPanel');
  if (selectedDesignTarget.type === 'block') return blockById(selectedDesignTarget.id);
  if (selectedDesignTarget.type === 'slider') return pageBlock('slider');
  if (selectedDesignTarget.type === 'headerNav') return pageBlock('headerNav');
  if (selectedDesignTarget.type === 'sideMenu') return pageBlock('sideMenu');
  if (selectedDesignTarget.type === 'footer') return pageBlock('footer');
  return null;
}

function selectedDesignElement() {
  if (!selectedDesignTarget) return null;
  if (selectedDesignTarget.type === 'block') {
    return document.querySelector(`[data-block-id="${selectedDesignTarget.id}"] .custom-block-content`);
  }
  if (['card', 'section', 'widget', 'image', 'accordion'].includes(selectedDesignTarget.type)) {
    return document.querySelector(`[data-builder-item-id="${escapeSelector(selectedDesignTarget.id)}"]`);
  }
  if (selectedDesignTarget.type === 'rightPanel') return siteRightPanel?.querySelector('.right-panel-content');
  if (selectedDesignTarget.type === 'slider') return document.querySelector('.site-hero');
  if (selectedDesignTarget.type === 'headerNav') return siteHeaderNav;
  if (selectedDesignTarget.type === 'sideMenu') return siteSideMenu;
  if (selectedDesignTarget.type === 'footer') return siteFooter;
  return null;
}

function selectedDesignStyles(block) {
  return selectedDesignTarget?.type === 'slider' ? block?.fields?.objectStyles : block?.fields?.styles;
}

function objectDefaultsForSelectedTarget() {
  if (selectedDesignTarget?.type === 'headerNav') return headerObjectDefaults;
  if (selectedDesignTarget?.type === 'sideMenu') return sideObjectDefaults;
  if (selectedDesignTarget?.type === 'footer') return footerObjectDefaults;
  if (selectedDesignTarget?.type === 'card') return cardObjectDefaults;
  if (selectedDesignTarget?.type === 'image') return imageObjectDefaults;
  if (selectedDesignTarget?.type === 'accordion') return accordionObjectDefaults;
  if (['section', 'widget'].includes(selectedDesignTarget?.type)) return sectionObjectDefaults;
  return objectStyleDefaults;
}

function normalizeSliderStyles(styles = {}) {
  const alignOptions = ['left', 'center', 'right'];
  return {
    maxWidth: numericStyle(styles.maxWidth, sliderStyleDefaults.maxWidth, 360, 2400),
    align: alignOptions.includes(styles.align) ? styles.align : sliderStyleDefaults.align,
    borderRadius: numericStyle(styles.borderRadius, sliderStyleDefaults.borderRadius, 0, 96),
    height: numericStyle(styles.height, sliderStyleDefaults.height, 0, 2000)
  };
}

function normalizePostsFields(fields = {}) {
  return {
    titleHtml: fields.titleHtml || postsDefaults.titleHtml,
    limit: numericStyle(fields.limit, postsDefaults.limit, 0, 100),
    cardMinWidth: numericStyle(fields.cardMinWidth, postsDefaults.cardMinWidth, 180, 900),
    cardHeight: numericStyle(fields.cardHeight, postsDefaults.cardHeight, 0, 1400),
    coverHeight: numericStyle(fields.coverHeight, postsDefaults.coverHeight, 0, 800),
    maxWidth: numericStyle(fields.maxWidth, postsDefaults.maxWidth, 320, 2400),
    align: ['left', 'center', 'right'].includes(fields.align) ? fields.align : postsDefaults.align,
    allPageId: fields.allPageId || postsDefaults.allPageId,
    allLinkText: fields.allLinkText || postsDefaults.allLinkText,
    showAllLink: fields.showAllLink ?? postsDefaults.showAllLink,
    emptyTitleHtml: fields.emptyTitleHtml || postsDefaults.emptyTitleHtml,
    emptyTextHtml: fields.emptyTextHtml || postsDefaults.emptyTextHtml
  };
}

function normalizeGalleryFields(fields = {}) {
  return {
    titleHtml: fields.titleHtml || galleryDefaults.titleHtml,
    limit: numericStyle(fields.limit, galleryDefaults.limit, 0, 100)
  };
}

function applySliderStyles(styles = {}) {
  const shell = document.querySelector('.site-hero');
  if (!shell) return;
  const sliderStyles = normalizeSliderStyles(styles);
  shell.style.width = `min(100%, ${sliderStyles.maxWidth}px)`;
  shell.style.maxWidth = `${sliderStyles.maxWidth}px`;
  shell.style.borderRadius = `${sliderStyles.borderRadius}px`;
  shell.style.minHeight = sliderStyles.height > 0 ? `${sliderStyles.height}px` : '';

  if (sliderStyles.align === 'left') {
    shell.style.marginLeft = '0';
    shell.style.marginRight = 'auto';
  } else if (sliderStyles.align === 'right') {
    shell.style.marginLeft = 'auto';
    shell.style.marginRight = '0';
  } else {
    shell.style.marginLeft = 'auto';
    shell.style.marginRight = 'auto';
  }
}

function setHeroVisible(isVisible) {
  const shell = document.querySelector('.site-hero');
  if (!shell) return;
  shell.hidden = !isVisible;
}

function cardTemplate(code = '09.01.03', title = 'Оператор информационных систем и ресурсов') {
  return `
    <article class="builder-card-item">
      <span class="builder-card-code">${escapeHtml(code)}</span>
      <h3 class="builder-card-title">${escapeHtml(title)}</h3>
    </article>
  `;
}

function sectionTemplate(title = 'Новый раздел', text = 'Описание раздела можно изменить прямо здесь.') {
  return `
    <section class="builder-section-item">
      <h3 class="builder-section-title">${escapeHtml(title)}</h3>
      <p class="builder-section-text">${escapeHtml(text)}</p>
    </section>
  `;
}

const legacyDivPlaceholderText = 'Удалите этот текст и разместите здесь свой контент';

function upgradeLegacyDivBlocks(page) {
  if (!isEditMode || !Array.isArray(page?.blocks)) return page;

  return {
    ...page,
    blocks: page.blocks.map((block) => {
      if (block?.type !== 'text') return block;

      const title = String(block.fields?.titleHtml || '').trim().toLowerCase();
      const html = String(block.fields?.html || '');
      if (title !== 'новый div' && !html.includes(legacyDivPlaceholderText)) return block;

      return {
        ...block,
        type: 'container',
        fields: {
          ...block.fields,
          html: html.includes(legacyDivPlaceholderText)
            ? sectionTemplate('Новый раздел', 'Добавьте текст, фото, карточку или объект через панель.')
            : html,
          styles: normalizeLayoutStyles(block.fields?.styles)
        }
      };
    })
  };
}

function widgetTemplate() {
  const logo = pageBlock('sideMenu')?.fields?.logoUrl || '';
  return `
    <article class="builder-widget-item">
      <h3 class="builder-widget-title">ОБРАЩЕНИЕ ДИРЕКТОРА</h3>
      <img class="builder-widget-image" src="${escapeHtml(logo)}" alt="">
      <strong class="builder-widget-subtitle">Директор колледжа</strong>
      <p class="builder-widget-text">Добро пожаловать! Здесь можно добавить обращение, объявление или полезную ссылку.</p>
      <a class="builder-widget-link" href="#">Читать полностью</a>
    </article>
  `;
}

function accordionSectionTemplate(title = 'Новый пункт', text = '') {
  return `
    <details class="builder-accordion-section" data-accordion-section-id="accordion-section-${crypto.randomUUID()}" open>
      <summary class="builder-accordion-summary">${escapeHtml(title)}</summary>
      <div class="builder-accordion-content">
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      </div>
    </details>
  `;
}

function accordionTemplate() {
  return `
    <div class="builder-accordion-item">
      ${accordionSectionTemplate()}
    </div>
  `;
}

function imageTemplate(src = '', caption = '') {
  const safeSrc = String(src || '').trim();
  return `
    <figure class="builder-image-item">
      <div class="builder-image-drop" data-image-drop>
        ${
          safeSrc
            ? `<img class="builder-image-preview" src="${escapeHtml(safeSrc)}" alt="${escapeHtml(caption || 'Фото')}">`
            : '<span class="builder-image-placeholder">Нажмите, чтобы загрузить фото</span>'
        }
      </div>
      <figcaption class="builder-image-caption">${escapeHtml(caption || 'Подпись к фото')}</figcaption>
    </figure>
  `;
}

function setBuilderStatus(text) {
  const status = document.querySelector('#builderStatus');
  if (status) status.textContent = text || '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error || new Error('Не удалось прочитать файл')));
    reader.readAsDataURL(file);
  });
}

function chooseImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });
}

async function uploadEditorImageFile(file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Можно загрузить JPG, PNG, WebP или GIF.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Фото слишком большое. Максимум 8 МБ.');
  }

  const response = await editorFetch('/api/uploads/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      type: file.type,
      data: await readFileAsDataUrl(file)
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить фото');
  return payload;
}

async function uploadEditorDataImage(dataUrl, name = 'image') {
  const response = await editorFetch('/api/uploads/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      data: dataUrl
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить фото');
  return payload;
}

function setImageItemSource(item, url, name = '') {
  const drop = item?.querySelector('.builder-image-drop');
  if (!drop) return;
  const safeUrl = String(url || '').trim();
  item.dataset.imageUrl = safeUrl;
  item.classList.toggle('has-image', Boolean(safeUrl));
  item.classList.toggle('is-empty', !safeUrl);
  drop.innerHTML = safeUrl
    ? `<img class="builder-image-preview" src="${escapeHtml(safeUrl)}" alt="${escapeHtml(name || 'Фото')}">`
    : '<span class="builder-image-placeholder">Нажмите, чтобы загрузить фото</span>';
}

async function uploadEmbeddedDataImages() {
  const images = [
    ...document.querySelectorAll('.custom-block-content img[src^="data:image"], .right-panel-content img[src^="data:image"]')
  ];
  if (!images.length) return;

  setBuilderStatus(`Загружаю фото: 0/${images.length}`);
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const uploaded = await uploadEditorDataImage(image.getAttribute('src'), `editor-image-${index + 1}.png`);
    if (uploaded?.url) image.setAttribute('src', uploaded.url);
    setBuilderStatus(`Загружаю фото: ${index + 1}/${images.length}`);
  }
}

async function uploadImageForItem(item) {
  try {
    const file = await chooseImageFile();
    if (!file) return;
    item.classList.add('uploading');
    setBuilderStatus('Загружаю фото...');
    const uploaded = await uploadEditorImageFile(file);
    if (!uploaded?.url) return;
    setImageItemSource(item, uploaded.url, uploaded.name || file.name);
    prepareImageItems(item.parentElement);
    selectInlineItem(item, 'image');
    setBuilderStatus('Фото загружено');
  } catch (error) {
    alert(error.message || 'Не удалось загрузить фото');
    setBuilderStatus('');
  } finally {
    item.classList.remove('uploading');
  }
}

function ensureBuilderItemId(element, type) {
  if (!element.dataset.builderItemId) element.dataset.builderItemId = `${type}-${crypto.randomUUID()}`;
  element.dataset.builderItemType = type;
  return element.dataset.builderItemId;
}

function selectInlineItem(element, type) {
  const id = ensureBuilderItemId(element, type);
  const parentBlock = element.closest('.custom-page-block');
  const rightPanelBlock = element.closest('.site-right-panel') ? pageBlock('rightPanel') : null;
  selectedBuilderBlockId = parentBlock?.dataset.blockId || rightPanelBlock?.id || selectedBuilderBlockId;
  selectedDesignTarget = { type, id };
  showBuilderTab('element');
  syncLayoutControls();
  syncObjectControls();
  syncPageControls();
}

function prepareContainerItems(container) {
  if (!container) return;
  prepareAccordionItems(container);
  container.querySelectorAll('.builder-section-item').forEach((section) => {
    ensureBuilderItemId(section, 'section');
    section.querySelector('.builder-section-remove')?.remove();
    section.querySelectorAll('.builder-section-title, .builder-section-text').forEach((field) => {
      field.contentEditable = isEditMode ? 'true' : 'false';
    });
    applyLinkedElementState(section);

    if (!isEditMode) return;
    section.insertAdjacentHTML(
      'afterbegin',
      '<button class="builder-section-remove" type="button" aria-label="Удалить раздел">×</button>'
    );
    section.querySelector('.builder-section-remove').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedDesignTarget?.id === section.dataset.builderItemId) {
        selectedDesignTarget = null;
        syncObjectControls();
      }
      section.remove();
      recordDeletion();
    });
    section.onclick = (event) => {
      if (event.target.closest('.builder-section-remove')) return;
      event.stopPropagation();
      selectInlineItem(section, 'section');
    };
  });

  container.querySelectorAll('.builder-card-item').forEach((card) => {
    ensureBuilderItemId(card, 'card');
    card.querySelector('.builder-card-remove')?.remove();
    card.querySelectorAll(editableCardTextSelector).forEach((field) => {
      field.contentEditable = isEditMode ? 'true' : 'false';
    });
    applyLinkedElementState(card);

    if (!isEditMode) return;
    card.insertAdjacentHTML(
      'afterbegin',
      '<button class="builder-card-remove" type="button" aria-label="Удалить карточку">×</button>'
    );
    card.querySelector('.builder-card-remove').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedDesignTarget?.id === card.dataset.builderItemId) {
        selectedDesignTarget = null;
        syncObjectControls();
      }
      card.remove();
      recordDeletion();
    });
    card.onclick = (event) => {
      if (event.target.closest('.builder-card-remove')) return;
      event.stopPropagation();
      selectInlineItem(card, 'card');
    };
  });

  container.querySelectorAll('.builder-widget-item').forEach((widget) => {
    ensureBuilderItemId(widget, 'widget');
    widget.querySelector('.builder-widget-remove')?.remove();
    widget.querySelectorAll('.builder-widget-title, .builder-widget-subtitle, .builder-widget-text, .builder-widget-link').forEach((field) => {
      field.contentEditable = isEditMode ? 'true' : 'false';
    });
    applyLinkedElementState(widget);

    if (!isEditMode) return;
    widget.insertAdjacentHTML(
      'afterbegin',
      '<button class="builder-widget-remove" type="button" aria-label="Удалить объект">×</button>'
    );
    widget.querySelector('.builder-widget-remove').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedDesignTarget?.id === widget.dataset.builderItemId) {
        selectedDesignTarget = null;
        syncObjectControls();
      }
      widget.remove();
      recordDeletion();
    });
    widget.onclick = (event) => {
      if (event.target.closest('.builder-widget-remove')) return;
      if (event.target.closest('a')) event.preventDefault();
      event.stopPropagation();
      selectInlineItem(widget, 'widget');
    };
  });
}

function selectedAccordionSection(accordion = selectedDesignElement()) {
  if (!accordion || selectedDesignTarget?.type !== 'accordion') return null;
  return (
    accordion.querySelector(`[data-accordion-section-id="${escapeSelector(selectedAccordionSectionId || '')}"]`) ||
    accordion.querySelector('.builder-accordion-section[open]') ||
    accordion.querySelector('.builder-accordion-section')
  );
}

function selectAccordionSection(accordion, section) {
  if (!accordion || !section) return;
  selectedAccordionSectionId =
    section.dataset.accordionSectionId || `accordion-section-${crypto.randomUUID()}`;
  section.dataset.accordionSectionId = selectedAccordionSectionId;
  accordion.querySelectorAll('.builder-accordion-section').forEach((item) => {
    item.classList.toggle('accordion-section-selected', item === section);
  });
  selectInlineItem(accordion, 'accordion');
  syncAccordionControls();
}

function prepareAccordionItems(container) {
  if (!container) return;
  container.querySelectorAll('.builder-accordion-item').forEach((accordion) => {
    ensureBuilderItemId(accordion, 'accordion');
    if (
      accordion.style.padding === '22px' &&
      accordion.style.borderRadius === '8px' &&
      accordion.style.minHeight === '160px'
    ) {
      accordion.style.padding = '0px';
      accordion.style.borderRadius = '0px';
      accordion.style.minHeight = '';
    }
    accordion.querySelector('.builder-accordion-remove')?.remove();
    accordion.querySelectorAll('.builder-accordion-section-remove').forEach((button) => button.remove());

    accordion.querySelectorAll('.builder-accordion-section').forEach((section) => {
      if (!section.dataset.accordionSectionId) {
        section.dataset.accordionSectionId = `accordion-section-${crypto.randomUUID()}`;
      }
      const summary = section.querySelector('.builder-accordion-summary');
      const content = section.querySelector('.builder-accordion-content');
      if (summary) {
        summary.contentEditable = isEditMode ? 'true' : 'false';
        summary.onkeydown = isEditMode
          ? (event) => {
              if (event.key !== ' ' || event.ctrlKey || event.altKey || event.metaKey) return;
              event.preventDefault();
              event.stopPropagation();
              document.execCommand('insertText', false, ' ');
            }
          : null;
      }
      if (content) content.contentEditable = isEditMode ? 'true' : 'false';

      if (!isEditMode) return;
      section.insertAdjacentHTML(
        'afterbegin',
        '<button class="builder-accordion-section-remove" type="button" aria-label="Удалить пункт списка">×</button>'
      );
      section.querySelector('.builder-accordion-section-remove').onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (accordion.querySelectorAll('.builder-accordion-section').length <= 1) {
          alert('В выпадающем списке должен остаться хотя бы один пункт.');
          return;
        }
        section.remove();
        selectedAccordionSectionId = accordion.querySelector('.builder-accordion-section')?.dataset.accordionSectionId || null;
        syncAccordionControls();
        recordDeletion();
      };
      section.onclick = (event) => {
        if (event.target.closest('.builder-accordion-section-remove')) return;
        event.stopPropagation();
        selectAccordionSection(accordion, section);
      };
    });

    if (!isEditMode) return;
    accordion.insertAdjacentHTML(
      'afterbegin',
      '<button class="builder-accordion-remove" type="button" aria-label="Удалить выпадающий список">×</button>'
    );
    accordion.querySelector('.builder-accordion-remove').onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      accordion.remove();
      selectedDesignTarget = null;
      selectedAccordionSectionId = null;
      syncObjectControls();
      syncLayoutControls();
      recordDeletion();
    };
    accordion.onclick = (event) => {
      if (event.target.closest('.builder-accordion-remove, .builder-accordion-section-remove')) return;
      event.stopPropagation();
      const section = event.target.closest('.builder-accordion-section') || accordion.querySelector('.builder-accordion-section');
      if (section) selectAccordionSection(accordion, section);
    };
  });
}

function prepareImageItems(container) {
  if (!container) return;
  container.querySelectorAll('.builder-image-item').forEach((item) => {
    ensureBuilderItemId(item, 'image');
    item.querySelector('.builder-image-remove')?.remove();
    const hasImage = Boolean(item.querySelector('.builder-image-preview')?.getAttribute('src') || item.dataset.imageUrl);
    item.classList.toggle('has-image', hasImage);
    item.classList.toggle('is-empty', !hasImage);
    item.contentEditable = 'false';
    item.querySelector('.builder-image-caption')?.setAttribute('contenteditable', isEditMode ? 'true' : 'false');

    if (!isEditMode) return;
    item.insertAdjacentHTML(
      'afterbegin',
      '<button class="builder-image-remove" type="button" aria-label="Удалить фото">×</button>'
    );
    item.querySelector('.builder-image-remove').onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedDesignTarget?.id === item.dataset.builderItemId) {
        selectedDesignTarget = null;
        syncObjectControls();
      }
      item.remove();
      recordDeletion();
    };

    const drop = item.querySelector('.builder-image-drop') || item;
    drop.onclick = (event) => {
      if (event.target.closest('.builder-image-remove')) return;
      event.preventDefault();
      event.stopPropagation();
      selectInlineItem(item, 'image');
      void uploadImageForItem(item);
    };

    item.onclick = (event) => {
      if (event.target.closest('.builder-image-remove')) return;
      event.stopPropagation();
      selectInlineItem(item, 'image');
    };
  });
}

function cleanBlockHtml(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  clone
    .querySelectorAll(
      '.builder-card-remove, .builder-section-remove, .builder-widget-remove, .builder-image-remove, .builder-accordion-remove, .builder-accordion-section-remove'
    )
    .forEach((control) => control.remove());
  clone.querySelectorAll('[contenteditable]').forEach((editable) => editable.removeAttribute('contenteditable'));
  clone.querySelectorAll('.design-selected, .uploading, .accordion-section-selected').forEach((item) => {
    item.classList.remove('design-selected', 'uploading', 'accordion-section-selected');
  });
  return clone.innerHTML;
}

function setEditableHtml(selector, html, blockId, field) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.innerHTML = html;
  element.dataset.editBlock = blockId;
  element.dataset.editField = field;
  if (isEditMode) element.contentEditable = 'true';
}

function safeItems(block, fallbackLabels) {
  return Array.isArray(block?.fields?.items) && block.fields.items.length
    ? block.fields.items
    : navItemsFrom(fallbackLabels);
}

function renderHeaderNav() {
  if (!siteHeaderNav) return;
  const block = pageBlock('headerNav');
  if (block?.enabled === false) {
    siteHeaderNav.style.display = 'none';
    siteHeaderNav.hidden = true;
    return;
  }
  siteHeaderNav.style.display = '';
  siteHeaderNav.hidden = false;
  const items = safeItems(block, defaultHeaderItems);
  if (selectedHeaderNavIndex !== null && selectedHeaderNavIndex >= items.length) selectedHeaderNavIndex = items.length ? items.length - 1 : null;
  siteHeaderNav.dataset.designTarget = 'headerNav';
  siteHeaderNav.innerHTML = items
    .map(
      (item, index) =>
        `<a href="${escapeHtml(isEditMode ? item.href || '#' : normalizePublicHref(item.href || '#'))}" data-nav-index="${index}" class="${selectedHeaderNavIndex === index ? 'nav-item-selected' : ''}" ${isEditMode ? 'contenteditable="true"' : ''}>${escapeHtml(item.label)}</a>`
    )
    .join('');
  if (isEditMode) {
    siteHeaderNav.querySelectorAll('a').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedHeaderNavIndex = Number(item.dataset.navIndex);
        selectDesignTarget({ type: 'headerNav' });
        syncPageControls();
      });
    });
  }
  applyObjectStyles(siteHeaderNav, block?.fields?.styles, {}, headerObjectDefaults);
  applyHeaderNavLayout();
}

function applyHeaderNavLayout() {
  if (!siteHeaderNav) return;
  const compact = window.innerWidth <= 920;
  const mobile = window.innerWidth <= 430;
  siteHeaderNav.style.display = 'flex';
  siteHeaderNav.style.alignItems = 'center';
  siteHeaderNav.style.justifyContent = mobile ? 'center' : 'space-between';
  siteHeaderNav.style.flexWrap = mobile ? 'wrap' : 'nowrap';
  siteHeaderNav.style.boxSizing = 'border-box';
  siteHeaderNav.style.width = '100%';
  siteHeaderNav.style.maxWidth = '100vw';
  siteHeaderNav.style.overflow = 'hidden';
  siteHeaderNav.style.gap = mobile ? '6px 10px' : (compact ? '10px' : 'clamp(90px, 10vw, 180px)');
  siteHeaderNav.style.padding = compact
    ? (mobile ? '10px 8px 10px 68px' : '14px 10px 14px 76px')
    : '14px clamp(120px, 18vw, 320px)';
  if (window.innerWidth <= 430) siteHeaderNav.style.fontSize = '14px';
  if (window.innerWidth <= 360) {
    siteHeaderNav.style.gap = '6px';
    siteHeaderNav.style.padding = '14px 8px 14px 68px';
    siteHeaderNav.style.fontSize = '12px';
  }
  siteHeaderNav.querySelectorAll('a').forEach((item) => {
    item.style.minWidth = '0';
    item.style.maxWidth = mobile ? 'calc(100vw - 96px)' : '';
    item.style.whiteSpace = mobile ? 'normal' : 'nowrap';
    item.style.overflowWrap = mobile ? 'anywhere' : '';
    item.style.wordBreak = mobile ? 'break-word' : '';
    item.style.textAlign = mobile ? 'center' : '';
  });
}

function renderSideMenu() {
  if (!siteSideMenu) return;
  const block = pageBlock('sideMenu');
  if (block?.enabled === false) {
    siteSideMenu.style.display = 'none';
    siteSideMenu.hidden = true;
    document.querySelector('.site-body-shell')?.style.setProperty('--side-width', '0px');
    return;
  }
  siteSideMenu.style.display = '';
  siteSideMenu.hidden = false;
  document.querySelector('.site-body-shell')?.style.removeProperty('--side-width');
  const items = safeItems(block, defaultSideItems);
  const titleHtml = block?.fields?.titleHtml || 'Название организации';
  const logoUrl = block?.fields?.logoUrl || '';
  const logoText = block?.fields?.logoText || 'Лого';
  const brandLinkAttrs = isEditMode ? '' : ' role="link" tabindex="0" aria-label="Главная страница"';
  if (selectedSideMenuIndex !== null && selectedSideMenuIndex >= items.length) selectedSideMenuIndex = items.length ? items.length - 1 : null;
  siteSideMenu.dataset.designTarget = 'sideMenu';
  siteSideMenu.innerHTML = `
    <div class="side-brand" data-side-brand${brandLinkAttrs}>
      <div class="side-brand-logo">
        ${
          logoUrl
            ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(`Логотип: ${plainText(titleHtml)}`)}">`
            : `<span>${escapeHtml(logoText)}</span>`
        }
      </div>
      <strong class="side-brand-title" data-side-title ${isEditMode ? 'contenteditable="true"' : ''}>${titleHtml}</strong>
    </div>
    <div class="side-menu-list">
      ${items
        .map(
          (item, index) =>
            `<a href="${escapeHtml(isEditMode ? item.href || '#' : normalizePublicHref(item.href || '#'))}" data-side-index="${index}" class="${selectedSideMenuIndex === index ? 'side-item-selected' : ''}" ${isEditMode ? 'contenteditable="true"' : ''}>${escapeHtml(item.label)}</a>`
        )
        .join('')}
    </div>
  `;
  const brand = siteSideMenu.querySelector('[data-side-brand]');
  if (isEditMode) {
    brand?.addEventListener('click', (event) => {
      event.stopPropagation();
      selectedSideMenuIndex = null;
      selectDesignTarget({ type: 'sideMenu' });
    });
    siteSideMenu.querySelectorAll('.side-menu-list a').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedSideMenuIndex = Number(item.dataset.sideIndex);
        selectDesignTarget({ type: 'sideMenu' });
        syncSideMenuControls();
      });
    });
  } else if (brand) {
    brand.addEventListener('click', () => {
      window.location.href = pageUrl('home', false);
    });
    brand.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      window.location.href = pageUrl('home', false);
    });
  }
  applyObjectStyles(siteSideMenu, block?.fields?.styles, { useMaxWidth: false }, sideObjectDefaults);
  const styles = normalizeObjectStyles(block?.fields?.styles, sideObjectDefaults);
  siteSideMenu.style.width = `${styles.maxWidth}px`;
  setSideWidth(styles.maxWidth);
}

function footerItemsFromDom() {
  if (!siteFooter) return [];
  return [...siteFooter.querySelectorAll('[data-footer-index]')].map((item, index) => ({
    id: pageBlock('footer')?.fields?.items?.[index]?.id || `item-${index + 1}`,
    label: item.textContent.trim(),
    href: item.getAttribute('href') || '#'
  }));
}

function renderFooter() {
  if (!siteFooter) return;
  const block = pageBlock('footer');
  if (block?.enabled === false) {
    siteFooter.hidden = true;
    return;
  }

  siteFooter.hidden = false;
  const fields = { ...footerDefaults, ...(block?.fields || {}) };
  const items = Array.isArray(fields.items) && fields.items.length ? fields.items : defaultFooterItems;
  const editable = isEditMode ? ' contenteditable="true"' : '';
  siteFooter.innerHTML = `
    <div class="site-footer-grid">
      <div>
        <strong class="site-footer-brand" data-footer-field="brandHtml"${editable}>${fields.brandHtml}</strong>
        <div class="site-footer-text" data-footer-field="textHtml"${editable}>${fields.textHtml}</div>
      </div>
      <div>
        <strong class="site-footer-heading">Навигация</strong>
        <nav class="site-footer-nav" aria-label="Навигация в подвале">
          ${items
            .map(
              (item, index) =>
                `<a href="${escapeHtml(isEditMode ? item.href || '#' : normalizePublicHref(item.href || '#'))}" data-footer-index="${index}" class="${selectedFooterIndex === index ? 'footer-item-selected' : ''}"${editable}>${escapeHtml(item.label)}</a>`
            )
            .join('')}
        </nav>
      </div>
      <div class="site-footer-contacts" id="contacts" data-footer-field="contactHtml"${editable}>${fields.contactHtml}</div>
    </div>
    <div class="site-footer-bottom" data-footer-field="copyrightHtml"${editable}>${fields.copyrightHtml}</div>
  `;
  applyObjectStyles(siteFooter, fields.styles, { useMaxWidth: false }, footerObjectDefaults);

}

function hasCookieConsent() {
  try {
    return Boolean(localStorage.getItem(cookieConsentKey));
  } catch {
    return false;
  }
}

function acceptCookies() {
  try {
    localStorage.setItem(cookieConsentKey, JSON.stringify({ acceptedAt: new Date().toISOString() }));
  } catch {
    // Private mode: the notice will show again next visit, nothing else breaks.
  }
  document.querySelector('#cookieNotice')?.remove();
  document.body.classList.remove('has-cookie-notice');
  // Counters (e.g. Yandex Metrica) added later can wait for this event.
  window.dispatchEvent(new CustomEvent('cms:cookie-consent'));
}

function renderCookieNotice() {
  const fields = pageBlock('footer')?.fields || {};
  let notice = document.querySelector('#cookieNotice');
  // In the editor the notice is always shown, so its text can be edited.
  if (fields.cookieNoticeEnabled === false || (!isEditMode && hasCookieConsent())) {
    notice?.remove();
    document.body.classList.remove('has-cookie-notice');
    return;
  }
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'cookieNotice';
    notice.className = 'cookie-notice';
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-label', 'Уведомление об использовании cookie');
    document.body.append(notice);
  }
  const html = fields.cookieNoticeHtml || cookieNoticeDefaults.html;
  const button = escapeHtml(fields.cookieButtonText || cookieNoticeDefaults.button);
  notice.innerHTML = isEditMode
    ? `<div class="cookie-notice-text" data-cookie-field="html" contenteditable="true">${html}</div><span class="cookie-notice-button" data-cookie-field="button" contenteditable="true">${button}</span>`
    : `<div class="cookie-notice-text">${html}</div><button class="cookie-notice-button" type="button">${button}</button>`;
  document.body.classList.add('has-cookie-notice');
  notice.querySelector('button')?.addEventListener('click', acceptCookies);
}

function applyPageContent() {
  document.querySelector('.site-hero-copy')?.remove();
  renderHeaderNav();
  renderSideMenu();
  renderFooter();
  renderCookieNotice();
  const hero = pageBlock('hero');
  const sliderBlock = pageBlock('slider');
  setHeroVisible(hero?.enabled === true || sliderBlock?.enabled === true);
  setEditableHtml('.site-hero-copy .eyebrow', hero?.fields?.eyebrowHtml || 'CMS Engine', 'hero', 'eyebrowHtml');
  setEditableHtml('.site-hero-copy h1', hero?.fields?.titleHtml || 'Публикации сайта', 'hero', 'titleHtml');
  setEditableHtml('.site-hero-copy p:last-child', hero?.fields?.textHtml || 'Материалы появляются здесь после публикации в админке.', 'hero', 'textHtml');
  setEditableHtml('#sliderLabel', sliderBlock?.fields?.labelHtml || 'Избранное', 'slider', 'labelHtml');
  setEditableHtml('#sliderLink', sliderBlock?.fields?.buttonHtml || 'Открыть пост', 'slider', 'buttonHtml');
  applySliderStyles(sliderBlock?.fields?.styles);
  renderRightPanel();
  renderPageHeading();
  fillMissingAlts(siteRightPanel);
}

function customPageBlocks() {
  return (pageState?.blocks || [])
    .filter((block) => ['text', 'container'].includes(block.type) && block.enabled !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function renderCustomBlocks() {
  document.querySelectorAll('.custom-page-block').forEach((block) => block.remove());
  const postsOrder = Number(pageBlock('posts')?.order || 20);
  let lastElement = root;
  for (const block of customPageBlocks()) {
    const isContainer = block.type === 'container';
    const section = document.createElement('section');
    section.className = `custom-page-block builder-block ${isContainer ? 'custom-container-block' : 'custom-text-block'}`;
    section.dataset.blockId = block.id;
    section.dataset.blockType = block.type;
    section.draggable = isEditMode;
    section.innerHTML = `
      ${isEditMode ? '<button class="builder-drag-handle" type="button" title="Потяните, чтобы переместить блок" aria-label="Переместить блок">⠿</button>' : ''}
      ${block.fields?.titleHtml || isEditMode ? `<h2 class="custom-block-title" style="margin: 32px 0 16px 22px; font-size: 30px; line-height: 1.1; ${isEditMode ? 'min-height: 1em; min-width: 50px; outline: none;' : ''}" ${isEditMode ? 'contenteditable="true"' : ''}>${block.fields?.titleHtml !== undefined ? block.fields.titleHtml : 'Заголовок блока'}</h2>` : ''}
      <div class="custom-block-content" data-edit-block="${block.id}" data-edit-field="html">${block.fields?.html || '<p>Новый текстовый блок</p>'}</div>
    `;
    const content = section.querySelector('.custom-block-content');
    if (block.fields?.linkPageId) {
      content.dataset.pageLink = block.fields.linkPageId;
      content.dataset.linkUrl = normalizePublicHref(block.fields.linkUrl || pageUrl(block.fields.linkPageId, false));
    }
    if (isContainer) applyBlockLayout(content, block.fields?.styles);
    if (!isContainer) applyObjectStyles(content, block.fields?.styles);
    applyLinkedElementState(content);
    if (isEditMode && !isContainer) content.contentEditable = 'true';
    prepareImageItems(content);
    if (isContainer) prepareContainerItems(content);
    fillMissingAlts(content);
    if (Number(block.order || 0) < postsOrder) {
      root.before(section);
    } else {
      lastElement.after(section);
      lastElement = section;
    }
  }
}

async function loadPage() {
  try {
    const response = await fetch(`/api/public/page/${encodeURIComponent(currentPageId)}`);
    if (!response.ok) throw new Error('Page not found');
    pageState = upgradeLegacyDivBlocks(await response.json());
  } catch {
    pageState = {
      id: currentPageId,
      title: 'Страница не найдена',
      blocks: [
        { type: 'headerNav', enabled: false },
        { type: 'sideMenu', enabled: false },
        { type: 'hero', enabled: false },
        { type: 'slider', enabled: false },
        { type: 'posts', enabled: false },
        { type: 'text', enabled: true, fields: { html: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center;"><h2>Ошибка 404</h2><p>Эта страница не существует или была удалена.</p></div>' } }
      ]
    };
  }
  if (isEditMode) document.title = pageState?.title || 'Дагестанский медицинский колледж';
  ensureStructuralBlocks();
  applyPageContent();
  renderCustomBlocks();
}

function generateVideoPlayer(url, isCard = false) {
  if (!url) return '';
  const fileId = googleDriveFileId(url);
  const radius = isCard ? '8px 8px 0 0' : '8px';
  const margin = isCard ? '0' : '0 0 24px 0';
  if (fileId) {
    return `
      <div style="position: relative; width: 100%; padding-top: 56.25%; border-radius: ${radius}; margin: ${margin}; overflow: hidden; background: #000;">
        <iframe src="https://drive.google.com/file/d/${escapeHtml(fileId)}/preview" style="position: absolute; top: -56px; left: 0; width: 100%; height: calc(100% + 56px); border: none;" allow="autoplay" allowfullscreen></iframe>
      </div>
    `;
  }
  const style = `width: 100%; aspect-ratio: 16/9; border: none; border-radius: ${radius}; margin: ${margin}; display: block; object-fit: cover; background: #000;`;
  return `<video controls class="post-video" src="${escapeHtml(url)}" style="${style}"></video>`;
}

function renderPostCard(post) {
  const images = imageMedia(post);
  const cover = post.coverImage || images[0]?.url;
  const publishedAt = formatDate(post.publishedAt);
  const href = postUrl(post);

  return `
    <article class="site-post-card">
      ${post.videoUrl ? generateVideoPlayer(post.videoUrl, true) : (cover ? `<a href="${escapeHtml(href)}"><img class="post-card-cover" src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async"></a>` : '')}
      <div class="post-card-body">
        <p class="eyebrow">${escapeHtml(publishedAt)}</p>
        <h2><a href="${escapeHtml(href)}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.excerpt || '')}</p>
        <a class="read-link" href="${escapeHtml(href)}">Читать полностью</a>
      </div>
    </article>
  `;
}

function renderPostDetail(post) {
  if (isEditMode) document.title = post.title || document.title;
  root.innerHTML = postDetailTemplate(post);
}

async function loadPost(slug) {
  const response = await fetch(`/api/public/posts/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    root.innerHTML = '<article class="site-post"><h2>Пост не найден</h2><p>Вернитесь к списку публикаций.</p></article>';
    return;
  }
  renderPostDetail(await response.json());
}

async function loadPosts() {
  const block = pageBlock('posts');
  if (block?.enabled !== true) {
    root.classList.remove('post-grid');
    root.classList.remove('design-selected');
    root.removeAttribute('data-design-target');
    root.innerHTML = '';
    return;
  }
  const settings = normalizePostsFields(block?.fields);
  const response = await fetch('/api/public/posts');
  const posts = await response.json();
  await ensurePostPages(posts);
  const visiblePosts = settings.limit > 0 ? posts.slice(0, settings.limit) : posts;
  const showAllLink = settings.showAllLink && settings.allPageId && currentPageId !== settings.allPageId;
  root.classList.add('post-grid');
  root.dataset.designTarget = 'posts';
  root.style.width = `min(100%, ${settings.maxWidth}px)`;
  root.style.maxWidth = `${settings.maxWidth}px`;
  if (settings.align === 'left') {
    root.style.marginLeft = '0';
    root.style.marginRight = 'auto';
  } else if (settings.align === 'right') {
    root.style.marginLeft = 'auto';
    root.style.marginRight = '0';
  } else {
    root.style.marginLeft = 'auto';
    root.style.marginRight = 'auto';
  }
  root.style.setProperty('--post-card-min-width', `${settings.cardMinWidth}px`);
  root.style.setProperty('--post-card-height', settings.cardHeight > 0 ? `${settings.cardHeight}px` : 'auto');
  root.style.setProperty('--post-cover-height', settings.coverHeight > 0 ? `${settings.coverHeight}px` : 'auto');
  if (isEditMode) {
    root.draggable = true;
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  }
  root.innerHTML = `
    ${isEditMode ? '<button class="builder-drag-handle" type="button" style="position: absolute; top: -16px; right: -16px;">Перетащить</button>' : ''}
    <div class="posts-block-head">
      <h2 class="posts-block-title" ${isEditMode ? 'contenteditable="true"' : ''}>${settings.titleHtml}</h2>
      ${showAllLink ? `<a class="read-link" href="${pageUrl(settings.allPageId, false)}">${escapeHtml(settings.allLinkText)}</a>` : ''}
    </div>
    ${
      visiblePosts.length
        ? visiblePosts.map(renderPostCard).join('')
        : `<article class="site-post"><h2>${settings.emptyTitleHtml}</h2><p>${settings.emptyTextHtml}</p></article>`
    }
  `;
  if (selectedDesignTarget?.type === 'posts') root.classList.add('design-selected');
  if (isEditMode) {
    root.querySelector('.posts-block-title')?.addEventListener('input', (event) => {
      block.fields = normalizePostsFields({
        ...(block.fields || {}),
        titleHtml: event.currentTarget.innerHTML
      });
      syncPostsControls();
    });
  }
}

function removeGalleryBlock() {
  root.querySelector('.site-gallery')?.remove();
}

// Photo gallery, laid out like the photo app on a phone: a tight grid of square
// previews (grouped by month on the full gallery page); a tap opens the photo
// full screen with swiping. Photos come from the media library, which also
// holds every news photo.
const galleryPagePath = '/fotogalereya';
let galleryItems = [];

function galleryMonthLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без даты';
  const label = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date).replace(/\s*г\.$/, '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function galleryTile(item, index) {
  return `
    <button class="gallery-tile" type="button" data-gallery-index="${index}" aria-label="${escapeHtml(item.alt || 'Открыть фото')}">
      <img src="${escapeHtml(item.thumbUrl || item.url)}" alt="${escapeHtml(item.alt || '')}" loading="lazy" decoding="async">
    </button>
  `;
}

function renderGalleryItems(items, settings, { byMonth = false, moreLink = false } = {}) {
  let grid = '';
  if (byMonth) {
    const months = [];
    items.forEach((item, index) => {
      const label = galleryMonthLabel(item.takenAt);
      if (months.at(-1)?.label !== label) months.push({ label, tiles: [] });
      months.at(-1).tiles.push(galleryTile(item, index));
    });
    grid = months
      .map((month) => `<h3 class="gallery-month">${escapeHtml(month.label)}</h3><div class="gallery-grid">${month.tiles.join('')}</div>`)
      .join('');
  } else {
    grid = `<div class="gallery-grid">${items.map(galleryTile).join('')}</div>`;
  }
  return `
    <section class="site-gallery" aria-label="Фотогалерея">
      <div class="site-gallery-head">
        <h2 class="gallery-block-title">${settings.titleHtml}</h2>
        ${moreLink ? `<a class="gallery-all-link" href="${galleryPagePath}">Все фото</a>` : ''}
      </div>
      ${grid}
    </section>
  `;
}

async function loadGallery() {
  removeGalleryBlock();
  const block = pageBlock('gallery');
  // Pages show the gallery when they have a gallery block; the home page also
  // shows it by default, under the news.
  if (block ? block.enabled === false : currentPageId !== 'home') return;

  const settings = normalizeGalleryFields(block?.fields);
  const response = await fetch(`/api/public/gallery${settings.limit > 0 ? `?limit=${settings.limit + 1}` : ''}`);
  if (!response.ok) return;
  const items = await response.json();
  galleryItems = settings.limit > 0 ? items.slice(0, settings.limit) : items;
  if (!galleryItems.length && !isEditMode) return;

  root.insertAdjacentHTML(
    'beforeend',
    renderGalleryItems(galleryItems, settings, {
      byMonth: settings.limit === 0,
      moreLink: settings.limit > 0 && currentPageId !== 'fotogalereya'
    })
  );
  if (!isEditMode) {
    root.querySelector('.site-gallery').addEventListener('click', (event) => {
      const tile = event.target.closest('[data-gallery-index]');
      if (tile) openPhotoViewer(Number(tile.dataset.galleryIndex));
    });
  }
}

const photoViewer = { element: null, index: 0, pointer: null, historyEntry: false };

function preloadPhoto(index) {
  const item = galleryItems[index];
  if (item) new Image().src = item.url;
}

function showViewerPhoto(index) {
  const total = galleryItems.length;
  photoViewer.index = (index + total) % total;
  const item = galleryItems[photoViewer.index];
  const viewer = photoViewer.element;
  const image = viewer.querySelector('.photo-viewer-image');
  // The preview is already in the browser cache: show it at once, then swap in the full photo.
  image.src = item.thumbUrl || item.url;
  image.alt = item.alt || '';
  const full = new Image();
  full.onload = () => {
    if (galleryItems[photoViewer.index] === item) image.src = item.url;
  };
  full.src = item.url;
  image.style.transform = '';

  viewer.querySelector('.photo-viewer-counter').textContent = `${photoViewer.index + 1} из ${total}`;
  viewer.querySelector('.photo-viewer-caption').textContent = item.caption || '';
  const postLink = viewer.querySelector('.photo-viewer-post');
  postLink.hidden = !item.postUrl;
  if (item.postUrl) postLink.href = item.postUrl;
  viewer.querySelectorAll('.photo-viewer-prev, .photo-viewer-next').forEach((button) => {
    button.hidden = total < 2;
  });
  preloadPhoto(photoViewer.index + 1);
  preloadPhoto(photoViewer.index - 1);
}

function closePhotoViewer({ fromHistory = false } = {}) {
  if (!photoViewer.element?.classList.contains('open')) return;
  photoViewer.element.classList.remove('open');
  document.documentElement.classList.remove('photo-viewer-open');
  // The viewer added a history entry so the phone's Back button closes it.
  if (photoViewer.historyEntry && !fromHistory) history.back();
  photoViewer.historyEntry = false;
  root.querySelector(`[data-gallery-index="${photoViewer.index}"]`)?.focus();
}

function createPhotoViewer() {
  const viewer = document.createElement('div');
  viewer.className = 'photo-viewer';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Просмотр фото');
  viewer.innerHTML = `
    <button class="photo-viewer-close" type="button" aria-label="Закрыть">×</button>
    <button class="photo-viewer-prev" type="button" aria-label="Предыдущее фото">‹</button>
    <div class="photo-viewer-stage"><img class="photo-viewer-image" alt="" draggable="false"></div>
    <button class="photo-viewer-next" type="button" aria-label="Следующее фото">›</button>
    <div class="photo-viewer-info">
      <span class="photo-viewer-counter"></span>
      <span class="photo-viewer-caption"></span>
      <a class="photo-viewer-post" href="/" hidden>Открыть новость</a>
    </div>
  `;
  document.body.append(viewer);

  viewer.querySelector('.photo-viewer-close').addEventListener('click', () => closePhotoViewer());
  viewer.querySelector('.photo-viewer-prev').addEventListener('click', () => showViewerPhoto(photoViewer.index - 1));
  viewer.querySelector('.photo-viewer-next').addEventListener('click', () => showViewerPhoto(photoViewer.index + 1));
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer || event.target.classList.contains('photo-viewer-stage')) closePhotoViewer();
  });

  // Swipe left/right for the next photo, down to close; the photo follows the finger.
  const stage = viewer.querySelector('.photo-viewer-stage');
  const image = viewer.querySelector('.photo-viewer-image');
  stage.addEventListener('pointerdown', (event) => {
    photoViewer.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!photoViewer.pointer) return;
    const dx = event.clientX - photoViewer.pointer.x;
    const dy = event.clientY - photoViewer.pointer.y;
    image.style.transform = Math.abs(dx) > Math.abs(dy) ? `translateX(${dx}px)` : `translateY(${Math.max(0, dy)}px)`;
  });
  const endSwipe = (event) => {
    if (!photoViewer.pointer) return;
    const dx = event.clientX - photoViewer.pointer.x;
    const dy = event.clientY - photoViewer.pointer.y;
    photoViewer.pointer = null;
    image.style.transform = '';
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) showViewerPhoto(photoViewer.index + (dx < 0 ? 1 : -1));
    else if (dy > 90) closePhotoViewer();
  };
  stage.addEventListener('pointerup', endSwipe);
  stage.addEventListener('pointercancel', endSwipe);

  document.addEventListener('keydown', (event) => {
    if (!viewer.classList.contains('open')) return;
    if (event.key === 'Escape') closePhotoViewer();
    if (event.key === 'ArrowRight') showViewerPhoto(photoViewer.index + 1);
    if (event.key === 'ArrowLeft') showViewerPhoto(photoViewer.index - 1);
  });
  window.addEventListener('popstate', () => closePhotoViewer({ fromHistory: true }));
  return viewer;
}

function openPhotoViewer(index) {
  if (!galleryItems.length) return;
  photoViewer.element ||= createPhotoViewer();
  showViewerPhoto(index);
  photoViewer.element.classList.add('open');
  document.documentElement.classList.add('photo-viewer-open');
  history.pushState({ photoViewer: true }, '');
  photoViewer.historyEntry = true;
  photoViewer.element.querySelector('.photo-viewer-close').focus();
}

function renderSlider(index) {
  const post = slider.posts[index];
  if (!post) return;
  const cover = postCover(post);
  const href = postUrl(post);

  slider.index = index;
  slider.root.style.setProperty('--slider-transition-ms', `${slider.settings.transitionMs}ms`);
  slider.title.textContent = post.title;
  slider.excerpt.textContent = post.excerpt || '';
  slider.link.href = href;
  slider.media.style.backgroundImage = cover
    ? `linear-gradient(90deg, rgba(17, 24, 39, 0.82), rgba(17, 24, 39, 0.26)), url("${cover}")`
    : '';
  slider.media.style.backgroundPosition = cover ? `center, ${sliderImagePosition(post)}` : '';
  slider.media.style.backgroundSize = cover ? `100% 100%, ${sliderImageFit(post)}` : '';
  slider.media.style.backgroundRepeat = cover ? 'no-repeat, no-repeat' : '';
  slider.dots.querySelectorAll('button').forEach((button, buttonIndex) => {
    button.classList.toggle('active', buttonIndex === index);
  });
}

function moveSlider(direction) {
  if (slider.posts.length <= 1) return;
  const nextIndex = (slider.index + direction + slider.posts.length) % slider.posts.length;
  renderSlider(nextIndex);
}

function startSliderTimer() {
  clearInterval(slider.timer);
  if (!slider.settings.autoplay) return;
  slider.timer = setInterval(() => {
    if (!slider.paused) moveSlider(1);
  }, slider.settings.intervalMs);
}

async function loadSlider() {
  if (pageBlock('slider')?.enabled === false) {
    slider.root.hidden = true;
    setHeroVisible(false);
    return;
  }
  const response = await fetch('/api/public/slider');
  const payload = await response.json();
  const posts = Array.isArray(payload) ? payload : payload.posts || [];
  slider.settings = { ...slider.settings, ...(payload.settings || {}) };
  slider.posts = posts;

  if (!slider.settings.enabled || !posts.length) {
    slider.root.hidden = true;
    setHeroVisible(false);
    return;
  }

  setHeroVisible(true);
  slider.root.hidden = false;
  slider.controls.hidden = !slider.settings.showControls;
  slider.dots.hidden = !slider.settings.showDots;
  slider.pause.hidden = true;
  slider.label.innerHTML = fieldHtml('slider', 'labelHtml', 'Избранное');
  slider.link.innerHTML = fieldHtml('slider', 'buttonHtml', 'Открыть пост');
  slider.dots.innerHTML = posts
    .map((post, index) => `<button type="button" aria-label="Слайд ${index + 1}" data-slide="${index}"></button>`)
    .join('');
  renderSlider(0);
  startSliderTimer();
}

function updateTextBlockOrderFromDom() {
  const elements = document.querySelectorAll('.custom-page-block, #publicPosts');
  let currentOrder = 10;
  elements.forEach((element) => {
    if (element.id === 'publicPosts') {
      const pb = pageBlock('posts');
      if (pb) pb.order = currentOrder;
    } else {
      const blockId = element.dataset.blockId;
      const block = pageState.blocks.find(b => b.id === blockId);
      if (block) block.order = currentOrder;
    }
    currentOrder += 10;
  });
}

function syncLayoutControls() {
  schedulePanelContext();
  const form = document.querySelector('#builderLayoutForm');
  const hint = document.querySelector('#builderBlockHint');
  const cardActions = document.querySelector('#builderCardActions');
  const deleteButton = document.querySelector('#builderDeleteBlock');
  if (!form || !hint || !cardActions) return;

  const block = selectedBuilderBlock();
  const isContainer = ['container', 'rightPanel'].includes(block?.type);
  const isCustomBlock = ['text', 'container', 'rightPanel'].includes(block?.type);
  const canDelete = ['card', 'section', 'widget', 'image', 'accordion'].includes(selectedDesignTarget?.type) || isCustomBlock;
  const canDuplicate = ['card', 'section', 'widget', 'image', 'accordion', 'block'].includes(selectedDesignTarget?.type) && selectedDesignTarget?.type !== 'rightPanel';
  
  form.hidden = !isContainer;
  cardActions.hidden = !isContainer;
  if (deleteButton) deleteButton.disabled = !canDelete;
  const duplicateButton = document.querySelector('#builderDuplicateItem');
  if (duplicateButton) duplicateButton.disabled = !canDuplicate;
  
  hint.textContent = isContainer
    ? 'Текст карточек меняйте прямо на странице, лишние удаляйте крестиком.'
    : '';

  document.querySelectorAll('.custom-page-block').forEach((element) => {
    element.classList.toggle('selected', element.dataset.blockId === selectedBuilderBlockId);
  });

  if (!isContainer) return;
  const layout = normalizeLayoutStyles(block.fields?.styles, block.type === 'rightPanel' ? rightPanelDefaults : layoutDefaults);
  form.querySelectorAll('[data-style-field]').forEach((control) => {
    const field = control.dataset.styleField;
    control.value = layout[field];
  });
}

function sideMenuItemsFromDom() {
  const block = pageBlock('sideMenu');
  return [...siteSideMenu.querySelectorAll('.side-menu-list a')].map((item, index) => ({
    id: block?.fields?.items?.[index]?.id || `item-${index + 1}`,
    label: item.textContent.trim() || `Пункт ${index + 1}`,
    href: item.getAttribute('href') || block?.fields?.items?.[index]?.href || '#'
  }));
}

function headerNavItemsFromDom() {
  const block = pageBlock('headerNav');
  return [...siteHeaderNav.querySelectorAll('a')].map((item, index) => ({
    id: block?.fields?.items?.[index]?.id || `item-${index + 1}`,
    label: item.textContent.trim() || `Раздел ${index + 1}`,
    href: item.getAttribute('href') || block?.fields?.items?.[index]?.href || '#'
  }));
}

function syncSideMenuControls() {
  const actions = document.querySelector('#builderSideMenuActions');
  const hint = document.querySelector('#builderSideMenuHint');
  const deleteButton = document.querySelector('#builderDeleteSideItem');
  const titleInput = document.querySelector('#builderSideTitle');
  const logoInput = document.querySelector('#builderSideLogoUrl');
  if (!actions || !hint || !deleteButton) return;

  const isSideMenu = selectedDesignTarget?.type === 'sideMenu';
  actions.hidden = !isSideMenu;
  if (!isSideMenu) return;

  const block = pageBlock('sideMenu');
  if (titleInput) titleInput.value = siteSideMenu.querySelector('[data-side-title]')?.textContent.trim() || block?.fields?.titleHtml || '';
  if (logoInput) logoInput.value = block?.fields?.logoUrl || '';
  updateLogoControls();
  const items = sideMenuItemsFromDom();
  const selected = selectedSideMenuIndex !== null ? items[selectedSideMenuIndex] : null;
  deleteButton.disabled = !selected;
  hint.textContent = selected
    ? `Выбран пункт: ${selected.label}`
    : 'Кликните по пункту слева, чтобы удалить именно его.';
}

function updateSideMenuBrandFromControls() {
  const block = pageBlock('sideMenu');
  if (!block) return;
  const titleInput = document.querySelector('#builderSideTitle');
  const logoInput = document.querySelector('#builderSideLogoUrl');
  block.fields = block.fields || {};
  block.fields.titleHtml = escapeHtml(titleInput?.value || 'Название организации');
  block.fields.logoUrl = logoInput?.value.trim() || '';
  renderSideMenu();
  selectDesignTarget({ type: 'sideMenu' });
  syncSideMenuControls();
}

function addSideMenuItem() {
  const block = pageBlock('sideMenu');
  if (!block) return;
  block.fields = block.fields || {};
  const items = sideMenuItemsFromDom();
  items.push({
    id: `item-${crypto.randomUUID()}`,
    label: `Новый пункт ${items.length + 1}`,
    href: '#'
  });
  block.fields.items = items;
  selectedSideMenuIndex = items.length - 1;
  renderSideMenu();
  selectDesignTarget({ type: 'sideMenu' });
  syncSideMenuControls();
  siteSideMenu.querySelector(`[data-side-index="${selectedSideMenuIndex}"]`)?.focus();
}

function deleteSelectedSideMenuItem() {
  const block = pageBlock('sideMenu');
  if (!block || selectedSideMenuIndex === null) return;
  block.fields = block.fields || {};
  const items = sideMenuItemsFromDom();
  if (!items[selectedSideMenuIndex]) return;
  items.splice(selectedSideMenuIndex, 1);
  block.fields.items = items;
  selectedSideMenuIndex = items.length ? Math.min(selectedSideMenuIndex, items.length - 1) : null;
  renderSideMenu();
  selectDesignTarget({ type: 'sideMenu' });
  syncSideMenuControls();
}

function syncFooterControls() {
  const actions = document.querySelector('#builderFooterActions');
  const hint = document.querySelector('#builderFooterHint');
  const deleteButton = document.querySelector('#builderDeleteFooterItem');
  if (!actions || !hint || !deleteButton) return;

  const isFooter = selectedDesignTarget?.type === 'footer';
  actions.hidden = !isFooter;
  if (!isFooter) return;
  const cookieToggle = document.querySelector('#builderCookieNoticeEnabled');
  if (cookieToggle) cookieToggle.checked = pageBlock('footer')?.fields?.cookieNoticeEnabled !== false;

  const items = footerItemsFromDom();
  const selected = selectedFooterIndex !== null ? items[selectedFooterIndex] : null;
  deleteButton.disabled = !selected;
  hint.textContent = selected
    ? `Выбран пункт: ${selected.label || 'без названия'}`
    : 'Кликните по пункту навигации в футере, чтобы удалить или привязать страницу.';
}

function addFooterItem() {
  const block = pageBlock('footer');
  if (!block) return;
  block.fields = block.fields || {};
  const items = footerItemsFromDom();
  items.push({
    id: `item-${crypto.randomUUID()}`,
    label: `Новый пункт ${items.length + 1}`,
    href: '#'
  });
  block.fields.items = items;
  selectedFooterIndex = items.length - 1;
  renderFooter();
  selectDesignTarget({ type: 'footer' });
  syncFooterControls();
  siteFooter.querySelector(`[data-footer-index="${selectedFooterIndex}"]`)?.focus();
}

function deleteSelectedFooterItem() {
  const block = pageBlock('footer');
  if (!block || selectedFooterIndex === null) return;
  block.fields = block.fields || {};
  const items = footerItemsFromDom();
  if (!items[selectedFooterIndex]) return;
  items.splice(selectedFooterIndex, 1);
  block.fields.items = items;
  selectedFooterIndex = items.length ? Math.min(selectedFooterIndex, items.length - 1) : null;
  renderFooter();
  selectDesignTarget({ type: 'footer' });
  syncFooterControls();
}

async function loadPagesIndex() {
  try {
    const response = await editorFetch('/api/pages');
    pagesIndex = response.ok ? await response.json() : [];
  } catch {
    pagesIndex = [];
  }
  if (!pagesIndex.some((page) => page.id === currentPageId)) {
    pagesIndex.push({ id: currentPageId, title: pageState?.title || currentPageId });
  }
}

function syncPageControls() {
  const current = document.querySelector('#builderCurrentPage');
  const target = document.querySelector('#builderPageTarget');
  const attach = document.querySelector('#builderAttachPage');
  const hint = document.querySelector('#builderPageHint');
  if (!current || !target || !attach || !hint) return;

  schedulePanelContext();
  current.textContent = pageState?.title || currentPageId;
  const options = pagesIndex
    .map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.title || page.id)}</option>`)
    .join('');
  for (const select of [target, document.querySelector('#builderPagesList')]) {
    if (!select) continue;
    const selectedValue = select.value || currentPageId;
    select.innerHTML = options;
    select.value = pagesIndex.some((page) => page.id === selectedValue) ? selectedValue : currentPageId;
  }

  const canAttach =
    selectedSideMenuIndex !== null ||
    selectedHeaderNavIndex !== null ||
    selectedFooterIndex !== null ||
    ['card', 'section', 'block'].includes(selectedDesignTarget?.type);
  attach.disabled = !canAttach;
  hint.textContent = canAttach
    ? 'Выберите страницу и нажмите кнопку — по клику на элемент посетитель попадёт на неё.'
    : '';
}

function syncSeoControls() {
  const seo = pageState?.seo || {};
  const title = document.querySelector('#builderSeoTitle');
  const description = document.querySelector('#builderSeoDescription');
  const image = document.querySelector('#builderSeoImage');
  const noIndex = document.querySelector('#builderSeoNoIndex');
  const publicUrl = document.querySelector('#builderSeoPublicUrl');
  if (!title || !description || !image || !noIndex || !publicUrl) return;

  title.value = seo.title || '';
  description.value = seo.description || '';
  const h1 = document.querySelector('#builderSeoH1');
  if (h1) {
    h1.value = seo.h1 || '';
    h1.placeholder = pageState?.title || '';
  }
  const showH1 = document.querySelector('#builderSeoShowH1');
  if (showH1) showH1.checked = Boolean(seo.showH1);
  image.value = seo.image || '';
  noIndex.checked = Boolean(seo.noIndex);
  publicUrl.href = pageUrl(currentPageId, false);
  publicUrl.textContent = pageUrl(currentPageId, false);
}

function updateSeoFromControls() {
  pageState.seo = {
    title: document.querySelector('#builderSeoTitle')?.value.trim() || '',
    description: document.querySelector('#builderSeoDescription')?.value.trim() || '',
    image: document.querySelector('#builderSeoImage')?.value.trim() || '',
    noIndex: Boolean(document.querySelector('#builderSeoNoIndex')?.checked),
    h1: document.querySelector('#builderSeoH1')?.value.trim() || '',
    showH1: Boolean(document.querySelector('#builderSeoShowH1')?.checked)
  };
  renderPageHeading();
}

function pageTemplate(pageId, title) {
  const header = pageBlock('headerNav');
  const side = pageBlock('sideMenu');
  const footer = pageBlock('footer');
  return {
    id: pageId,
    title,
    seo: { title: '', description: '', image: '', noIndex: false },
    blocks: [
      header ? deepCopy(header) : null,
      side ? deepCopy(side) : null,
      footer ? deepCopy(footer) : null,
      {
        id: 'slider',
        type: 'slider',
        enabled: false,
        order: 10,
        fields: { labelHtml: 'Избранное', buttonHtml: 'Открыть пост' }
      },
      {
        id: 'posts',
        type: 'posts',
        enabled: false,
        order: 20,
        fields: {}
      },
      {
        id: crypto.randomUUID(),
        type: 'text',
        enabled: true,
        order: 30,
        fields: {
          html: `<h2>${escapeHtml(title)}</h2><p>Новая страница. Здесь можно добавить текст, div-блоки, карточки и ссылки.</p>`,
          styles: { ...objectStyleDefaults, maxWidth: 1060 }
        }
      }
    ].filter(Boolean)
  };
}

async function createPageFromEditor() {
  pageState = collectPageFromDom();
  const input = document.querySelector('#builderNewPageTitle');
  const title = input?.value.trim() || 'Новая страница';
  const existingIds = new Set(pagesIndex.map((page) => page.id));
  const baseId = sanitizePageId(title);
  let pageId = baseId;
  let suffix = 2;
  while (existingIds.has(pageId)) pageId = `${baseId}-${suffix++}`;

  const response = await editorFetch(`/api/pages/${encodeURIComponent(pageId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pageTemplate(pageId, title))
  });
  const page = await response.json();
  pagesIndex = [...pagesIndex.filter((item) => item.id !== page.id), page].sort((a, b) =>
    String(a.title).localeCompare(String(b.title), 'ru')
  );
  if (input) input.value = '';
  syncPageControls();
  syncPostsControls();
  // Ready to open it or to link a menu item to it right away.
  for (const select of document.querySelectorAll('#builderPageTarget, #builderPagesList')) select.value = page.id;
  const status = document.querySelector('#builderStatus');
  if (status) status.textContent = 'Страница создана';
}

async function attachPageToSelected() {
  const target = document.querySelector('#builderPageTarget');
  const pageId = target?.value;
  if (!pageId) return;
  const href = pageUrl(pageId, false);

  if (selectedSideMenuIndex !== null) {
    const block = pageBlock('sideMenu');
    block.fields = block.fields || {};
    block.fields.items = sideMenuItemsFromDom();
    if (block.fields.items[selectedSideMenuIndex]) block.fields.items[selectedSideMenuIndex].href = href;
    renderSideMenu();
  } else if (selectedHeaderNavIndex !== null) {
    const block = pageBlock('headerNav');
    block.fields = block.fields || {};
    block.fields.items = headerNavItemsFromDom();
    if (block.fields.items[selectedHeaderNavIndex]) block.fields.items[selectedHeaderNavIndex].href = href;
    renderHeaderNav();
  } else if (selectedFooterIndex !== null) {
    const block = pageBlock('footer');
    block.fields = block.fields || {};
    block.fields.items = footerItemsFromDom();
    if (block.fields.items[selectedFooterIndex]) block.fields.items[selectedFooterIndex].href = href;
    renderFooter();
  } else if (['card', 'section'].includes(selectedDesignTarget?.type)) {
    const element = selectedDesignElement();
    if (!element) return;
    element.dataset.pageLink = pageId;
    element.dataset.linkUrl = href;
    applyLinkedElementState(element);
  } else if (selectedDesignTarget?.type === 'block') {
    const block = selectedBuilderBlock();
    const element = selectedDesignElement();
    if (!block || !element) return;
    block.fields = block.fields || {};
    block.fields.linkPageId = pageId;
    block.fields.linkUrl = href;
    element.dataset.pageLink = pageId;
    element.dataset.linkUrl = href;
    applyLinkedElementState(element);
  }

  syncPageControls();
  await persistCurrentPage(`Ссылка: ${pageTitleFromId(pageId)}`);
}

function openSelectedPage() {
  const pageId = document.querySelector('#builderPagesList')?.value || currentPageId;
  window.location.href = pageUrl(pageId, true);
}

async function deleteSelectedPage() {
  const pageId = document.querySelector('#builderPagesList')?.value;
  if (!pageId || pageId === 'home') {
    alert('Нельзя удалить главную страницу (home).');
    return;
  }
  if (!confirm('Вы уверены, что хотите удалить эту страницу?')) return;
  
  try {
    const response = await editorFetch(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Ошибка удаления');
    if (currentPageId === pageId) {
      window.location.href = pageUrl('home', true);
    } else {
      window.location.reload();
    }
  } catch (err) {
    alert(err.message);
  }
}

function syncObjectControls() {
  schedulePanelContext();
  const form = document.querySelector('#builderObjectForm');
  const hint = document.querySelector('#builderObjectHint');
  if (!form || !hint) return;

  const block = selectedDesignBlock();
  const element = selectedDesignElement();
  const hasTarget = Boolean(block && element);
  form.hidden = !hasTarget;
  syncSideMenuControls();
  syncFooterControls();
  syncAccordionControls();
  if (selectedDesignTarget?.type === 'card') {
    hint.textContent = 'Фон и текст меняют цвет только выбранной карточки.';
  } else if (selectedDesignTarget?.type === 'image') {
    hint.textContent = 'Кликните по фото-зоне, чтобы загрузить или заменить изображение.';
  } else if (selectedDesignTarget?.type === 'section') {
    hint.textContent = 'Настройки применяются только к выбранному разделу.';
  } else if (selectedDesignTarget?.type === 'accordion') {
    hint.textContent = 'Выберите пункт списка, чтобы добавлять в него текст и блоки.';
  } else if (selectedDesignTarget?.type === 'footer') {
    hint.textContent = 'Текст и ссылки подвала меняйте прямо на странице.';
  } else {
    hint.textContent = hasTarget
      ? 'Изменения видны на странице сразу.'
      : '';
  }

  document.querySelectorAll('.design-selected').forEach((item) => item.classList.remove('design-selected'));
  if (element) element.classList.add('design-selected');

  if (!hasTarget) return;
  const styles = normalizeObjectStyles(block.fields?.styles, objectDefaultsForSelectedTarget());
  form.querySelectorAll('[data-object-style-field]').forEach((control) => {
    control.value = styles[control.dataset.objectStyleField];
  });

  const widgetForm = document.querySelector('#builderWidgetForm');
  if (widgetForm) {
    const isWidget = selectedDesignTarget?.type === 'widget';
    widgetForm.hidden = !isWidget;
    if (isWidget && element) {
      const img = element.querySelector('.builder-widget-image');
      const btn = element.querySelector('.builder-widget-link');
      
      const imgRadiusInput = widgetForm.querySelector('[data-widget-style-field="imgRadius"]');
      if (imgRadiusInput) imgRadiusInput.value = img ? parseInt(img.style.borderRadius || '0') || 0 : 0;
      
      const btnTextInput = widgetForm.querySelector('[data-widget-style-field="btnText"]');
      if (btnTextInput) btnTextInput.value = btn ? btn.textContent.trim() : '';

      const btnSizeInput = widgetForm.querySelector('[data-widget-style-field="btnSize"]');
      if (btnSizeInput) btnSizeInput.value = btn ? parseInt(btn.style.fontSize || '14') || 14 : 14;
      
      const btnLinkInput = widgetForm.querySelector('[data-widget-style-field="btnLink"]');
      if (btnLinkInput) btnLinkInput.value = btn ? btn.getAttribute('href') || '#' : '#';
      
      const btnBgInput = widgetForm.querySelector('[data-widget-style-field="btnBg"]');
      if (btnBgInput) btnBgInput.value = btn ? colorToHex(btn.style.backgroundColor, '#087789') : '#087789';
      
      const btnColorInput = widgetForm.querySelector('[data-widget-style-field="btnColor"]');
      if (btnColorInput) btnColorInput.value = btn ? colorToHex(btn.style.color, '#ffffff') : '#ffffff';
      
      const btnAlignInput = widgetForm.querySelector('[data-widget-style-field="btnAlign"]');
      if (btnAlignInput) btnAlignInput.value = btn ? btn.style.justifySelf || 'start' : 'start';
    }
  }

  syncSideMenuControls();
  syncFooterControls();
  syncAccordionControls();
}

function selectDesignTarget(target) {
  selectedDesignTarget = target;
  showBuilderTab('element');
  if (target?.type !== 'accordion') selectedAccordionSectionId = null;
  if (target?.type !== 'sideMenu') selectedSideMenuIndex = null;
  if (target?.type !== 'headerNav') selectedHeaderNavIndex = null;
  if (target?.type !== 'footer') selectedFooterIndex = null;
  syncObjectControls();
  syncPostsControls();
  syncPageControls();
}

function selectBuilderBlock(blockId) {
  selectedBuilderBlockId = blockId;
  selectDesignTarget({ type: 'block', id: blockId });
  syncLayoutControls();
}

function deleteSelectedBlock() {
  if (!selectedDesignTarget) return;
  
  if (['card', 'section', 'widget', 'image', 'accordion'].includes(selectedDesignTarget.type)) {
    const element = selectedDesignElement();
    if (element) element.remove();
  } else if (selectedDesignTarget.type === 'block') {
    const block = selectedBuilderBlock();
    if (!['text', 'container', 'rightPanel'].includes(block?.type)) return;
    pageState.blocks = pageState.blocks.filter((item) => item.id !== block.id);
    document.querySelector(`[data-block-id="${block.id}"]`)?.remove();
    if (block.type === 'rightPanel') renderRightPanel();
  } else {
    return;
  }
  
  selectedBuilderBlockId = null;
  selectedDesignTarget = null;
  syncLayoutControls();
  syncObjectControls();
  recordDeletion();
}

function duplicateSelectedItem() {
  if (!selectedDesignTarget) return;

  if (selectedDesignTarget.type === 'block') {
    const block = selectedBuilderBlock();
    if (!block || block.type === 'rightPanel') return;
    const index = pageState.blocks.findIndex(b => b.id === block.id);
    if (index !== -1) {
      const clone = deepCopy(block);
      clone.id = 'b' + crypto.randomUUID().split('-')[0];
      pageState.blocks.splice(index + 1, 0, clone);
      renderCustomBlocks();
    }
  } else if (['card', 'section', 'widget', 'image', 'accordion'].includes(selectedDesignTarget.type)) {
    const element = selectedDesignElement();
    if (!element || !element.parentNode) return;
    const clone = element.cloneNode(true);
    clone.dataset.builderItemId = 'i' + crypto.randomUUID().split('-')[0];
    clone.classList.remove('design-selected');
    element.parentNode.insertBefore(clone, element.nextSibling);
    prepareContainerItems(element.parentNode);
    
    selectedDesignTarget = { type: selectedDesignTarget.type, id: clone.dataset.builderItemId };
    syncLayoutControls();
    syncObjectControls();
  }
  
  const status = document.querySelector('#builderStatus');
  if (status) status.textContent = 'Скопировано';
}

// Blocks are re-rendered after adding, undo and redo; bind listeners once per element.
const dragReadyBlocks = new WeakSet();
const selectionReadyBlocks = new WeakSet();
let draggedId = null;

function setupBlockDrag() {
  document.querySelectorAll('.custom-page-block, #publicPosts').forEach((block) => {
    if (dragReadyBlocks.has(block)) return;
    dragReadyBlocks.add(block);
    block.addEventListener('dragstart', () => {
      draggedId = block.dataset.blockId || (block.id === 'publicPosts' ? 'posts' : null);
      block.classList.add('dragging');
    });
    block.addEventListener('dragend', () => block.classList.remove('dragging'));
    block.addEventListener('dragover', (event) => event.preventDefault());
    block.addEventListener('drop', (event) => {
      event.preventDefault();
      const dragged = draggedId === 'posts' ? document.querySelector('#publicPosts') : document.querySelector(`[data-block-id="${draggedId}"]`);
      if (!dragged || dragged === block) return;
      const after = event.clientY > block.getBoundingClientRect().top + block.offsetHeight / 2;
      block[after ? 'after' : 'before'](dragged);
      updateTextBlockOrderFromDom();
    });
  });
}

function setupBlockSelection() {
  document.querySelectorAll('.custom-page-block').forEach((block) => {
    if (selectionReadyBlocks.has(block)) return;
    selectionReadyBlocks.add(block);
    block.addEventListener('click', (event) => {
      if (!event.target.closest('.custom-page-block')) return;
      selectBuilderBlock(block.dataset.blockId);
    });
  });
}

function setupDesignSelection() {
  siteHeaderNav?.addEventListener('click', (event) => {
    if (!isEditMode) return;
    event.preventDefault();
    selectedHeaderNavIndex = null;
    selectDesignTarget({ type: 'headerNav' });
  });
  siteSideMenu?.addEventListener('click', (event) => {
    if (!isEditMode) return;
    event.preventDefault();
    selectedSideMenuIndex = null;
    selectDesignTarget({ type: 'sideMenu' });
  });
  siteFooter?.addEventListener('pointerdown', (event) => {
    if (!isEditMode) return;
    const item = event.target.closest('[data-footer-index]');
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    selectedFooterIndex = Number(item.dataset.footerIndex);
    siteFooter.querySelectorAll('[data-footer-index]').forEach((link) => link.classList.remove('footer-item-selected'));
    item.classList.add('footer-item-selected');
    selectDesignTarget({ type: 'footer' });
  });
  root?.addEventListener('click', (event) => {
    if (!isEditMode) return;
    if (event.target.closest('a')) event.preventDefault();
    event.stopPropagation();
    selectDesignTarget({ type: 'posts' });
  });
}

function updateSelectedLayout(control) {
  const block = selectedBuilderBlock();
  if (!block || !['container', 'rightPanel'].includes(block.type)) return;
  const field = control.dataset.styleField;
  const value = control.type === 'number' ? Number(control.value) : control.value;
  block.fields = block.fields || {};
  block.fields.styles = normalizeLayoutStyles({
    ...(block.fields.styles || {}),
    [field]: value
  }, block.type === 'rightPanel' ? rightPanelDefaults : layoutDefaults);
  if (block.type === 'rightPanel') {
    renderRightPanel();
    return;
  }
  applyBlockLayout(document.querySelector(`[data-block-id="${block.id}"] .custom-block-content`), block.fields.styles);
}

function setupLayoutControls() {
  const form = document.querySelector('#builderLayoutForm');
  if (!form) return;
  form.addEventListener('input', (event) => {
    const control = event.target.closest('[data-style-field]');
    if (control) updateSelectedLayout(control);
  });
  form.addEventListener('change', (event) => {
    const control = event.target.closest('[data-style-field]');
    if (control) updateSelectedLayout(control);
  });
}

function updateObjectStyle(control) {
  const block = selectedDesignBlock();
  const element = selectedDesignElement();
  if (!block || !element) return;

  const field = control.dataset.objectStyleField;
  const value = control.type === 'number' ? Number(control.value) : control.value;

  if (['card', 'section', 'widget', 'image', 'accordion'].includes(selectedDesignTarget?.type)) {
    const defaults = objectDefaultsForSelectedTarget();
    const styles = normalizeObjectStyles(
      {
        ...readInlineObjectStyles(element, defaults),
        [field]: value
      },
      defaults
    );
    if (selectedDesignTarget.type === 'card') applyCardStyles(element, styles);
    else applyObjectStyles(element, styles, {}, defaults);
    syncObjectControls();
    return;
  }

  block.fields = block.fields || {};

  if (selectedDesignTarget?.type === 'block' && block.type === 'container') {
    block.fields.styles = normalizeLayoutStyles({
      ...(block.fields.styles || {}),
      [field]: value
    });
    applyBlockLayout(element, block.fields.styles);
    return;
  }

  block.fields.styles = normalizeObjectStyles(
    {
      ...(block.fields.styles || {}),
      [field]: value
    },
    objectDefaultsForSelectedTarget()
  );

  if (selectedDesignTarget?.type === 'sideMenu') {
    applyObjectStyles(element, block.fields.styles, { useMaxWidth: false }, sideObjectDefaults);
    element.style.width = `${block.fields.styles.maxWidth}px`;
    setSideWidth(block.fields.styles.maxWidth);
    return;
  }

  if (selectedDesignTarget?.type === 'rightPanel') {
    block.fields.styles = normalizeLayoutStyles(
      {
        ...(block.fields.styles || {}),
        [field]: value
      },
      rightPanelDefaults
    );
    renderRightPanel();
    return;
  }

  if (selectedDesignTarget?.type === 'headerNav') {
    applyObjectStyles(element, block.fields.styles, {}, headerObjectDefaults);
    return;
  }

  if (selectedDesignTarget?.type === 'footer') {
    applyObjectStyles(element, block.fields.styles, { useMaxWidth: false }, footerObjectDefaults);
    return;
  }

  applyObjectStyles(element, block.fields.styles);
}

function setupObjectControls() {
  const form = document.querySelector('#builderObjectForm');
  if (!form) return;
  form.addEventListener('input', (event) => {
    const control = event.target.closest('[data-object-style-field]');
    if (control) updateObjectStyle(control);
  });
  form.addEventListener('change', (event) => {
    const control = event.target.closest('[data-object-style-field]');
    if (control) updateObjectStyle(control);
  });
  const widgetForm = document.querySelector('#builderWidgetForm');
  if (widgetForm) {
    const handler = (event) => {
      const control = event.target.closest('[data-widget-style-field]');
      if (!control) return;
      const element = selectedDesignElement();
      if (!element || selectedDesignTarget?.type !== 'widget') return;
      const field = control.dataset.widgetStyleField;
      const img = element.querySelector('.builder-widget-image');
      const btn = element.querySelector('.builder-widget-link');
      if (field === 'imgRadius' && img) img.style.setProperty('border-radius', `${Number(control.value) || 0}px`, 'important');
      else if (field === 'btnText' && btn) btn.textContent = control.value;
      else if (field === 'btnLink' && btn) btn.href = control.value;
      else if (field === 'btnSize' && btn) btn.style.setProperty('font-size', `${Number(control.value) || 14}px`, 'important');
      else if (field === 'btnBg' && btn) btn.style.setProperty('background-color', control.value, 'important');
      else if (field === 'btnColor' && btn) btn.style.setProperty('color', control.value, 'important');
      else if (field === 'btnAlign' && btn) btn.style.setProperty('justify-self', control.value, 'important');
    };
    widgetForm.addEventListener('input', handler);
    widgetForm.addEventListener('change', handler);
  }
}

function syncPostsControls() {
  schedulePanelContext();
  const form = document.querySelector('#builderPostsForm');
  const hint = document.querySelector('#builderPostsHint');
  const block = pageBlock('posts');
  const isSelected = selectedDesignTarget?.type === 'posts';
  root.classList.toggle('design-selected', isSelected);
  if (!form || !hint) return;

  form.hidden = !isSelected || !block;
  hint.textContent = isSelected
    ? 'Настройки применяются к блоку новостей на этой странице.'
    : 'Кликните по блоку новостей на странице, чтобы менять его.';
  if (form.hidden) return;

  const fields = normalizePostsFields(block.fields);
  const pageSelect = form.querySelector('[data-posts-field="allPageId"]');
  if (pageSelect) {
    const selectedValue = pageSelect.value || fields.allPageId;
    pageSelect.innerHTML = pagesIndex
      .map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.title || page.id)}</option>`)
      .join('');
    pageSelect.value = pagesIndex.some((page) => page.id === selectedValue) ? selectedValue : fields.allPageId;
  }

  form.querySelectorAll('[data-posts-field]').forEach((control) => {
    const field = control.dataset.postsField;
    if (control.type === 'checkbox') control.checked = Boolean(fields[field]);
    else control.value = fields[field];
  });
}

function updatePostsSettings(control) {
  const block = pageBlock('posts');
  if (!block) return;
  const field = control.dataset.postsField;
  const value = control.type === 'checkbox'
    ? control.checked
    : control.type === 'number'
      ? Number(control.value)
      : control.value;
  block.fields = normalizePostsFields({
    ...(block.fields || {}),
    [field]: value
  });
  void loadPosts().then(syncPostsControls);
}

function setupPostsControls() {
  const form = document.querySelector('#builderPostsForm');
  if (!form) return;
  form.addEventListener('input', (event) => {
    const control = event.target.closest('[data-posts-field]');
    if (control) updatePostsSettings(control);
  });
  form.addEventListener('change', (event) => {
    const control = event.target.closest('[data-posts-field]');
    if (control) updatePostsSettings(control);
  });
}

function syncSliderControls() {
  const form = document.querySelector('#builderSliderForm');
  if (!form) return;
  const styles = normalizeSliderStyles(pageBlock('slider')?.fields?.styles);
  form.querySelectorAll('[data-slider-style-field]').forEach((control) => {
    control.value = styles[control.dataset.sliderStyleField];
  });
}

function updateSliderStyle(control) {
  const block = pageBlock('slider');
  if (!block) return;
  const field = control.dataset.sliderStyleField;
  const value = control.type === 'number' ? Number(control.value) : control.value;
  block.fields = block.fields || {};
  block.fields.styles = normalizeSliderStyles({
    ...(block.fields.styles || {}),
    [field]: value
  });
  applySliderStyles(block.fields.styles);
}

function setupSliderControls() {
  const form = document.querySelector('#builderSliderForm');
  if (!form) return;
  form.addEventListener('input', (event) => {
    const control = event.target.closest('[data-slider-style-field]');
    if (control) updateSliderStyle(control);
  });
  form.addEventListener('change', (event) => {
    const control = event.target.closest('[data-slider-style-field]');
    if (control) updateSliderStyle(control);
  });
}

function selectedInsertionContainer() {
  if (selectedDesignTarget?.type === 'accordion') {
    return selectedAccordionSection()?.querySelector('.builder-accordion-content') || null;
  }
  const block = selectedBuilderBlock();
  if (!block || !['container', 'rightPanel'].includes(block.type)) return null;
  return block.type === 'rightPanel'
    ? siteRightPanel?.querySelector('.right-panel-content') || null
    : document.querySelector(`[data-block-id="${block.id}"] .custom-block-content`);
}

function addCardToSelectedDiv() {
  const container = selectedInsertionContainer();
  if (!container) return;
  container.insertAdjacentHTML('beforeend', cardTemplate('00.00.00', 'Новая карточка'));
  prepareContainerItems(container);
}

function addSectionToSelectedDiv() {
  const container = selectedInsertionContainer();
  if (!container) return;
  container.insertAdjacentHTML('beforeend', sectionTemplate());
  prepareContainerItems(container);
}

function addWidgetToSelectedDiv() {
  const container = selectedInsertionContainer();
  if (!container) return;
  container.insertAdjacentHTML('beforeend', widgetTemplate());
  prepareContainerItems(container);
}

function addAccordionToSelectedDiv() {
  const container = selectedInsertionContainer();
  if (!container) return;
  container.insertAdjacentHTML('beforeend', accordionTemplate());
  prepareContainerItems(container);
  const accordion = [...container.querySelectorAll('.builder-accordion-item')].pop();
  const section = accordion?.querySelector('.builder-accordion-section');
  if (accordion && section) selectAccordionSection(accordion, section);
}

function syncAccordionControls() {
  const form = document.querySelector('#builderAccordionForm');
  if (!form) return;
  const accordion = selectedDesignTarget?.type === 'accordion' ? selectedDesignElement() : null;
  form.hidden = !accordion;
  if (!accordion) return;
  const section = selectedAccordionSection(accordion);
  form.querySelector('#builderDeleteAccordionSection').disabled =
    !section || accordion.querySelectorAll('.builder-accordion-section').length <= 1;
}

function addAccordionSection() {
  const accordion = selectedDesignTarget?.type === 'accordion' ? selectedDesignElement() : null;
  if (!accordion) return;
  accordion.insertAdjacentHTML('beforeend', accordionSectionTemplate());
  prepareAccordionItems(accordion.parentElement);
  const section = [...accordion.querySelectorAll('.builder-accordion-section')].pop();
  if (section) selectAccordionSection(accordion, section);
}

function addTextToAccordionSection() {
  const content = selectedAccordionSection()?.querySelector('.builder-accordion-content');
  if (!content) return;
  content.insertAdjacentHTML('beforeend', '<p>Новый текст. Нажмите и отредактируйте его.</p>');
  content.contentEditable = 'true';
  content.focus();
}

function deleteAccordionSection() {
  const accordion = selectedDesignTarget?.type === 'accordion' ? selectedDesignElement() : null;
  const section = selectedAccordionSection(accordion);
  if (!accordion || !section || accordion.querySelectorAll('.builder-accordion-section').length <= 1) return;
  section.remove();
  selectedAccordionSectionId = accordion.querySelector('.builder-accordion-section')?.dataset.accordionSectionId || null;
  syncAccordionControls();
  recordDeletion();
}

function selectedContentContainer() {
  if (selectedDesignTarget?.type === 'accordion') {
    return selectedAccordionSection()?.querySelector('.builder-accordion-content') || null;
  }
  const block = selectedBuilderBlock();
  if (!block) return null;
  if (block.type === 'rightPanel') return siteRightPanel?.querySelector('.right-panel-content') || null;
  if (['text', 'container'].includes(block.type)) {
    return document.querySelector(`[data-block-id="${block.id}"] .custom-block-content`);
  }
  return null;
}

function addImageToSelectedBlock() {
  let container = selectedContentContainer();
  if (!container) {
    const maxOrder = Math.max(30, ...pageState.blocks.map((block) => Number(block.order || 0)));
    const id = crypto.randomUUID();
    pageState.blocks.push({
      id,
      type: 'text',
      enabled: true,
      order: maxOrder + 10,
      fields: {
        titleHtml: 'Фото',
        html: imageTemplate(),
        styles: { ...objectStyleDefaults, maxWidth: 1060, padding: 0 }
      }
    });
    renderCustomBlocks();
    setupBlockDrag();
    setupBlockSelection();
    selectBuilderBlock(id);
    container = selectedContentContainer();
  } else {
    container.insertAdjacentHTML('beforeend', imageTemplate());
  }

  prepareImageItems(container);
  prepareContainerItems(container);
  const image = [...container.querySelectorAll('.builder-image-item')].pop();
  if (image) selectInlineItem(image, 'image');
  setBuilderStatus('Кликните по фото-зоне, чтобы загрузить изображение');
}

function collectPageFromDom() {
  const blocks = pageState.blocks.map((block) => {
    if (block.type === 'headerNav') {
      return {
        ...block,
        fields: {
          ...block.fields,
          items: headerNavItemsFromDom(),
          styles: normalizeObjectStyles(block.fields?.styles, headerObjectDefaults)
        }
      };
    }
    if (block.type === 'sideMenu') {
      return {
        ...block,
        fields: {
          ...block.fields,
          titleHtml: siteSideMenu.querySelector('[data-side-title]')?.innerHTML || block.fields?.titleHtml || 'Название организации',
          logoUrl: block.fields?.logoUrl || '',
          logoText: block.fields?.logoText || 'Лого',
          items: sideMenuItemsFromDom(),
          styles: normalizeObjectStyles(block.fields?.styles, sideObjectDefaults)
        }
      };
    }
    if (block.type === 'footer') {
      return {
        ...block,
        fields: {
          ...block.fields,
          brandHtml: siteFooter.querySelector('[data-footer-field="brandHtml"]')?.innerHTML || footerDefaults.brandHtml,
          textHtml: siteFooter.querySelector('[data-footer-field="textHtml"]')?.innerHTML || footerDefaults.textHtml,
          contactHtml: siteFooter.querySelector('[data-footer-field="contactHtml"]')?.innerHTML || footerDefaults.contactHtml,
          copyrightHtml: siteFooter.querySelector('[data-footer-field="copyrightHtml"]')?.innerHTML || footerDefaults.copyrightHtml,
          items: footerItemsFromDom(),
          cookieNoticeEnabled: block.fields?.cookieNoticeEnabled !== false,
          cookieNoticeHtml: document.querySelector('#cookieNotice [data-cookie-field="html"]')?.innerHTML.trim() || block.fields?.cookieNoticeHtml || cookieNoticeDefaults.html,
          cookieButtonText: document.querySelector('#cookieNotice [data-cookie-field="button"]')?.textContent.trim() || block.fields?.cookieButtonText || cookieNoticeDefaults.button,
          styles: normalizeObjectStyles(block.fields?.styles, footerObjectDefaults)
        }
      };
    }
    if (block.type === 'hero') {
      return block;
    }
    if (block.type === 'slider') {
      return {
        ...block,
        fields: {
          ...block.fields,
          labelHtml: slider.label?.innerHTML || '',
          buttonHtml: slider.link?.innerHTML || '',
          styles: normalizeSliderStyles(block.fields?.styles)
        }
      };
    }
    if (block.type === 'posts') {
      return {
        ...block,
        fields: normalizePostsFields({
          ...(block.fields || {}),
          titleHtml: root.querySelector('.posts-block-title')?.innerHTML || block.fields?.titleHtml
        })
      };
    }
    if (block.type === 'rightPanel') {
      const content = siteRightPanel?.querySelector('.right-panel-content');
      return {
        ...block,
        fields: {
          ...block.fields,
          html: cleanBlockHtml(content),
          styles: normalizeLayoutStyles(block.fields?.styles, rightPanelDefaults)
        }
      };
    }
    if (['text', 'container'].includes(block.type)) {
      const content = document.querySelector(`[data-block-id="${block.id}"] .custom-block-content`);
      const titleEl = document.querySelector(`[data-block-id="${block.id}"] .custom-block-title`);
      return {
        ...block,
        fields: {
          ...block.fields,
          html: cleanBlockHtml(content),
          titleHtml: titleEl ? titleEl.innerHTML : (block.fields?.titleHtml || ''),
          ...(block.type === 'container'
            ? { styles: normalizeLayoutStyles(block.fields?.styles) }
            : { styles: normalizeObjectStyles(block.fields?.styles) })
        }
      };
    }
    return block;
  });
  return { ...pageState, blocks };
}

async function persistCurrentPage(statusText = 'Сохранено') {
  await uploadEmbeddedDataImages();
  pageState = collectPageFromDom();
  const response = await editorFetch(`/api/pages/${encodeURIComponent(currentPageId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pageState)
  });
  if (!response.ok) {
    let message = 'Не удалось сохранить страницу';
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }
  pageState = await response.json();
  if (editorHistory.entries.length) markEditorSaved();
  void updateSeoPreview();

  setBuilderStatus(statusText);
  setTimeout(() => {
    const status = document.querySelector('#builderStatus');
    if (status) status.textContent = '';
  }, 1800);
}

async function saveEditor() {
  try {
    await persistCurrentPage('Сохранено');
  } catch (error) {
    setBuilderStatus('Ошибка сохранения');
    alert(error.message || 'Не удалось сохранить страницу');
  }
}

function addTextBlock() {
  const maxOrder = Math.max(30, ...pageState.blocks.map((block) => Number(block.order || 0)));
  const id = crypto.randomUUID();
  pageState.blocks.push({
    id,
    type: 'text',
    enabled: true,
    order: maxOrder + 10,
    fields: { html: '<h2>Новый блок</h2><p>Напишите текст, выделите фразу и добавьте ссылку.</p>' }
  });
  renderCustomBlocks();
  setupBlockDrag();
  setupBlockSelection();
  selectBuilderBlock(id);
}

function addDivBlock() {
  const maxOrder = Math.max(30, ...pageState.blocks.map((block) => Number(block.order || 0)));
  const id = crypto.randomUUID();
  pageState.blocks.push({
    id,
    type: 'container',
    enabled: true,
    order: maxOrder + 10,
    fields: {
      titleHtml: 'Новый Div',
      html: sectionTemplate('Новый раздел', 'Добавьте текст, фото, карточку или объект через панель.'),
      styles: {
        ...layoutDefaults,
        maxWidth: 1140,
        backgroundColor: 'transparent',
        padding: 0,
        borderRadius: 0
      }
    }
  });
  renderCustomBlocks();
  setupBlockDrag();
  setupBlockSelection();
  selectBuilderBlock(id);
}

function addRightPanel() {
  let block = pageBlock('rightPanel');
  if (!block) {
    block = {
      id: 'site-right-panel',
      type: 'rightPanel',
      enabled: true,
      order: -10,
      fields: {
        html: widgetTemplate(),
        styles: { ...rightPanelDefaults }
      }
    };
    pageState.blocks.push(block);
  } else {
    block.enabled = true;
    block.fields = block.fields || {};
    block.fields.html = block.fields.html || widgetTemplate();
    block.fields.styles = normalizeLayoutStyles(block.fields.styles || rightPanelDefaults, rightPanelDefaults);
  }
  renderRightPanel();
  selectedBuilderBlockId = block.id;
  selectDesignTarget({ type: 'rightPanel', id: block.id });
  syncLayoutControls();
}

function addSectionRowBlock() {
  const maxOrder = Math.max(30, ...pageState.blocks.map((block) => Number(block.order || 0)));
  const id = crypto.randomUUID();
  pageState.blocks.push({
    id,
    type: 'container',
    enabled: true,
    order: maxOrder + 10,
    fields: {
      html: [
        sectionTemplate('Раздел 1', 'Добавьте текст, кнопку или ссылку.'),
        sectionTemplate('Раздел 2', 'Этот блок стоит в одном ряду.'),
        sectionTemplate('Раздел 3', 'Разделы можно удалять и редактировать.')
      ].join(''),
      styles: {
        ...layoutDefaults,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 18,
        maxWidth: 1140,
        backgroundColor: '#ffffff',
        padding: 0,
        borderRadius: 0
      }
    }
  });
  renderCustomBlocks();
  setupBlockDrag();
  setupBlockSelection();
  selectBuilderBlock(id);
}

function addLinkToSelection() {
  openLinkDialog();
}

function clampPanelPosition(panel, left, top) {
  const margin = 10;
  const rect = panel.getBoundingClientRect();
  return {
    left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - rect.width - margin)),
    top: Math.min(Math.max(64, top), Math.max(64, window.innerHeight - 80))
  };
}

function applyBuilderPanelPosition(panel, position) {
  if (!panel || !position) return;
  const next = clampPanelPosition(panel, Number(position.left) || 18, Number(position.top) || 78);
  panel.style.right = 'auto';
  panel.style.left = `${next.left}px`;
  panel.style.top = `${next.top}px`;
}

function resetBuilderPanelPosition() {
  const panel = document.querySelector('#builderPanel');
  if (!panel) return;
  localStorage.removeItem(builderPanelPositionKey);
  panel.style.left = '';
  panel.style.top = '';
  panel.style.right = '18px';
}

function setupFloatingBuilderPanel() {
  const panel = document.querySelector('#builderPanel');
  const handle = document.querySelector('#builderPanelHandle');
  const reset = document.querySelector('#builderPanelReset');
  if (!panel || !handle) return;

  try {
    const saved = JSON.parse(localStorage.getItem(builderPanelPositionKey) || 'null');
    if (saved) applyBuilderPanelPosition(panel, saved);
  } catch {
    localStorage.removeItem(builderPanelPositionKey);
  }

  reset?.addEventListener('click', resetBuilderPanelPosition);

  let dragOffset = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    panel.style.width = `${rect.width}px`;
    panel.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragOffset) return;
    const next = clampPanelPosition(panel, event.clientX - dragOffset.x, event.clientY - dragOffset.y);
    panel.style.right = 'auto';
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
  });

  function stopDrag(event) {
    if (!dragOffset) return;
    dragOffset = null;
    panel.classList.remove('dragging');
    const rect = panel.getBoundingClientRect();
    localStorage.setItem(builderPanelPositionKey, JSON.stringify({ left: rect.left, top: rect.top }));
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }

  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);

  window.addEventListener('resize', () => {
    const rect = panel.getBoundingClientRect();
    if (panel.style.left) applyBuilderPanelPosition(panel, { left: rect.left, top: rect.top });
  });
}

// Rich text tools: floating formatting bar, link dialog, replacing photos by file.
const richTextSelector = '.custom-block-content, .right-panel-content';
let savedLinkRange = null;
let editedLink = null;

function richEditableFromNode(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const editable = element?.closest('[contenteditable="true"]');
  return editable?.closest(richTextSelector) ? editable : null;
}

function currentRichRange() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return richEditableFromNode(range.commonAncestorContainer) ? range : null;
}

function restoreRange(range) {
  if (!range) return;
  richEditableFromNode(range.commonAncestorContainer)?.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateFormatBar() {
  const bar = document.querySelector('#builderFormatBar');
  if (!bar) return;
  const range = currentRichRange();
  if (!range || range.collapsed || document.querySelector('#builderLinkDialog')?.open) {
    bar.hidden = true;
    return;
  }

  const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
  const active = {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    h2: block === 'h2',
    h3: block === 'h3',
    ul: document.queryCommandState('insertUnorderedList'),
    ol: document.queryCommandState('insertOrderedList'),
    link: Boolean(range.commonAncestorContainer.parentElement?.closest('a') || range.cloneContents().querySelector?.('a'))
  };
  bar.querySelectorAll('[data-format]').forEach((button) => {
    button.classList.toggle('is-active', Boolean(active[button.dataset.format]));
  });

  bar.hidden = false;
  const rect = range.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const topLimit = (document.querySelector('.builder-bar')?.getBoundingClientRect().bottom || 0) + 8;
  let top = rect.top - barRect.height - 10;
  if (top < topLimit) top = rect.bottom + 10;
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - barRect.width / 2), window.innerWidth - barRect.width - 8);
  bar.style.top = `${Math.round(top)}px`;
  bar.style.left = `${Math.round(left)}px`;
}

function applyFormat(format) {
  const range = currentRichRange();
  if (!range) return;
  const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
  if (format === 'bold' || format === 'italic') document.execCommand(format);
  // Pressing the active heading again turns it back into a paragraph.
  if (format === 'h2' || format === 'h3') document.execCommand('formatBlock', false, block === format ? '<p>' : `<${format}>`);
  if (format === 'ul') document.execCommand('insertUnorderedList');
  if (format === 'ol') document.execCommand('insertOrderedList');
  if (format === 'clear') {
    document.execCommand('removeFormat');
    if (['h2', 'h3', 'h4'].includes(block)) document.execCommand('formatBlock', false, '<p>');
  }
  if (format === 'link') {
    openLinkDialog();
    return;
  }
  updateFormatBar();
}

function linkTargetFromValue(value) {
  const text = String(value || '').trim();
  if (!text) return { error: 'Укажите адрес.' };
  if (/^(https?:|mailto:|tel:)/i.test(text) || text.startsWith('/') || text.startsWith('#')) return { href: text };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { href: `mailto:${text}` };
  if (/^\+?[\d\s()-]{6,}$/.test(text)) return { href: `tel:${text.replace(/[^\d+]/g, '')}` };
  if (/^[\p{L}\d-]+(\.[\p{L}\d-]+)+(\/\S*)?$/u.test(text)) return { href: `https://${text}` };
  return { error: 'Не похоже на адрес сайта, почту или телефон.' };
}

function setLinkDialogKind(kind) {
  const dialog = document.querySelector('#builderLinkDialog');
  dialog.querySelectorAll('[data-link-kind]').forEach((field) => {
    field.hidden = field.dataset.linkKind !== kind;
  });
  dialog.querySelector(`input[name="linkKind"][value="${kind}"]`).checked = true;
  // External sites usually open in a new tab, own pages in the same one.
  dialog.querySelector('#builderLinkNewTab').checked = kind === 'url';
}

function openLinkDialog() {
  const range = currentRichRange();
  if (!range) {
    setBuilderStatus('Выделите слово в текстовом блоке. Пункт меню или карточку сделайте ссылкой через раздел «Ссылка» в панели.');
    return;
  }
  savedLinkRange = range.cloneRange();
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  editedLink = startElement?.closest('a') || null;

  const dialog = document.querySelector('#builderLinkDialog');
  const pageSelect = dialog.querySelector('#builderLinkPage');
  pageSelect.innerHTML = pagesIndex
    .filter((page) => !String(page.id).startsWith('post-'))
    .map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.title || page.id)}</option>`)
    .join('');

  const selectedText = (editedLink?.textContent || range.toString()).trim();
  dialog.querySelector('#builderLinkText').textContent = selectedText ? `Текст ссылки: «${selectedText.slice(0, 80)}»` : 'Текст ссылки будет таким же, как название страницы или адрес.';
  dialog.querySelector('#builderLinkError').hidden = true;
  dialog.querySelector('#builderLinkRemove').hidden = !editedLink;

  const href = editedLink?.getAttribute('href') || '';
  const linkedPage = pagesIndex.find((page) => href && pageUrl(page.id, false) === href);
  if (linkedPage || !href) {
    setLinkDialogKind('page');
    if (linkedPage) pageSelect.value = linkedPage.id;
    dialog.querySelector('#builderLinkUrl').value = '';
  } else {
    setLinkDialogKind('url');
    dialog.querySelector('#builderLinkUrl').value = href.replace(/^mailto:|^tel:/, '');
  }
  if (editedLink) dialog.querySelector('#builderLinkNewTab').checked = editedLink.target === '_blank';

  document.querySelector('#builderFormatBar').hidden = true;
  dialog.showModal();
}

function applyLinkDialog() {
  const dialog = document.querySelector('#builderLinkDialog');
  const kind = dialog.querySelector('input[name="linkKind"]:checked').value;
  const pageSelect = dialog.querySelector('#builderLinkPage');
  const target = kind === 'page'
    ? { href: pageUrl(pageSelect.value, false), label: pageSelect.selectedOptions[0]?.textContent || '' }
    : linkTargetFromValue(dialog.querySelector('#builderLinkUrl').value);
  if (target.error || !target.href) {
    const error = dialog.querySelector('#builderLinkError');
    error.textContent = target.error || 'Выберите страницу.';
    error.hidden = false;
    return;
  }
  // A mail or phone link opens an app, not a page: a new tab would stay empty.
  const newTab = dialog.querySelector('#builderLinkNewTab').checked && !/^(mailto|tel):/i.test(target.href);
  dialog.close();
  restoreRange(savedLinkRange);

  let links = [];
  if (editedLink) {
    editedLink.setAttribute('href', target.href);
    links = [editedLink];
  } else if (savedLinkRange?.collapsed) {
    const marker = `link-${crypto.randomUUID()}`;
    const label = target.label || dialog.querySelector('#builderLinkUrl').value.trim() || target.href;
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(target.href)}" data-new-link="${marker}">${escapeHtml(label)}</a>`);
    links = [...document.querySelectorAll(`[data-new-link="${marker}"]`)];
  } else {
    // createLink gives no handle on the new anchors; mark them through a unique href first.
    const marker = `#cms-new-link-${crypto.randomUUID()}`;
    document.execCommand('createLink', false, marker);
    links = [...document.querySelectorAll(`a[href="${marker}"]`)];
    links.forEach((link) => link.setAttribute('href', target.href));
  }
  for (const link of links) {
    link.removeAttribute('data-new-link');
    if (newTab) {
      link.target = '_blank';
      link.rel = 'noopener';
    } else {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  }
  savedLinkRange = null;
  editedLink = null;
  scheduleEditorCapture();
}

function removeLinkFromDialog() {
  const dialog = document.querySelector('#builderLinkDialog');
  dialog.close();
  if (editedLink) editedLink.replaceWith(...editedLink.childNodes);
  savedLinkRange = null;
  editedLink = null;
  scheduleEditorCapture();
}

async function replaceImageFromFile(applyUrl, doneText = 'Фото заменено') {
  try {
    const file = await chooseImageFile();
    if (!file) return;
    setBuilderStatus('Загружаю фото...');
    const uploaded = await uploadEditorImageFile(file);
    if (!uploaded?.url) return;
    applyUrl(uploaded.url);
    setBuilderStatus(doneText);
  } catch (error) {
    setBuilderStatus('');
    alert(error.message || 'Не удалось загрузить фото');
  }
}

function selectedImageElement() {
  const element = ['image', 'widget'].includes(selectedDesignTarget?.type) ? selectedDesignElement() : null;
  return element?.querySelector('.builder-image-preview, .builder-widget-image') || null;
}

// Shows what search engines get as the page snippet right now (saved version).
async function updateSeoPreview() {
  const preview = document.querySelector('#builderSeoPreview');
  if (!preview) return;
  if (document.querySelector('#builderSeoDescription')?.value.trim()) {
    preview.textContent = '';
    return;
  }
  try {
    const html = await (await fetch(pageUrl(currentPageId, false), { cache: 'no-store' })).text();
    const description = new DOMParser().parseFromString(html, 'text/html').querySelector('meta[name="description"]')?.content || '';
    const weak = !description || description.startsWith(`${pageState?.title || ''} — `);
    preview.classList.toggle('is-warning', weak);
    preview.textContent = weak
      ? 'На странице почти нет текста, и поисковик покажет только её название. Напишите описание выше.'
      : `Сейчас в поиске (если оставить поле пустым): «${description}»`;
  } catch {
    preview.textContent = '';
  }
}

function replaceSelectedImage() {
  const element = selectedDesignElement();
  if (!element) return;
  if (selectedDesignTarget?.type === 'image') {
    void uploadImageForItem(element);
  } else if (selectedDesignTarget?.type === 'widget') {
    const image = element.querySelector('.builder-widget-image');
    if (image) void replaceImageFromFile((url) => image.setAttribute('src', url));
  }
}

function updateLogoControls() {
  const url = pageBlock('sideMenu')?.fields?.logoUrl || '';
  const preview = document.querySelector('#builderLogoPreview');
  if (preview) preview.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Логотип">` : '<span>Нет логотипа</span>';
  const remove = document.querySelector('#builderRemoveLogo');
  if (remove) remove.hidden = !url;
}

function setLogoUrl(url) {
  const input = document.querySelector('#builderSideLogoUrl');
  if (input) input.value = url;
  updateSideMenuBrandFromControls();
  updateLogoControls();
}

function uploadLogo() {
  void replaceImageFromFile(setLogoUrl, 'Логотип загружен');
}

function setupRichTextTools() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div class="builder-format-bar" id="builderFormatBar" role="toolbar" aria-label="Оформление текста" hidden>
        <button type="button" data-format="bold" title="Жирный (Ctrl+B)"><strong>Ж</strong></button>
        <button type="button" data-format="italic" title="Курсив (Ctrl+I)"><em>К</em></button>
        <button type="button" data-format="h2" title="Заголовок">Заголовок</button>
        <button type="button" data-format="h3" title="Подзаголовок">Подзаголовок</button>
        <button type="button" data-format="ul" title="Маркированный список">• Список</button>
        <button type="button" data-format="ol" title="Нумерованный список">1. Список</button>
        <button type="button" data-format="link" title="Ссылка (Ctrl+K)">Ссылка</button>
        <button type="button" data-format="clear" title="Убрать оформление">Очистить</button>
      </div>
      <dialog class="builder-dialog" id="builderLinkDialog" aria-labelledby="builderLinkTitle">
        <form id="builderLinkForm" method="dialog">
          <h2 id="builderLinkTitle">Ссылка</h2>
          <p id="builderLinkText"></p>
          <div class="builder-link-kinds">
            <label><input type="radio" name="linkKind" value="page" checked> Страница этого сайта</label>
            <label><input type="radio" name="linkKind" value="url"> Другой сайт, почта или телефон</label>
          </div>
          <label data-link-kind="page">
            Страница
            <select id="builderLinkPage"></select>
          </label>
          <label data-link-kind="url" hidden>
            Адрес
            <input id="builderLinkUrl" type="text" placeholder="example.ru, info@example.ru или +7 900 000-00-00">
          </label>
          <label class="checkline">
            <input id="builderLinkNewTab" type="checkbox">
            Открывать в новой вкладке
          </label>
          <p class="builder-dialog-error" id="builderLinkError" hidden></p>
          <div class="builder-dialog-actions">
            <button type="button" id="builderLinkRemove" class="builder-danger" hidden>Убрать ссылку</button>
            <button type="button" id="builderLinkCancel" class="builder-secondary">Отмена</button>
            <button type="submit" id="builderLinkApply">Готово</button>
          </div>
        </form>
      </dialog>
    `
  );

  const bar = document.querySelector('#builderFormatBar');
  // mousedown would move focus away from the text and drop the selection.
  bar.addEventListener('mousedown', (event) => event.preventDefault());
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-format]');
    if (button) applyFormat(button.dataset.format);
  });
  document.addEventListener('selectionchange', updateFormatBar);
  window.addEventListener('scroll', updateFormatBar, true);
  window.addEventListener('resize', updateFormatBar);

  const dialog = document.querySelector('#builderLinkDialog');
  dialog.querySelectorAll('input[name="linkKind"]').forEach((radio) => {
    radio.addEventListener('change', () => setLinkDialogKind(radio.value));
  });
  dialog.querySelector('#builderLinkForm').addEventListener('submit', (event) => {
    event.preventDefault();
    applyLinkDialog();
  });
  dialog.querySelector('#builderLinkCancel').addEventListener('click', () => dialog.close());
  dialog.querySelector('#builderLinkRemove').addEventListener('click', removeLinkFromDialog);
  dialog.addEventListener('close', () => {
    if (savedLinkRange) restoreRange(savedLinkRange);
    savedLinkRange = null;
    editedLink = null;
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'KeyK' && currentRichRange()) {
      event.preventDefault();
      openLinkDialog();
    }
  });

  // Double-click on a picture replaces it with a file from the computer.
  document.addEventListener('dblclick', (event) => {
    const image = event.target.closest?.('img');
    if (!image || isEditorChromeNode(image)) return;
    if (image.closest('.builder-widget-item') || richEditableFromNode(image)) {
      event.preventDefault();
      event.stopPropagation();
      void replaceImageFromFile((url) => image.setAttribute('src', url));
    } else if (image.closest('.side-brand-logo')) {
      event.preventDefault();
      uploadLogo();
    }
  }, true);

  document.querySelector('#builderReplaceImage')?.addEventListener('click', replaceSelectedImage);
  document.querySelector('#builderImageAlt')?.addEventListener('input', (event) => {
    selectedImageElement()?.setAttribute('alt', event.target.value.trim());
  });
  document.querySelector('#builderSeoH1')?.addEventListener('input', updateSeoFromControls);
  document.querySelector('#builderSeoShowH1')?.addEventListener('change', updateSeoFromControls);
  document.querySelector('#builderSeoDescription')?.addEventListener('input', updateSeoPreview);
  document.querySelector('[data-builder-tab="seo"]')?.addEventListener('click', updateSeoPreview);
  document.querySelector('#builderUploadLogo')?.addEventListener('click', uploadLogo);
  document.querySelector('#builderRemoveLogo')?.addEventListener('click', () => setLogoUrl(''));
  updateLogoControls();
}

// Settings panel: tabs, only the settings of the selected element, collapsing.
const builderPanelCollapsedKey = 'cms-builder-panel-collapsed';
const builderTargetNames = {
  card: 'Карточка',
  section: 'Раздел',
  widget: 'Карточка с фото и кнопкой',
  image: 'Фото',
  accordion: 'Выпадающий список',
  headerNav: 'Верхнее меню',
  sideMenu: 'Боковое меню',
  footer: 'Подвал сайта',
  posts: 'Лента новостей',
  slider: 'Слайдер',
  rightPanel: 'Колонка справа'
};
let panelContextQueued = false;

function selectedTargetName() {
  const type = selectedDesignTarget?.type;
  if (type === 'block') return selectedBuilderBlock()?.type === 'container' ? 'Секция' : 'Текстовый блок';
  return builderTargetNames[type] || '';
}

function showBuilderTab(name) {
  document.querySelectorAll('[data-builder-tab]').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.builderTab === name));
  });
  document.querySelectorAll('[data-builder-tab-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.builderTabPanel !== name;
  });
}

// The sync* functions decide which forms apply to the selection (by toggling
// their hidden flags); this then shows only the sections that have something.
function updatePanelContext() {
  const panel = document.querySelector('#builderPanel');
  if (!panel) return;
  const type = selectedDesignTarget?.type;
  const isShown = (selector) => {
    const element = panel.querySelector(selector);
    return Boolean(element && !element.hidden);
  };
  const visible = {
    design: !['slider', 'posts'].includes(type) && ['#builderObjectForm', '#builderSideMenuActions', '#builderFooterActions'].some(isShown),
    link: panel.querySelector('#builderAttachPage')?.disabled === false,
    posts: isShown('#builderPostsForm'),
    // The last selected section is remembered; show it only while it (or
    // something inside it) is the current selection.
    layout: isShown('#builderLayoutForm') && ['block', 'rightPanel', 'card', 'section', 'widget', 'image', 'accordion'].includes(type),
    slider: type === 'slider'
  };
  panel.querySelectorAll('[data-builder-context]').forEach((section) => {
    section.hidden = !visible[section.dataset.builderContext];
  });

  // With a card (or photo, section...) selected, its parent section offers only
  // the "add next to it" buttons, not its whole layout form.
  const layoutSection = panel.querySelector('[data-builder-context="layout"]');
  const isInlineItem = ['card', 'section', 'widget', 'image', 'accordion'].includes(type);
  layoutSection.classList.toggle('is-compact', isInlineItem);
  layoutSection.querySelector('h2').textContent = isInlineItem ? 'Добавить в эту секцию' : 'Секция';
  panel.querySelector('#builderElementEmpty').hidden = Object.values(visible).some(Boolean);

  panel.querySelector('#builderReplaceImage').hidden = !['image', 'widget'].includes(type);
  const altField = panel.querySelector('#builderImageAltField');
  const selectedImage = selectedImageElement();
  altField.hidden = !selectedImage;
  if (selectedImage && document.activeElement !== altField.querySelector('input')) {
    altField.querySelector('input').value = selectedImage.getAttribute('alt') || '';
  }
  panel.querySelector('#builderSharedLayoutNote').hidden = currentPageId === 'home' || !['headerNav', 'sideMenu', 'footer'].includes(type);

  const name = selectedTargetName();
  panel.querySelector('#builderPanelTitle').textContent = name ? `Настройки: ${name}` : 'Настройки';

  // Flex-only and grid-only options are noise for other layouts.
  const display = panel.querySelector('[data-style-field="display"]')?.value || 'block';
  panel.querySelectorAll('[data-layout-when]').forEach((label) => {
    label.hidden = !label.dataset.layoutWhen.split(' ').includes(display);
  });
}

function schedulePanelContext() {
  if (panelContextQueued) return;
  panelContextQueued = true;
  queueMicrotask(() => {
    panelContextQueued = false;
    updatePanelContext();
  });
}

function setBuilderPanelCollapsed(collapsed) {
  const panel = document.querySelector('#builderPanel');
  const button = document.querySelector('#builderPanelCollapse');
  if (!panel || !button) return;
  panel.classList.toggle('is-collapsed', collapsed);
  button.textContent = collapsed ? '+' : '—';
  button.title = collapsed ? 'Развернуть панель' : 'Свернуть панель';
  button.setAttribute('aria-expanded', String(!collapsed));
  try {
    localStorage.setItem(builderPanelCollapsedKey, collapsed ? '1' : '0');
  } catch {
    // Private mode: the panel just will not remember its state.
  }
}

function setupBuilderPanelUi() {
  document.querySelectorAll('[data-builder-tab]').forEach((tab) => {
    tab.addEventListener('click', () => showBuilderTab(tab.dataset.builderTab));
  });

  let collapsed = false;
  try {
    collapsed = localStorage.getItem(builderPanelCollapsedKey) === '1';
  } catch {}
  setBuilderPanelCollapsed(collapsed);
  document.querySelector('#builderPanelCollapse')?.addEventListener('click', () => {
    setBuilderPanelCollapsed(!document.querySelector('#builderPanel').classList.contains('is-collapsed'));
  });

  document.querySelector('[data-style-field="display"]')?.addEventListener('change', updatePanelContext);

  // The slider had settings but no way to select it.
  slider.root?.addEventListener('click', (event) => {
    if (event.target.closest('.slider-controls, .slider-dots')) return;
    selectDesignTarget({ type: 'slider' });
  });

  updatePanelContext();
}

// Editor safety net: unsaved-changes tracking, undo/redo and clean paste.
// Every change is recorded as a snapshot of the whole page (collectPageFromDom),
// so text edits, added/removed blocks, styles and drag-and-drop are all covered
// without hooking into each editing function separately.
const editorHistory = {
  entries: [],
  index: -1,
  savedSnapshot: '',
  timer: null,
  observer: null,
  noticeTimer: null,
  maxEntries: 100
};

function currentEditorSnapshot() {
  // updatedAt changes on every save and is not something the user edited.
  const { updatedAt, ...page } = collectPageFromDom();
  return JSON.stringify(page);
}

function hasUnsavedChanges() {
  return editorHistory.entries[editorHistory.index] !== editorHistory.savedSnapshot;
}

function updateEditorHistoryControls() {
  const dirty = hasUnsavedChanges();
  const state = document.querySelector('#builderSaveState');
  if (state) {
    state.textContent = dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
    state.classList.toggle('is-dirty', dirty);
  }
  document.querySelector('#builderSave')?.classList.toggle('is-dirty', dirty);
  const undo = document.querySelector('#builderUndo');
  const redo = document.querySelector('#builderRedo');
  if (undo) undo.disabled = editorHistory.index <= 0;
  if (redo) redo.disabled = editorHistory.index >= editorHistory.entries.length - 1;
}

function captureEditorState() {
  clearTimeout(editorHistory.timer);
  editorHistory.timer = null;
  const snapshot = currentEditorSnapshot();
  if (snapshot !== editorHistory.entries[editorHistory.index]) {
    editorHistory.entries = editorHistory.entries.slice(0, editorHistory.index + 1);
    editorHistory.entries.push(snapshot);
    if (editorHistory.entries.length > editorHistory.maxEntries) editorHistory.entries.shift();
    editorHistory.index = editorHistory.entries.length - 1;
  }
  updateEditorHistoryControls();
}

function scheduleEditorCapture() {
  clearTimeout(editorHistory.timer);
  editorHistory.timer = setTimeout(captureEditorState, 400);
}

function markEditorSaved() {
  clearTimeout(editorHistory.timer);
  editorHistory.timer = null;
  const snapshot = currentEditorSnapshot();
  // The server may normalize the page; keep that as the current step, not a new one.
  editorHistory.entries[editorHistory.index] = snapshot;
  editorHistory.savedSnapshot = snapshot;
  updateEditorHistoryControls();
}

async function restoreEditorSnapshot(snapshot) {
  const previousPosts = JSON.stringify(pageBlock('posts') || null);
  pageState = { ...pageState, ...JSON.parse(snapshot) };
  selectedBuilderBlockId = null;
  selectedDesignTarget = null;
  selectedSideMenuIndex = null;
  selectedHeaderNavIndex = null;
  selectedFooterIndex = null;

  applyPageContent();
  renderCustomBlocks();
  if (JSON.stringify(pageBlock('posts') || null) !== previousPosts && !postSlug) await loadPosts();
  setupBlockDrag();
  setupBlockSelection();
  syncLayoutControls();
  syncObjectControls();
  syncPostsControls();
  syncSliderControls();
  syncSeoControls();
  syncPageControls();

  // Re-rendering is not an edit: drop the mutations it caused.
  editorHistory.observer?.takeRecords();
  clearTimeout(editorHistory.timer);
  editorHistory.timer = null;

  // Rendering may normalize markup slightly; keep the history step in sync with
  // what is on screen so the next keystroke does not wipe the redo history.
  const rendered = currentEditorSnapshot();
  if (rendered !== snapshot) {
    if (editorHistory.savedSnapshot === snapshot) editorHistory.savedSnapshot = rendered;
    editorHistory.entries[editorHistory.index] = rendered;
  }
}

async function undoEditorChange() {
  captureEditorState();
  if (editorHistory.index <= 0) return;
  editorHistory.index -= 1;
  await restoreEditorSnapshot(editorHistory.entries[editorHistory.index]);
  updateEditorHistoryControls();
  setBuilderStatus('Отменено');
}

async function redoEditorChange() {
  captureEditorState();
  if (editorHistory.index >= editorHistory.entries.length - 1) return;
  editorHistory.index += 1;
  await restoreEditorSnapshot(editorHistory.entries[editorHistory.index]);
  updateEditorHistoryControls();
  setBuilderStatus('Возвращено');
}

// Shown after a deletion instead of a confirm dialog: one click brings it back.
function showUndoNotice(text) {
  const status = document.querySelector('#builderStatus');
  if (!status) return;
  status.innerHTML = `${escapeHtml(text)} <button type="button" class="builder-undo-notice">Отменить</button>`;
  status.querySelector('button').addEventListener('click', undoEditorChange);
  clearTimeout(editorHistory.noticeTimer);
  editorHistory.noticeTimer = setTimeout(() => {
    if (status.querySelector('.builder-undo-notice')) status.textContent = '';
  }, 8000);
}

function recordDeletion(text = 'Удалено') {
  captureEditorState();
  showUndoNotice(text);
}

function isEditorChromeNode(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return Boolean(element?.closest('.builder-bar, .builder-panel, .builder-format-bar, .builder-dialog, .chat-widget'));
}

// Rich text areas take formatted paste; titles, menu items and card labels take plain text.
const richPasteSelector = '.custom-block-content, .right-panel-content';

async function setupEditorSafetyNet() {
  const { cleanPastedHtml, plainTextToHtml } = await import('./paste-cleaner.js');

  editorHistory.entries = [currentEditorSnapshot()];
  editorHistory.index = 0;
  editorHistory.savedSnapshot = editorHistory.entries[0];

  editorHistory.observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => !isEditorChromeNode(mutation.target))) scheduleEditorCapture();
  });
  editorHistory.observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style', 'src', 'href', 'data-page-link', 'data-link-url']
  });
  // Panel controls change pageState as well as the page, so listen to them too.
  document.addEventListener('input', scheduleEditorCapture);
  document.addEventListener('change', scheduleEditorCapture);

  document.addEventListener(
    'keydown',
    (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      // event.code works the same with Russian and English keyboard layouts.
      if (event.code === 'KeyS') {
        event.preventDefault();
        saveEditor();
        return;
      }
      // Panel fields (SEO, colors...) keep the browser's own undo.
      if (event.target.closest?.('.builder-panel input, .builder-panel textarea, .builder-panel select, .builder-dialog')) return;
      if (event.code === 'KeyZ' && !event.shiftKey) {
        event.preventDefault();
        undoEditorChange();
      } else if ((event.code === 'KeyZ' && event.shiftKey) || event.code === 'KeyY') {
        event.preventDefault();
        redoEditorChange();
      }
    },
    true
  );

  document.addEventListener('paste', (event) => {
    const editable = event.target.closest?.('[contenteditable="true"]');
    if (!editable || isEditorChromeNode(editable)) return;
    const html = event.clipboardData?.getData('text/html') || '';
    const text = event.clipboardData?.getData('text/plain') || '';
    // A copied image file has neither: let the browser handle it as before.
    if (!html && !text) return;

    event.preventDefault();
    if (editable.closest(richPasteSelector)) {
      const clean = html ? cleanPastedHtml(html) : plainTextToHtml(text);
      document.execCommand('insertHTML', false, clean);
    } else {
      document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (editorHistory.timer) captureEditorState();
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  document.querySelector('#builderUndo').addEventListener('click', undoEditorChange);
  document.querySelector('#builderRedo').addEventListener('click', redoEditorChange);
  updateEditorHistoryControls();
}

function setupEditor() {
  document.body.classList.add('builder-mode');
  document.querySelector('.site-hero').classList.add('builder-block');
  slider.root.classList.add('builder-block');
  root.classList.add('builder-block');

  document.body.insertAdjacentHTML(
    'afterbegin',
    `
      <div class="builder-bar">
        <strong>Редактор сайта</strong>
        <button id="builderSave" type="button" title="Сохранить (Ctrl+S)">Сохранить</button>
        <button id="builderUndo" type="button" title="Отменить (Ctrl+Z)" aria-label="Отменить" disabled>↶</button>
        <button id="builderRedo" type="button" title="Вернуть (Ctrl+Shift+Z)" aria-label="Вернуть" disabled>↷</button>
        <span id="builderSaveState" class="builder-save-state" aria-live="polite"></span>
        <span id="builderStatus"></span>
        <button id="builderAddText" type="button" title="Добавить блок текста в конец страницы">+ Текст</button>
        <button id="builderAddDiv" type="button" title="Добавить секцию для карточек, разделов и фото">+ Секция</button>
        <button id="builderAddImage" type="button" title="Добавить фото в выбранный блок">+ Фото</button>
        <button id="builderAddRightPanel" type="button" title="Добавить колонку справа от слайдера">+ Колонка</button>
        <button id="builderAddSections" type="button" style="display: none;">+ Разделы</button>
        <button id="builderDuplicateItem" type="button" title="Сделать копию выбранного элемента" disabled>Дублировать</button>
        <button id="builderDeleteBlock" type="button" title="Удалить выбранный элемент" disabled>Удалить</button>
        <button id="builderLink" type="button" title="Выделите слово в тексте и нажмите, чтобы сделать его ссылкой">Ссылка</button>
        <a href="/" title="Выйти из редактора и открыть сайт">Выйти</a>
        <a href="/admin" title="Новости, галерея, интеграции, база знаний">Админка</a>
      </div>
      <aside class="builder-panel" id="builderPanel">
        <div class="builder-panel-head" id="builderPanelHandle" title="Перетащите, чтобы передвинуть панель">
          <strong id="builderPanelTitle">Настройки</strong>
          <div class="builder-panel-head-actions">
            <button id="builderPanelReset" type="button" title="Вернуть панель к правому краю">⇥</button>
            <button id="builderPanelCollapse" type="button" title="Свернуть панель" aria-expanded="true">—</button>
          </div>
        </div>
        <div class="builder-tabs" role="tablist">
          <button type="button" role="tab" data-builder-tab="element" aria-selected="true">Элемент</button>
          <button type="button" role="tab" data-builder-tab="page" aria-selected="false">Страница</button>
          <button type="button" role="tab" data-builder-tab="seo" aria-selected="false">SEO</button>
        </div>

        <div class="builder-tab-panel" data-builder-tab-panel="element">
          <p id="builderElementEmpty" class="builder-empty">Кликните по любому элементу на странице: меню, карточке, тексту, слайдеру или ленте новостей — здесь появятся его настройки.</p>

          <section class="builder-panel-section" data-builder-context="design">
            <h2>Оформление</h2>
            <p id="builderObjectHint"></p>
            <p id="builderSharedLayoutNote" class="builder-note" hidden>Меню, логотип и подвал общие для всех страниц и берутся с главной. Чтобы изменения сохранились, правьте их <a href="/edit">на главной странице</a>.</p>
            <button id="builderReplaceImage" type="button" hidden>Заменить фото с компьютера</button>
            <label id="builderImageAltField" hidden>
              Описание картинки (для поиска и незрячих)
              <input id="builderImageAlt" type="text" maxlength="200" placeholder="Например: Здание колледжа">
            </label>
            <div id="builderObjectForm" class="builder-object-form" hidden>
              <label>
                Цвет фона
                <input data-object-style-field="backgroundColor" type="color">
              </label>
              <label>
                Цвет текста
                <input data-object-style-field="textColor" type="color">
              </label>
              <label>
                Размер текста
                <input data-object-style-field="fontSize" type="number" min="10" max="72" step="1">
              </label>
              <label>
                Шрифт
                <select data-object-style-field="fontFamily">
                  <option value="system-ui">Системный</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="&quot;Times New Roman&quot;, serif">Times New Roman</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                </select>
              </label>
              <label>
                Жирность
                <select data-object-style-field="fontWeight">
                  <option value="300">Тонкий</option>
                  <option value="400">Обычный</option>
                  <option value="500">Средний</option>
                  <option value="600">Полужирный</option>
                  <option value="700">Жирный</option>
                  <option value="800">Очень жирный</option>
                  <option value="900">Максимальный</option>
                </select>
              </label>
              <label>
                Внутренний отступ
                <input data-object-style-field="padding" type="number" min="0" max="120" step="1">
              </label>
              <label>
                Скругление углов
                <input data-object-style-field="borderRadius" type="number" min="0" max="96" step="1">
              </label>
              <label>
                Макс. ширина
                <input data-object-style-field="maxWidth" type="number" min="180" max="2400" step="10">
              </label>
              <label>
                Высота (0 — авто)
                <input data-object-style-field="height" type="number" min="0" max="2000" step="10">
              </label>
            </div>
            <div id="builderWidgetForm" class="builder-object-form builder-subform" hidden>
              <label>
                Скругление фото
                <input data-widget-style-field="imgRadius" type="number" min="0" max="200" step="1">
              </label>
              <label>
                Текст кнопки
                <input data-widget-style-field="btnText" type="text">
              </label>
              <label>
                Ссылка кнопки
                <input data-widget-style-field="btnLink" type="text">
              </label>
              <label>
                Положение кнопки
                <select data-widget-style-field="btnAlign">
                  <option value="start">Слева</option>
                  <option value="center">По центру</option>
                  <option value="end">Справа</option>
                </select>
              </label>
              <label>
                Размер кнопки
                <input data-widget-style-field="btnSize" type="number" min="10" max="40" step="1">
              </label>
              <label>
                Цвет кнопки
                <input data-widget-style-field="btnBg" type="color">
              </label>
              <label>
                Цвет текста кнопки
                <input data-widget-style-field="btnColor" type="color">
              </label>
            </div>
            <div id="builderSideMenuActions" class="builder-side-menu-actions" hidden>
              <label>
                Название организации
                <input id="builderSideTitle" type="text" placeholder="Название организации">
              </label>
              <div class="builder-logo-field">
                <span class="builder-field-title">Логотип</span>
                <div class="builder-logo-row">
                  <div class="builder-logo-preview" id="builderLogoPreview"></div>
                  <div class="builder-logo-buttons">
                    <button id="builderUploadLogo" type="button">Загрузить с компьютера</button>
                    <button id="builderRemoveLogo" type="button" class="builder-secondary" hidden>Убрать</button>
                  </div>
                </div>
                <details>
                  <summary>или вставить ссылку на картинку</summary>
                  <input id="builderSideLogoUrl" type="url" placeholder="https://...">
                </details>
              </div>
              <p id="builderSideMenuHint">Кликните по пункту меню слева.</p>
              <button id="builderAddSideItem" type="button">+ Пункт меню</button>
              <button id="builderDeleteSideItem" type="button" disabled>Удалить пункт</button>
            </div>
            <div id="builderAccordionForm" class="builder-accordion-form" hidden>
              <p>Выбранный пункт подсвечен — в него добавляются текст и блоки.</p>
              <button id="builderAddAccordionSection" type="button">+ Пункт списка</button>
              <button id="builderAddAccordionText" type="button">+ Текст в пункт</button>
              <button id="builderDeleteAccordionSection" type="button">Удалить пункт</button>
            </div>
            <div id="builderFooterActions" class="builder-footer-actions" hidden>
              <p id="builderFooterHint">Кликните по ссылке в подвале.</p>
              <button id="builderAddFooterItem" type="button">+ Ссылка в подвале</button>
              <button id="builderDeleteFooterItem" type="button" disabled>Удалить ссылку</button>
              <label class="checkline">
                <input id="builderCookieNoticeEnabled" type="checkbox">
                Показывать уведомление о cookie
              </label>
              <p>Текст уведомления и кнопки меняйте прямо в плашке внизу экрана.</p>
            </div>
          </section>

          <section class="builder-panel-section" data-builder-context="link">
            <h2>Ссылка</h2>
            <label>
              При клике открывать страницу
              <select id="builderPageTarget"></select>
            </label>
            <button id="builderAttachPage" type="button" disabled>Сделать ссылкой на эту страницу</button>
            <p id="builderPageHint"></p>
          </section>

          <section class="builder-panel-section" data-builder-context="posts">
            <h2>Лента новостей</h2>
            <p id="builderPostsHint" hidden></p>
            <div id="builderPostsForm" class="builder-posts-form" hidden>
              <label>
                Заголовок ленты
                <input data-posts-field="titleHtml" type="text">
              </label>
              <label>
                Сколько новостей показывать (0 — все)
                <input data-posts-field="limit" type="number" min="0" max="100" step="1">
              </label>
              <label>
                Ширина ленты
                <input data-posts-field="maxWidth" type="number" min="320" max="2400" step="10">
              </label>
              <label>
                Положение
                <select data-posts-field="align">
                  <option value="left">Слева</option>
                  <option value="center">По центру</option>
                  <option value="right">Справа</option>
                </select>
              </label>
              <label>
                Ширина карточки
                <input data-posts-field="cardMinWidth" type="number" min="180" max="900" step="10">
              </label>
              <label>
                Высота карточки (0 — авто)
                <input data-posts-field="cardHeight" type="number" min="0" max="1400" step="10">
              </label>
              <label>
                Высота фото (0 — авто)
                <input data-posts-field="coverHeight" type="number" min="0" max="800" step="10">
              </label>
              <label>
                Страница со всеми новостями
                <select data-posts-field="allPageId"></select>
              </label>
              <label>
                Текст ссылки «Все новости»
                <input data-posts-field="allLinkText" type="text">
              </label>
              <label class="checkline">
                <input data-posts-field="showAllLink" type="checkbox">
                Показывать ссылку «Все новости»
              </label>
            </div>
          </section>

          <section class="builder-panel-section" data-builder-context="layout">
            <h2>Секция</h2>
            <p id="builderBlockHint" hidden></p>
            <div id="builderCardActions" class="builder-card-actions" hidden>
              <button id="builderAddCard" type="button">+ Карточка</button>
              <button id="builderAddSection" type="button">+ Раздел</button>
              <button id="builderAddImageInside" type="button">+ Фото</button>
              <button id="builderAddWidget" type="button">+ Карточка с фото и кнопкой</button>
              <button id="builderAddAccordion" type="button">+ Выпадающий список</button>
            </div>
            <div id="builderLayoutForm" class="builder-layout-form" hidden>
              <label>
                Как расположить содержимое
                <select data-style-field="display">
                  <option value="block">Друг под другом</option>
                  <option value="flex">В ряд</option>
                  <option value="grid">Сеткой</option>
                </select>
              </label>
              <label data-layout-when="flex">
                Направление ряда
                <select data-style-field="flexDirection">
                  <option value="row">Слева направо</option>
                  <option value="row-reverse">Справа налево</option>
                  <option value="column">Сверху вниз</option>
                  <option value="column-reverse">Снизу вверх</option>
                </select>
              </label>
              <label data-layout-when="flex">
                Если не помещается
                <select data-style-field="flexWrap">
                  <option value="nowrap">Не переносить</option>
                  <option value="wrap">Переносить на новую строку</option>
                </select>
              </label>
              <label data-layout-when="grid">
                Колонок в сетке (0 — авто)
                <input data-style-field="gridColumns" type="number" min="0" max="12" step="1">
              </label>
              <label data-layout-when="flex grid">
                Выравнивание по горизонтали
                <select data-style-field="justifyContent">
                  <option value="flex-start">К началу</option>
                  <option value="center">По центру</option>
                  <option value="flex-end">К концу</option>
                  <option value="space-between">Равномерно, края прижаты</option>
                  <option value="space-around">Равномерно с отступами</option>
                </select>
              </label>
              <label data-layout-when="flex grid">
                Выравнивание по вертикали
                <select data-style-field="alignItems">
                  <option value="stretch">Растянуть по высоте</option>
                  <option value="flex-start">Сверху</option>
                  <option value="center">По центру</option>
                  <option value="flex-end">Снизу</option>
                </select>
              </label>
              <label>
                Положение секции
                <select data-style-field="position">
                  <option value="left">Слева</option>
                  <option value="center">По центру</option>
                  <option value="right">Справа</option>
                </select>
              </label>
              <label data-layout-when="flex grid">
                Промежуток между элементами
                <input data-style-field="gap" type="number" min="0" max="96" step="1">
              </label>
              <label>
                Внутренний отступ
                <input data-style-field="padding" type="number" min="0" max="120" step="1">
              </label>
              <label>
                Макс. ширина
                <input data-style-field="maxWidth" type="number" min="320" max="1600" step="10">
              </label>
              <label>
                Высота (0 — авто)
                <input data-style-field="height" type="number" min="0" max="2000" step="10">
              </label>
              <label>
                Скругление углов
                <input data-style-field="borderRadius" type="number" min="0" max="48" step="1">
              </label>
              <label>
                Цвет фона
                <input data-style-field="backgroundColor" type="color">
              </label>
              <label>
                Цвет текста
                <input data-style-field="textColor" type="color">
              </label>
              <label>
                Размер текста
                <input data-style-field="fontSize" type="number" min="10" max="72" step="1">
              </label>
              <label>
                Шрифт
                <select data-style-field="fontFamily">
                  <option value="system-ui">Системный</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="&quot;Times New Roman&quot;, serif">Times New Roman</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                </select>
              </label>
              <label>
                Жирность
                <select data-style-field="fontWeight">
                  <option value="300">Тонкий</option>
                  <option value="400">Обычный</option>
                  <option value="500">Средний</option>
                  <option value="600">Полужирный</option>
                  <option value="700">Жирный</option>
                  <option value="800">Очень жирный</option>
                  <option value="900">Максимальный</option>
                </select>
              </label>
            </div>
          </section>

          <section class="builder-panel-section" data-builder-context="slider">
            <h2>Слайдер</h2>
            <p>Размер и положение слайдера на странице.</p>
            <div id="builderSliderForm" class="builder-slider-form">
              <label>
                Макс. ширина
                <input data-slider-style-field="maxWidth" type="number" min="360" max="2400" step="10">
              </label>
              <label>
                Положение
                <select data-slider-style-field="align">
                  <option value="left">Слева</option>
                  <option value="center">По центру</option>
                  <option value="right">Справа</option>
                </select>
              </label>
              <label>
                Скругление углов
                <input data-slider-style-field="borderRadius" type="number" min="0" max="96" step="1">
              </label>
              <label>
                Высота (0 — авто)
                <input data-slider-style-field="height" type="number" min="0" max="2000" step="10">
              </label>
            </div>
          </section>
        </div>

        <div class="builder-tab-panel" data-builder-tab-panel="page" hidden>
          <section class="builder-panel-section">
            <h2>Эта страница</h2>
            <p id="builderCurrentPage">${escapeHtml(pageState?.title || currentPageId)}</p>
          </section>
          <section class="builder-panel-section">
            <h2>Новая страница</h2>
            <label>
              Название
              <input id="builderNewPageTitle" type="text" placeholder="Например: О колледже">
            </label>
            <button id="builderCreatePage" type="button">+ Создать страницу</button>
          </section>
          <section class="builder-panel-section">
            <h2>Все страницы</h2>
            <label>
              Страница
              <select id="builderPagesList"></select>
            </label>
            <div class="builder-button-row">
              <button id="builderOpenPage" type="button">Открыть для редактирования</button>
              <button id="builderDeletePage" type="button" class="builder-danger">Удалить</button>
            </div>
          </section>
        </div>

        <div class="builder-tab-panel" data-builder-tab-panel="seo" hidden>
          <section class="builder-panel-section builder-seo-form">
            <p>Как страница выглядит в Яндексе, Google и при отправке ссылки в мессенджеры.</p>
            <label>
              Заголовок в поиске
              <input id="builderSeoTitle" type="text" maxlength="180" placeholder="По умолчанию — название страницы">
            </label>
            <label>
              Описание в поиске
              <textarea id="builderSeoDescription" rows="4" maxlength="500" placeholder="1–2 предложения о том, что есть на странице"></textarea>
            </label>
            <p id="builderSeoPreview" class="builder-seo-preview"></p>
            <label>
              Главный заголовок страницы (H1)
              <input id="builderSeoH1" type="text" maxlength="180">
            </label>
            <label class="checkline">
              <input id="builderSeoShowH1" type="checkbox">
              Показывать этот заголовок на странице
            </label>
            <label>
              Картинка для соцсетей (ссылка)
              <input id="builderSeoImage" type="url" maxlength="2000" placeholder="https://...">
            </label>
            <label class="checkline">
              <input id="builderSeoNoIndex" type="checkbox">
              Скрыть страницу из поиска
            </label>
            <p>Адрес страницы: <a id="builderSeoPublicUrl" href="/" target="_blank" rel="noopener"></a></p>
          </section>
        </div>
      </aside>
    `
  );

  document.querySelector('#builderSave').addEventListener('click', saveEditor);
  document.querySelector('#builderAddText').addEventListener('click', addTextBlock);
  document.querySelector('#builderAddDiv').addEventListener('click', addDivBlock);
  document.querySelector('#builderAddImage').addEventListener('click', addImageToSelectedBlock);
  document.querySelector('#builderAddRightPanel').addEventListener('click', addRightPanel);
  document.querySelector('#builderAddSections').addEventListener('click', addSectionRowBlock);
  document.querySelector('#builderDuplicateItem').addEventListener('click', duplicateSelectedItem);
  document.querySelector('#builderDeleteBlock').addEventListener('click', deleteSelectedBlock);
  document.querySelector('#builderCreatePage').addEventListener('click', createPageFromEditor);
  document.querySelector('#builderAttachPage').addEventListener('click', attachPageToSelected);
  document.querySelector('#builderOpenPage').addEventListener('click', openSelectedPage);
  document.querySelector('#builderDeletePage').addEventListener('click', deleteSelectedPage);
  document.querySelector('#builderPageTarget').addEventListener('change', syncPageControls);
  document.querySelector('#builderSeoTitle').addEventListener('input', updateSeoFromControls);
  document.querySelector('#builderSeoDescription').addEventListener('input', updateSeoFromControls);
  document.querySelector('#builderSeoImage').addEventListener('input', updateSeoFromControls);
  document.querySelector('#builderSeoNoIndex').addEventListener('change', updateSeoFromControls);
  document.querySelector('#builderSideTitle').addEventListener('input', updateSideMenuBrandFromControls);
  document.querySelector('#builderSideLogoUrl').addEventListener('change', updateSideMenuBrandFromControls);
  document.querySelector('#builderAddSideItem').addEventListener('click', addSideMenuItem);
  document.querySelector('#builderDeleteSideItem').addEventListener('click', deleteSelectedSideMenuItem);
  document.querySelector('#builderAddFooterItem').addEventListener('click', addFooterItem);
  document.querySelector('#builderDeleteFooterItem').addEventListener('click', deleteSelectedFooterItem);
  document.querySelector('#builderCookieNoticeEnabled').addEventListener('change', (event) => {
    const footer = pageBlock('footer');
    if (!footer) return;
    footer.fields = { ...(footer.fields || {}), cookieNoticeEnabled: event.target.checked };
    renderCookieNotice();
  });
  document.querySelector('#builderAddCard').addEventListener('click', addCardToSelectedDiv);
  document.querySelector('#builderAddSection').addEventListener('click', addSectionToSelectedDiv);
  document.querySelector('#builderAddImageInside').addEventListener('click', addImageToSelectedBlock);
  document.querySelector('#builderAddWidget').addEventListener('click', addWidgetToSelectedDiv);
  document.querySelector('#builderAddAccordion').addEventListener('click', addAccordionToSelectedDiv);
  document.querySelector('#builderAddAccordionSection').addEventListener('click', addAccordionSection);
  document.querySelector('#builderAddAccordionText').addEventListener('click', addTextToAccordionSection);
  document.querySelector('#builderDeleteAccordionSection').addEventListener('click', deleteAccordionSection);
  document.querySelector('#builderLink').addEventListener('click', addLinkToSelection);
  setupBlockDrag();
  setupBlockSelection();
  setupDesignSelection();
  setupLayoutControls();
  setupObjectControls();
  setupPostsControls();
  setupSliderControls();
  setupFloatingBuilderPanel();
  setupBuilderPanelUi();
  setupRichTextTools();
  syncLayoutControls();
  syncObjectControls();
  syncPostsControls();
  syncSliderControls();
  syncPageControls();
  syncSeoControls();
}

const postSlug = new URLSearchParams(window.location.search).get('post');
await loadPage();
if (postSlug) {
  root.classList.remove('post-grid');
  removeGalleryBlock();
  await loadPost(postSlug);
} else {
  await loadPosts();
  await loadGallery();
}

await loadSlider();
if (isEditMode) {
  await loadPagesIndex();
  setupEditor();
  await setupEditorSafetyNet();
}

slider.prev.addEventListener('click', () => moveSlider(-1));
slider.next.addEventListener('click', () => moveSlider(1));
slider.dots.addEventListener('click', (event) => {
  const slide = event.target.dataset.slide;
  if (slide) renderSlider(Number(slide));
});

slider.root.addEventListener('mouseenter', () => {
  if (slider.settings.pauseOnHover) slider.paused = true;
});

slider.root.addEventListener('mouseleave', () => {
  if (slider.settings.pauseOnHover) slider.paused = false;
});

const chat = {
  root: document.querySelector('#siteChat'),
  toggle: document.querySelector('#chatToggle'),
  close: document.querySelector('#chatClose'),
  panel: document.querySelector('#chatPanel'),
  messages: document.querySelector('#chatMessages'),
  form: document.querySelector('#chatForm'),
  input: document.querySelector('#chatInput'),
  status: document.querySelector('#chatStatus')
};

const visitorIdKey = 'cms-engine-visitor-id';
const visitorId =
  localStorage.getItem(visitorIdKey) ||
  `visitor-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
localStorage.setItem(visitorIdKey, visitorId);

function setChatOpen(isOpen) {
  chat.root.classList.toggle('open', isOpen);
  chat.toggle.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) chat.input.focus();
}

function addChatMessage(role, text) {
  const message = document.createElement('div');
  message.className = `chat-message ${role}`;
  message.textContent = text;
  chat.messages.append(message);
  chat.messages.scrollTop = chat.messages.scrollHeight;
}

async function askSiteAssistant(message) {
  const response = await fetch('/api/ai/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, message })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Не удалось получить ответ');
  return payload.answer || 'Пока нет ответа.';
}

chat.toggle.addEventListener('click', () => setChatOpen(!chat.root.classList.contains('open')));
chat.close.addEventListener('click', () => setChatOpen(false));

chat.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = chat.input.value.trim();
  if (!message) return;

  addChatMessage('user', message);
  chat.input.value = '';
  chat.input.disabled = true;
  chat.form.querySelector('button').disabled = true;
  chat.status.textContent = 'typing';

  try {
    const answer = await askSiteAssistant(message);
    addChatMessage('assistant', answer);
    chat.status.textContent = 'online';
  } catch (error) {
    addChatMessage('assistant', error.message);
    chat.status.textContent = 'error';
  } finally {
    chat.input.disabled = false;
    chat.form.querySelector('button').disabled = false;
    chat.input.focus();
  }
});

addChatMessage('assistant', 'Здравствуйте. Я помогу с вопросами по сайту.');

const mobileNavToggle = document.getElementById('mobileNavToggle');
if (mobileNavToggle && siteSideMenu) {
  function setMobileMenuOpen(open) {
    siteSideMenu.classList.toggle('open', open);
    document.body.classList.toggle('mobile-menu-open', open);
    mobileNavToggle.setAttribute('aria-expanded', String(open));
  }

  mobileNavToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setMobileMenuOpen(!siteSideMenu.classList.contains('open'));
  });

  document.addEventListener('click', (event) => {
    if (siteSideMenu.classList.contains('open') && !siteSideMenu.contains(event.target) && event.target !== mobileNavToggle) {
      setMobileMenuOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMobileMenuOpen(false);
  });

  siteSideMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMobileMenuOpen(false));
  });
}
