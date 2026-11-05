import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyInfoPages, infoPages } from '../scripts/content/info-pages.js';

function textPage(id, html) {
  return { id, title: id, blocks: [{ id: 'text', type: 'text', enabled: true, order: 30, fields: { html } }] };
}

function basePages() {
  return {
    home: {
      id: 'home',
      title: 'Главная',
      blocks: [
        { id: 'side', type: 'sideMenu', enabled: true, order: -20, fields: { items: [
          { label: 'Контакты', href: '#' },
          { label: 'Студенту', href: '/custom-page' }
        ] } },
        { id: 'head', type: 'headerNav', enabled: true, order: -30, fields: { items: [{ label: 'Приемная комиссия', href: '#' }] } },
        { id: 'foot', type: 'footer', enabled: true, order: 1000, fields: { items: [{ label: 'Контакты', href: '#contacts' }] } }
      ]
    },
    obrazovanie: textPage('obrazovanie', '<p>Новая страница. Здесь можно добавить текст</p>'),
    'vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya': textPage('vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya', '<p>Текст владельца</p>'),
    'director-address': textPage('director-address', '<div class="director-address-page"><img src="/uploads/d.jpg"><p>Слова директора</p></div>'),
    novosti: { id: 'novosti', title: 'Новости', blocks: [{ id: 'posts', type: 'posts', enabled: true, order: 20, fields: { titleHtml: 'Новости' } }] }
  };
}

const html = (page) => page.blocks.filter((block) => block.type === 'text').map((block) => block.fields.html).join('');

describe('applyInfoPages', () => {
  test('replaces placeholders and creates missing pages', () => {
    const pages = basePages();
    applyInfoPages(pages);
    assert.match(html(pages.obrazovanie), /specialty-detail-hero/);
    assert.match(html(pages.kontakty), /ул\. Батырая, д\. 56/);
    assert.ok(pages.kontakty.seo.description);
  });

  test('keeps a page edited by hand', () => {
    const pages = basePages();
    const { kept } = applyInfoPages(pages);
    assert.equal(html(pages['vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya']), '<p>Текст владельца</p>');
    assert.ok(kept.includes('vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya'));
  });

  test('keeps the director text and photo in the new design', () => {
    const pages = basePages();
    applyInfoPages(pages);
    assert.match(html(pages['director-address']), /Слова директора/);
    assert.match(html(pages['director-address']), /src="\/uploads\/d\.jpg"/);
    assert.doesNotMatch(html(pages['director-address']), /director-address-page/);
  });

  test('does not carry over a director photo hosted elsewhere', () => {
    const pages = basePages();
    pages['director-address'] = textPage('director-address', '<div class="director-address-page"><img src="https://example.com/a.jpg"><p>Слова директора</p></div>');
    applyInfoPages(pages);
    assert.doesNotMatch(html(pages['director-address']), /<img/);
    assert.match(html(pages['director-address']), /Слова директора/);
  });

  test('puts the heading above a working block', () => {
    const pages = basePages();
    applyInfoPages(pages);
    const hero = pages.novosti.blocks.find((block) => block.id === 'info-hero');
    const posts = pages.novosti.blocks.find((block) => block.id === 'posts');
    assert.ok(hero.order < posts.order);
    assert.equal(posts.fields.titleHtml, 'Все новости');
  });

  test('links only menu items that still have the old address', () => {
    const pages = basePages();
    applyInfoPages(pages);
    const items = pages.home.blocks.find((block) => block.id === 'side').fields.items;
    assert.equal(items[0].href, '/site.html?page=kontakty');
    assert.equal(items[1].href, '/custom-page');
  });

  test('adds the teachers page to the menu once and links it from the details page', () => {
    const pages = basePages();
    pages['svedeniya-ob-obrazovatelnoy-organizacii'] = {
      id: 'svedeniya-ob-obrazovatelnoy-organizacii',
      title: 'Сведения',
      blocks: [{ id: 'info-content', type: 'text', enabled: true, order: 30, fields: { html: '<section class="specialty-detail"><article class="specialty-info-card"><h3>Педагогический состав</h3><p><span class="info-pending">уточняется</span></p></article></section>' } }]
    };
    applyInfoPages(pages);
    assert.ok(pages.pedagogi.blocks.some((block) => block.type === 'teachers'));
    assert.equal(pages.home.blocks.find((block) => block.id === 'side').fields.items.filter((item) => item.label === 'Педагоги').length, 1);
    const details = html(pages['svedeniya-ob-obrazovatelnoy-organizacii']);
    assert.match(details, /href="\/pedagogi"/);
    assert.doesNotMatch(details, /info-pending/);
  });

  test('keeps a teachers card edited by hand', () => {
    const pages = basePages();
    const edited = '<section class="specialty-detail"><article class="specialty-info-card"><h3>Педагогический состав</h3><p>Свой текст</p></article></section>';
    pages['svedeniya-ob-obrazovatelnoy-organizacii'] = {
      id: 'svedeniya-ob-obrazovatelnoy-organizacii',
      title: 'Сведения',
      blocks: [{ id: 'info-content', type: 'text', enabled: true, order: 30, fields: { html: edited } }]
    };
    applyInfoPages(pages);
    assert.equal(html(pages['svedeniya-ob-obrazovatelnoy-organizacii']), edited);
  });

  test('a second run changes nothing', () => {
    const pages = basePages();
    applyInfoPages(pages);
    const { changes } = applyInfoPages(pages);
    assert.deepEqual(changes, []);
  });

  test('contains nothing from the other college and no h1', () => {
    const all = infoPages.map((page) => page.html).join('');
    assert.doesNotMatch(all, /Хасплатова|Юсупова|dag-mik|Многопрофильн|mik05|<h1/i);
  });
});
