// Content of the information pages, in the design of the specialty pages.
// Only facts already published on the site and general norms are stated;
// everything else about the college is marked with pending().
import { normalizePage, syncSharedLayoutBlocks } from '../../src/domain/pages.js';

const ADDRESS = 'Республика Дагестан, г. Махачкала, ул. Батырая, д. 56, 367000';
const PHONE = '<a href="tel:+79285440406">+7 928 544 04 06</a>';
const NAME = 'АНО ПО «Дагестанский медицинский колледж»';
const MAP_URL = 'https://yandex.ru/maps/?text=%D0%9C%D0%B0%D1%85%D0%B0%D1%87%D0%BA%D0%B0%D0%BB%D0%B0%2C%20%D1%83%D0%BB.%20%D0%91%D0%B0%D1%82%D1%8B%D1%80%D0%B0%D1%8F%2C%2056';

const pending = '<span class="info-pending">уточняется</span>';

const icons = {
  building: '<path d="M12 54h40"></path><path d="M18 54V22l14-10 14 10v32"></path><path d="M28 54V42h8v12"></path><path d="M26 28h4"></path><path d="M34 28h4"></path>',
  document: '<path d="M20 10h18l10 10v34H20z"></path><path d="M38 10v10h10"></path><path d="M26 32h16"></path><path d="M26 42h16"></path>',
  graduate: '<path d="M8 26l24-12 24 12-24 12z"></path><path d="M18 32v12c8 7 20 7 28 0V32"></path><path d="M56 26v14"></path>',
  student: '<circle cx="32" cy="20" r="10"></circle><path d="M14 54c2-12 9-18 18-18s16 6 18 18"></path>',
  phone: '<path d="M18 12l8 12-5 5c3 7 8 12 15 15l5-5 12 8-4 8c-20 2-41-19-39-39z"></path>',
  calendar: '<path d="M12 18h40v36H12z"></path><path d="M12 28h40"></path><path d="M22 12v10"></path><path d="M42 12v10"></path><path d="M22 38h6"></path><path d="M36 38h6"></path>',
  sport: '<circle cx="32" cy="32" r="22"></circle><path d="M10 32h44"></path><path d="M32 10c-8 7-8 37 0 44"></path><path d="M32 10c8 7 8 37 0 44"></path>',
  check: '<path d="M32 8l20 8v14c0 12-8 21-20 26-12-5-20-14-20-26V16z"></path><path d="M23 32l7 7 12-14"></path>',
  screen: '<path d="M10 14h44v30H10z"></path><path d="M24 54h16"></path><path d="M32 44v10"></path>',
  person: '<circle cx="32" cy="22" r="11"></circle><path d="M12 56c3-13 10-19 20-19s17 6 20 19"></path>',
  news: '<path d="M12 14h34v38H18a6 6 0 0 1-6-6z"></path><path d="M46 24h6v22a6 6 0 0 1-6 6"></path><path d="M20 24h18"></path><path d="M20 33h18"></path><path d="M20 42h12"></path>',
  photo: '<path d="M10 16h44v34H10z"></path><circle cx="24" cy="28" r="4"></circle><path d="M10 44l14-10 10 8 8-6 12 10"></path>',
  privacy: '<path d="M18 28h28v26H18z"></path><path d="M24 28v-8a8 8 0 0 1 16 0v8"></path><path d="M32 38v8"></path>'
};

function hero({ icon, label, title, lead }) {
  return `<div class="specialty-detail-hero"><div class="specialty-detail-icon"><svg viewBox="0 0 64 64" aria-hidden="true">${icons[icon]}</svg></div><div><span class="specialty-detail-code">${label}</span><h2>${title}</h2><p class="specialty-detail-lead">${lead}</p></div></div>`;
}

