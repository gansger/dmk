import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pageDescription, renderContentHtml } from '../src/services/seo.js';
import { startServer } from './helpers/server.js';

describe('renderContentHtml', () => {
  test('removes anything executable', () => {
    const html = renderContentHtml('<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><iframe src="https://x"></iframe>');
    assert.doesNotMatch(html, /script|onclick|javascript:|iframe/i);
    assert.match(html, /<p>Hi<\/p>/);
    assert.match(html, /<a>bad<\/a>/);
  });

  test('turns a card linked to a page into a real link with its title as text', () => {
    const html = renderContentHtml('<article class="card" data-page-link="sestrinskoe-delo" data-link-url="/sestrinskoe-delo"><h3>Сестринское дело</h3></article>');
    assert.match(html, /<article class="card"><a href="\/sestrinskoe-delo" class="linked-block-wrap"><h3>Сестринское дело<\/h3><\/a><\/article>/);
    assert.doesNotMatch(html, /data-page-link|data-link-url/);
  });

  test('does not nest links inside a card that already has one', () => {
    const html = renderContentHtml('<article data-link-url="/a"><h3>Карточка</h3><a href="/b">Кнопка</a></article>');
    assert.equal((html.match(/<a /g) || []).length, 2);
    assert.match(html, /<a href="\/a" class="linked-block-link">Карточка Кнопка<\/a>/);
  });

  test('cleans legacy ?page= links, demotes h1 and fills missing alt', () => {
    const html = renderContentHtml('<h1>Заголовок</h1><a href="?page=director-address">Читать</a><figure><figcaption>Здание</figcaption><img src="/a.jpg"></figure><img src="/b.jpg" alt="">', { pageTitle: 'Колледж' });
    assert.match(html, /<h2>Заголовок<\/h2>/);
    assert.match(html, /href="\/director-address"/);
    assert.match(html, /<img src="\/a.jpg" alt="Здание">/);
    assert.match(html, /<img src="\/b.jpg" alt="Колледж">/);
  });
});

describe('pageDescription', () => {
  const page = (blocks, extra = {}) => ({ id: 'about', title: 'О колледже', blocks, ...extra });

  test('prefers the first real paragraph and skips editor placeholders', () => {
    const description = pageDescription(page([
      { type: 'text', fields: { html: '<h2>Новый блок</h2><p>Напишите текст, выделите фразу и добавьте ссылку.</p>' } },
      { type: 'text', fields: { html: '<h2>Кратко</h2><p>Колледж готовит медицинских сестёр, фельдшеров и акушеров с 1995 года.</p>' } }
    ]));
    assert.equal(description, 'Колледж готовит медицинских сестёр, фельдшеров и акушеров с 1995 года.');
  });

  test('ignores disabled blocks and the never-shown hero text', () => {
    const description = pageDescription(page([
      { type: 'hero', enabled: true, fields: { textHtml: 'Материалы появляются здесь после публикации в админке.' } },
      { type: 'text', enabled: false, fields: { html: '<p>Этот текст выключен и не должен попасть в поисковое описание страницы.</p>' } }
    ]), { pages: { home: { title: 'Медколледж' } } });
    assert.equal(description, 'О колледже — Медколледж');
  });

  test('uses the latest news for a news page without text', () => {
    const description = pageDescription(page([{ type: 'posts', enabled: true }], { title: 'Новости' }), {
      posts: [
        { status: 'published', title: 'Старая', publishedAt: '2026-01-01' },
        { status: 'published', title: 'Новая', publishedAt: '2026-02-01' },
        { status: 'draft', title: 'Черновик', publishedAt: '2026-03-01' }
      ]
    });
    assert.equal(description, 'Новости: Новая; Старая');
  });

  test('custom description wins and is cut on a word boundary', () => {
    const description = pageDescription(page([], { seo: { description: 'слово '.repeat(60) } }));
    assert.ok(description.length <= 180);
    assert.match(description, /слово…$/);
  });
});

describe('server-rendered pages', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.stop());

  test('home page: one h1, real card links, no service phrases, images with alt', async () => {
    const { text } = await server.request('/');
    assert.equal((text.match(/<h1[\s>]/g) || []).length, 1);
    assert.match(text, /<h1 class="page-h1 visually-hidden" id="pageH1">[^<]+<\/h1>/);
    for (const phrase of ['Материалы появляются здесь', 'Опубликуйте первый материал', 'CMS Engine', 'Публикации сайта', 'Открыть пост']) {
      assert.ok(!text.includes(phrase), `"${phrase}" must not be in the page HTML`);
    }
    assert.match(text, /<a href="\/sestrinskoe-delo" class="linked-block-wrap">/);
    for (const image of text.match(/<img [^>]*>/g) || []) assert.match(image, /alt="[^"]+"/, image);
  });

  test('menu items that lead nowhere are text, not empty links', async () => {
    const { text } = await server.request('/');
    assert.doesNotMatch(text, /<a href="#">/);
  });

  test('descriptions come from page text, not from placeholders', async () => {
    const description = async (pathname) => (await server.request(pathname)).text.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.match(await description('/sestrinskoe-delo'), /^Подготовка медицинских сестер/);
    assert.doesNotMatch(await description('/'), /админке/);
  });

  test('page heading can be set and shown from the editor', async () => {
    await server.login();
    const home = (await server.request('/api/pages/home')).json;
    await server.request('/api/pages/home', { method: 'POST', body: { ...home, seo: { ...home.seo, h1: 'Медицинский колледж в Махачкале', showH1: true } } });
    server.logoutLocally();
    const { text } = await server.request('/');
    assert.match(text, /<h1 class="page-h1" id="pageH1">Медицинский колледж в Махачкале<\/h1>/);
  });

  test('admin dashboard warns when CMS_SITE_URL is missing', async () => {
    await server.login();
    const { json } = await server.request('/api/dashboard');
    assert.ok(json.warnings.some((warning) => warning.id === 'site-url'));
    server.logoutLocally();
  });
});

describe('with CMS_SITE_URL', () => {
  let server;
  before(async () => {
    server = await startServer({ CMS_SITE_URL: 'https://college.example' });
  });
  after(() => server.stop());

  test('uses the configured address and shows no warning', async () => {
    const { text } = await server.request('/sestrinskoe-delo');
    assert.match(text, /<link rel="canonical" href="https:\/\/college.example\/sestrinskoe-delo">/);
    assert.match((await server.request('/sitemap.xml')).text, /<loc>https:\/\/college.example\/<\/loc>/);
    await server.login();
    assert.deepEqual((await server.request('/api/dashboard')).json.warnings, []);
  });
});