function card(title, body, { wide = false } = {}) {
  return `<article class="specialty-info-card${wide ? ' info-card-wide' : ''}"><h3>${title}</h3>${body}</article>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function facts(rows) {
  return `<dl class="info-facts">${rows.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function page(heroFields, cards, note = '') {
  const noteHtml = note ? `<div class="specialty-qualification">${note}</div>` : '';
  return `<section class="specialty-detail">${hero(heroFields)}<div class="specialty-detail-grid">${cards.join('')}</div>${noteHtml}</section>`;
}

const link = (id, label) => `<a href="/${id}">${label}</a>`;

const teachersPageId = 'pedagogi';
const teachersCardBody = `<p>${link(teachersPageId, 'Педагоги колледжа')}</p>`;

const specialties = [
  { id: 'sestrinskoe-delo', code: '34.02.01', name: 'Сестринское дело', qualification: 'мед. сестра / мед. брат', bases: 'после 9 и 11 классов', forms: 'очно, очно-заочно', price: '90 тыс.' },
  { id: 'lechebnoe-delo', code: '31.02.01', name: 'Лечебное дело', qualification: 'фельдшер', bases: 'после 9 и 11 классов', forms: 'очно', price: '100 тыс.' },
  { id: 'akusherskoe-delo', code: '31.02.02', name: 'Акушерское дело', qualification: 'акушерка / акушер', bases: 'после 9 и 11 классов', forms: 'очно', price: '100 тыс.' },
  { id: 'stomatologiya-ortopedicheskaya', code: '31.02.05', name: 'Стоматология ортопедическая', qualification: 'зубной техник', bases: 'после 11 классов', forms: 'очно, очно-заочно', price: '100 тыс.' },
  { id: 'stomatologiya-profilakticheskaya', code: '31.02.06', name: 'Стоматология профилактическая', qualification: 'гигиенист стоматологический', bases: 'после 9 и 11 классов', forms: 'очно, очно-заочно', price: '100 тыс.' },
  { id: 'medicinskiy-administrator', code: '31.01.01', name: 'Медицинский администратор', qualification: 'медицинский администратор', bases: 'после 9 и 11 классов', forms: 'очно', price: '100 тыс.' }
];

const applicationDocuments = list([
  'заявление о приёме;',
  'паспорт (оригинал или копия);',
  'аттестат или другой документ об образовании (оригинал или копия);',
  'фотографии 3×4;',
  'медицинская справка, если она требуется для специальности.'
]);

// Pages created from scratch. placeholder: an existing page is replaced only
// while its text still contains this; otherwise it has been edited and is kept.
export const infoPages = [
  {
    id: 'svedeniya-ob-obrazovatelnoy-organizacii',
    title: 'Сведения об образовательной организации',
    placeholder: 'ЭТО называется что то',
    description: 'Основные сведения о Дагестанском медицинском колледже: наименование, адрес, контакты, руководство, образование и документы.',
    html: page(
      { icon: 'building', label: 'Об организации', title: 'Сведения об образовательной организации', lead: 'Официальная информация о колледже, которую образовательная организация размещает на своём сайте.' },
      [
        card('Основные сведения', facts([
          ['Наименование', NAME],
          ['Дата создания', pending],
          ['Учредитель', pending],
          ['Адрес', ADDRESS],
          ['Режим и график работы', pending],
          ['Телефон', PHONE],
          ['Электронная почта', pending],
          ['Лицензия', pending]
        ]), { wide: true }),
        card('Структура и органы управления', `<p>${pending}</p>`),
        card('Документы', `<p>Устав, лицензия и локальные акты: ${link('dokumentaciya', 'раздел «Документация»')}.</p>`),
        card('Образование', `<p>Программы и формы обучения: ${link('obrazovanie', 'раздел «Образование»')}.</p>`),
        card('Руководство', `<p>Директор: ${pending}</p><p>${link('director-address', 'Обращение директора')}</p>`),
        card('Педагогический состав', teachersCardBody),
        card('Материально-техническое обеспечение и доступная среда', `<p>${pending}</p>`),
        card('Платные образовательные услуги', `<p>Стоимость по специальностям: ${link('abiturientu', 'раздел «Абитуриенту»')}. Договор и приказ о стоимости: ${pending}</p>`),
        card('Финансово-хозяйственная деятельность', `<p>${pending}</p>`),
        card('Вакантные места для приёма', `<p>${pending}</p>`),
        card('Стипендии и меры поддержки', `<p>${pending}</p>`),
        card('Международное сотрудничество', `<p>${pending}</p>`),
        card('Организация питания', `<p>${pending}</p>`),
        card('Образовательные стандарты и требования', `<p>${pending}</p>`)
      ]
    )
  },
  {
    id: 'dokumentaciya',
    title: 'Документация',
    description: 'Документы Дагестанского медицинского колледжа: уставные документы, правила приёма, локальные акты и оценка качества образования.',
    html: page(
      { icon: 'document', label: 'Документы', title: 'Документация', lead: 'Документы колледжа, собранные по разделам. Файлы появятся здесь по мере размещения.' },
      [
        card('Уставные документы', list([`Устав: ${pending}`, `Лицензия или выписка из реестра лицензий: ${pending}`, `Правила внутреннего распорядка: ${pending}`])),
        card('Приём на обучение', list([`Правила приёма: ${pending}`, `Образец договора об обучении: ${pending}`, `Приказ о стоимости обучения: ${pending}`])),
        card('Учебный процесс', list([`Локальные акты об обучении: ${pending}`, `Отчёт о самообследовании: ${pending}`])),
        card(link('vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya', 'Оценка качества образования'), '<p>Как устроена внутренняя система оценки качества и какие документы к ней относятся.</p>')
      ]
    )
  },
  {
    id: 'vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya',
    title: 'Внутренняя система оценки качества образования',
    placeholder: 'Новая страница.',
    description: 'Что такое внутренняя система оценки качества образования в колледже и что она оценивает.',
    html: page(
      { icon: 'check', label: 'Документация', title: 'Внутренняя система оценки качества образования', lead: 'Постоянная проверка того, насколько обучение соответствует образовательным стандартам и ожиданиям студентов.' },
      [
        card('Что оценивается', list(['содержание образовательных программ;', 'условия обучения;', 'результаты обучения студентов.'])),
        card('Документы', list([`Положение о внутренней системе оценки качества: ${pending}`, `Результаты оценки: ${pending}`]))
      ]
    )
  },
  {
    id: 'obrazovanie',
    title: 'Образование',
    placeholder: 'Новая страница.',
    description: 'Программы среднего профессионального образования Дагестанского медицинского колледжа: шесть медицинских специальностей, формы обучения.',
    html: page(
      { icon: 'graduate', label: 'Программы', title: 'Образование', lead: 'Колледж готовит специалистов со средним медицинским образованием на базе 9 и 11 классов.' },
      [
        card('Образовательные программы', list(specialties.map((item) => `${item.code} ${link(item.id, item.name)}`)), { wide: true }),
        card('Формы обучения', '<p>Очная и очно-заочная. Доступные формы зависят от специальности, подробности на странице каждой из них.</p>'),
        card('Сведения о программах', list([`Учебные планы: ${pending}`, `Численность обучающихся: ${pending}`, `Результаты приёма: ${pending}`]))
      ]
    )
  },
  {
    id: 'abiturientu',
    title: 'Абитуриенту',
    description: 'Поступление в Дагестанский медицинский колледж: специальности, квалификации, стоимость, порядок поступления и образовательный кредит.',
    html: page(
      { icon: 'graduate', label: 'Поступление', title: 'Абитуриенту', lead: 'Выберите специальность и узнайте, как подать документы. На вопросы ответит приёмная комиссия.' },
      [
        ...specialties.map((item) => card(link(item.id, item.name), list([
          `Код: ${item.code}`,
          `Квалификация: ${item.qualification}`,
          `Поступление ${item.bases}`,
          `Форма: ${item.forms}`,
          `Стоимость: ${item.price}`
        ]))),
        card('Как поступить', `<ul><li>Выберите специальность и форму обучения.</li><li>Подготовьте документы: ${link('priemnaya-komissiya', 'список в разделе «Приёмная комиссия»')}.</li><li>Подайте документы в приёмную комиссию в сроки приёма.</li><li>Заключите договор об обучении.</li></ul>`),
        card('Образовательный кредит', '<p>Обучение можно оплатить кредитом с господдержкой под 3% годовых (постановление Правительства РФ от 15.09.2020 № 1448). Возможность получить его на выбранную программу уточните в банке и в приёмной комиссии.</p>')
      ],
      `Вопросы о поступлении: ${PHONE}`
    )
  },
  {
    id: 'priemnaya-komissiya',
    title: 'Приёмная комиссия',
    description: 'Приёмная комиссия Дагестанского медицинского колледжа: телефон, адрес, сроки приёма и документы для поступления.',
    html: page(
      { icon: 'phone', label: 'Поступление', title: 'Приёмная комиссия', lead: 'Консультации по поступлению, выбору специальности и подаче документов.' },
      [
        card('Как связаться', facts([['Телефон', PHONE], ['Адрес', ADDRESS], ['Режим работы', pending]])),
        card('Сроки приёма', list([`Начало приёма документов: ${pending}`, `Окончание приёма документов: ${pending}`, `Зачисление: ${pending}`])),
        card('Какие документы нужны', `${applicationDocuments}<p>Точный перечень и количество фотографий будут указаны в правилах приёма: ${pending}</p>`),
        card('Способы подачи', list(['лично в приёмной комиссии;', `по почте, в электронном виде или через Госуслуги: ${pending}`])),
        card('Места для приёма', list([`Количество мест на следующий учебный год: ${pending}`, `Правила приёма: ${pending}`])),
        card(link('abiturientu', 'Специальности и стоимость'), '<p>Шесть медицинских специальностей на базе 9 и 11 классов: квалификации, формы обучения, стоимость.</p>')
      ]
    )
  },
  {
    id: 'studentu',
    title: 'Студенту',
    description: 'Раздел для студентов Дагестанского медицинского колледжа: учебный процесс, электронная среда, новости и студенческая жизнь.',
    html: page(
      { icon: 'student', label: 'Учёба', title: 'Студенту', lead: 'Всё, что нужно для учёбы и жизни в колледже, в одном месте.' },
      [
        card(link('obrazovatelnyy-process', 'Образовательный процесс'), '<p>Формы обучения, расписание, практика и итоговая аттестация.</p>'),
        card(link('elektronnaya-informacionno-obrazovatelnaya-sreda', 'Электронная образовательная среда'), '<p>Что входит в электронную среду и как ей пользоваться.</p>'),
        card(link('sportivnyy-klub', 'Студенческий спортивный клуб'), '<p>Секции и спортивная жизнь колледжа.</p>'),
        card(link('novosti', 'Новости'), '<p>События и объявления колледжа.</p>'),
        card(link('fotogalereya', 'Фотогалерея'), '<p>Фотографии из жизни колледжа.</p>'),
        card('Стипендии и меры поддержки', `<p>${pending}</p>`)
      ]
    )
  },
  {
    id: 'obrazovatelnyy-process',
    title: 'Образовательный процесс',
    description: 'Как организовано обучение в Дагестанском медицинском колледже: формы обучения, расписание, практика и итоговая аттестация.',
    html: page(
      { icon: 'calendar', label: 'Учёба', title: 'Образовательный процесс', lead: 'Как организовано обучение в колледже: занятия, практика и аттестация.' },
      [
        card('Формы обучения', `<p>Очная и очно-заочная, в зависимости от специальности. Сроки указаны на страницах специальностей и в ${link('obrazovanie', 'разделе «Образование»')}.</p>`),
        card('Расписание', list([`Расписание занятий: ${pending}`, `Расписание экзаменов и зачётов: ${pending}`, `График учебного процесса: ${pending}`])),
        card('Практика', list([`Базы практики: ${pending}`, `График практики: ${pending}`])),
        card('Итоговая аттестация', `<p>Обучение завершается государственной итоговой аттестацией. Для работы по медицинской специальности выпускник также проходит аккредитацию специалиста.</p><p>Программа и сроки аттестации: ${pending}</p>`)
      ]
    )
  },
  {
    id: 'elektronnaya-informacionno-obrazovatelnaya-sreda',
    title: 'Электронная информационно-образовательная среда',
    placeholder: 'жи есть',
    description: 'Электронная информационно-образовательная среда колледжа: что в неё входит и как получить доступ.',
    html: page(
      { icon: 'screen', label: 'Учёба', title: 'Электронная информационно-образовательная среда', lead: 'Электронные ресурсы, с которыми студенты и преподаватели работают в учебном процессе.' },
      [
        card('Что обычно входит', list(['учебные планы и рабочие программы;', 'электронные учебные материалы и библиотека;', 'результаты промежуточной аттестации;', 'общение с преподавателями.'])),
        card('Как получить доступ', list([`Адрес входа: ${pending}`, `Как получить логин и пароль: ${pending}`, `Техническая поддержка: ${pending}`]))
      ]
    )
  },
  {
    id: 'sportivnyy-klub',
    title: 'Студенческий спортивный клуб',
    description: 'Студенческий спортивный клуб Дагестанского медицинского колледжа: секции, расписание и как записаться.',
    html: page(
      { icon: 'sport', label: 'Студенческая жизнь', title: 'Студенческий спортивный клуб', lead: 'Спортивная жизнь студентов колледжа: секции, тренировки и соревнования.' },
      [
        card('Секции и расписание', list([`Секции: ${pending}`, `Расписание тренировок: ${pending}`])),
        card('Клуб', list([`Руководитель: ${pending}`, `Как записаться: ${pending}`, `Положение о клубе: ${pending}`]))
      ]
    )
  },
  {
    id: 'kontakty',
    title: 'Контакты',
    description: 'Контакты Дагестанского медицинского колледжа в Махачкале: адрес ул. Батырая, 56, телефон приёмной комиссии.',
    html: page(
      { icon: 'phone', label: 'Связаться', title: 'Контакты', lead: 'Как связаться с колледжем и как нас найти.' },
      [
        card('Адрес и телефон', facts([
          ['Наименование', NAME],
          ['Адрес', ADDRESS],
          ['Приёмная комиссия', PHONE],
          ['Электронная почта', pending],
          ['Режим работы', pending]
        ]), { wide: true }),
        card('Как добраться', `<p><a href="${MAP_URL}">Открыть адрес на Яндекс Картах</a></p>`),
        card(link('priemnaya-komissiya', 'Поступление'), '<p>Сроки приёма и документы для поступления.</p>')
      ]
    )
  },
  {
    id: 'politika-konfidencialnosti',
    title: 'Политика конфиденциальности',
    placeholder: 'будет опубликован в ближайшее время',
    html: page(
      { icon: 'privacy', label: 'Документы', title: 'Политика конфиденциальности', lead: 'Как колледж обрабатывает и защищает персональные данные посетителей сайта.' },
      [card('Текст политики', '<p>Текст политики конфиденциальности будет опубликован в ближайшее время.</p>', { wide: true })]
    )
  }
];

// Pages with a working block of their own get only the heading above it.
export const heroPages = [
  {
    id: 'novosti',
    description: 'Новости и события Дагестанского медицинского колледжа.',
    hero: { icon: 'news', label: 'События', title: 'Новости', lead: 'События, объявления и жизнь колледжа.' },
    retitle: { blockId: 'posts', from: 'Новости', to: 'Все новости' },
    // The default empty message speaks to the administrator, not to visitors.
    emptyFields: { emptyTitleHtml: 'Пока нет новостей', emptyTextHtml: 'Новости колледжа появятся здесь.' }
  },
  {
    id: 'fotogalereya',
    description: 'Фотографии из жизни колледжа: события, учёба, практика.',
    hero: { icon: 'photo', label: 'События', title: 'Фотогалерея', lead: 'Фотографии из жизни колледжа: события, учёба, практика.' },
    retitle: { blockId: 'gallery', from: 'Фотогалерея', to: 'Все фотографии' }
  }
];

// Menu items that lead nowhere or to an unrelated page, by label.
const sideMenuLinks = {
  'Документация': { from: '/site.html?page=vnutrennyaya-sistema-ocenki-kachestva-obrazovaniya', page: 'dokumentaciya' },
  'Абитуриенту': { from: '/site.html?page=elektronnaya-informacionno-obrazovatelnaya-sreda', page: 'abiturientu' },
  'Студенту': { from: '#', page: 'studentu' },
  'Контакты': { from: '#', page: 'kontakty' },
  'Приемная комиссия': { from: '#', page: 'priemnaya-komissiya' },
  'Образовательный процесс': { from: '#', page: 'obrazovatelnyy-process' },
  'Студенческий спортивный клуб': { from: '#', page: 'sportivnyy-klub' }
};

const textBlockStyles = { backgroundColor: '#f8fafc', textColor: '#18202f', fontSize: 16, padding: 28, borderRadius: 0, maxWidth: 1180, height: 0 };

function textBlock(id, order, html) {
  return { id, type: 'text', enabled: true, order, fields: { titleHtml: '', html, styles: { ...textBlockStyles } } };
}

function pageText(page) {
  return (page.blocks || []).filter((block) => block.type === 'text').map((block) => block.fields?.html || '').join('');
}

// Same disabled slider and posts blocks as on the specialty pages; the shared
// header, menu and footer are added from the home page.
function contentBlocks(html) {
  return [
    { id: 'slider', type: 'slider', enabled: false, order: 10, fields: {} },
    { id: 'posts', type: 'posts', enabled: false, order: 20, fields: {} },
    textBlock('info-content', 30, html)
  ];
}

function withDescription(seo, description) {
  return description && !seo?.description ? { ...seo, description } : seo;
}

function directorPage(previous) {
  const old = pageText(previous);
  const text = old.match(/<p>[\s\S]*<\/p>/)?.[0];
  // A photo hosted elsewhere is not carried over: it may disappear at any time.
  const photo = old.match(/<img[^>]*src="(\/[^"]+)"/)?.[1];
  if (!text) return null;
  const body = photo ? `<div class="info-director"><img src="${photo}" alt="Директор колледжа"><div>${text}</div></div>` : text;
  return page(
    { icon: 'person', label: 'О колледже', title: 'Обращение директора', lead: 'Слово директора колледжа к студентам, абитуриентам, родителям и партнёрам.' },
    [card('Директор колледжа', body, { wide: true })]
  );
}

function setSharedLinks(home, changes) {
  const side = home.blocks.find((block) => block.type === 'sideMenu');
  for (const item of side?.fields?.items || []) {
    const target = sideMenuLinks[item.label];
    if (target && item.href === target.from) {
      item.href = `/site.html?page=${target.page}`;
      changes.push(`меню: ${item.label}`);
    }
  }
  const header = home.blocks.find((block) => block.type === 'headerNav');
  for (const item of header?.fields?.items || []) {
    if (item.label === 'Приемная комиссия' && item.href === '#') {
      item.href = '/site.html?page=priemnaya-komissiya';
      changes.push('верхнее меню: Приёмная комиссия');
    }
  }
  const footer = home.blocks.find((block) => block.type === 'footer');
  for (const item of footer?.fields?.items || []) {
    if (item.label === 'Контакты' && item.href === '#contacts') {
      item.href = '/?page=kontakty';
      changes.push('подвал: Контакты');
    }
  }
}

// The people on this page are kept in the admin panel, not in the page text.
function addTeachersPage(pages, changes, kept) {
  if (pages[teachersPageId]) {
    kept.push(teachersPageId);
  } else {
    const heroHtml = `<section class="specialty-detail">${hero({ icon: 'person', label: 'О колледже', title: 'Педагоги', lead: 'Преподаватели Дагестанского медицинского колледжа.' })}</section>`;
    pages[teachersPageId] = normalizePage({
      id: teachersPageId,
      title: 'Педагоги',
      seo: { description: 'Педагоги Дагестанского медицинского колледжа: фамилии, имена и должности преподавателей.' },
      blocks: [
        textBlock('info-hero', 5, heroHtml),
        { id: 'slider', type: 'slider', enabled: false, order: 10, fields: {} },
        { id: 'posts', type: 'posts', enabled: false, order: 20, fields: {} },
        { id: 'teachers', type: 'teachers', enabled: true, order: 30, fields: {} }
      ]
    });
    changes.push(teachersPageId);
  }

  const href = `/site.html?page=${teachersPageId}`;
  const items = pages.home?.blocks?.find((block) => block.type === 'sideMenu')?.fields?.items;
  if (items && !items.some((item) => item.href === href || item.label === 'Педагоги')) {
    const after = items.findIndex((item) => item.label === 'Образовательный процесс');
    items.splice(after === -1 ? items.length : after + 1, 0, { id: 'item-pedagogi', label: 'Педагоги', href });
    changes.push('меню: Педагоги');
  }

  // Filled earlier with a pending mark; a card edited by hand no longer matches and stays.
  const pendingCard = card('Педагогический состав', `<p>${pending}</p>`);
  const details = pages['svedeniya-ob-obrazovatelnoy-organizacii']?.blocks?.find((block) => block.id === 'info-content');
  if (details?.fields?.html?.includes(pendingCard)) {
    details.fields.html = details.fields.html.replace(pendingCard, card('Педагогический состав', teachersCardBody));
    changes.push('сведения: Педагогический состав');
  }
}

// Fills pages in place. Returns what changed and which edited pages were kept.
export function applyInfoPages(pages) {
  const changes = [];
  const kept = [];

  for (const info of infoPages) {
    const previous = pages[info.id];
    const stillPlaceholder = info.placeholder && pageText(previous || {}).includes(info.placeholder) && !pageText(previous || {}).includes('specialty-detail');
    if (previous && !stillPlaceholder) {
      kept.push(info.id);
      continue;
    }
    const shared = (previous?.blocks || []).filter((block) => ['headerNav', 'sideMenu', 'footer'].includes(block.type));
    pages[info.id] = normalizePage({
      id: info.id,
      title: info.title,
      seo: withDescription(previous?.seo, info.description),
      blocks: [...shared, ...contentBlocks(info.html)]
    });
    changes.push(info.id);
  }

  const director = pages['director-address'];
  if (director && pageText(director).includes('director-address-page')) {
    const html = directorPage(director);
    if (html) {
      const shared = director.blocks.filter((block) => ['headerNav', 'sideMenu', 'footer'].includes(block.type));
      pages['director-address'] = normalizePage({
        id: director.id,
        title: 'Обращение директора',
        seo: withDescription(director.seo, 'Обращение директора Дагестанского медицинского колледжа к студентам, абитуриентам, родителям и партнёрам.'),
        blocks: [...shared, ...contentBlocks(html)]
      });
      changes.push('director-address');
    }
  } else {
    kept.push('director-address');
  }

  for (const info of heroPages) {
    const current = pages[info.id];
    if (!current || current.blocks.some((block) => block.id === 'info-hero')) {
      kept.push(info.id);
      continue;
    }
    const blocks = current.blocks.map((block) =>
      block.id === info.retitle.blockId && block.fields?.titleHtml === info.retitle.from
        ? { ...block, fields: { ...block.fields, ...info.emptyFields, titleHtml: info.retitle.to } }
        : block
    );
    const heroHtml = `<section class="specialty-detail">${hero(info.hero)}</section>`;
    pages[info.id] = normalizePage({
      ...current,
      seo: withDescription(current.seo, info.description),
      blocks: [...blocks, textBlock('info-hero', 5, heroHtml)]
    });
    changes.push(info.id);
  }

  addTeachersPage(pages, changes, kept);
  setSharedLinks(pages.home, changes);
  syncSharedLayoutBlocks(pages);
  return { changes, kept };
}
