# CMS Engine Starter

CMS-движок для сайтов: публичные страницы, защищённая админка, редактор страниц, посты, публикация, интеграции, база знаний и AI-помощник.

## Запуск

Требуется Node.js 24 или новее.

```bash
npm run migrate
npm start
```

Основные адреса:

- публичный сайт: `http://localhost:3003`;
- публичная страница: `http://localhost:3003/obrazovanie`;
- публичная публикация: `http://localhost:3003/news/example-post`;
- вход и админка: `http://localhost:3003/admin`;
- редактор страниц: `http://localhost:3003/edit`.

Редактор `/edit` и приватные API доступны только после авторизации через `/admin`.

## Тесты

```bash
npm test
```

Тесты запускают настоящий сервер на свободном порту с пустой временной базой и без `.env.local` (`CMS_ENV_FILE=""`), поэтому не трогают рабочие данные и не обращаются к Telegram, Bitrix и OpenAI.

## Хранилище

Рабочие данные находятся в SQLite-базе `data/cms.sqlite`. При первом запуске существующие данные из `data/*.json` импортируются автоматически. JSON-файлы сохранены только как legacy-источник для миграции.

Для production храните SQLite-файл на локальном persistent-диске сервера, а не на сетевой файловой системе. В Docker Compose для него используется volume `cms-storage`.

## Секреты

Секреты интеграций не сохраняются в SQLite и не редактируются через CMS API. Локальные значения лежат в `.env.local`, который исключён из Git. Шаблон находится в `.env.example`.

Обязательные переменные для первого входа:

```bash
CMS_ADMIN_USERNAME="admin"
CMS_ADMIN_PASSWORD="replace-with-a-long-random-password"
```

При первом запуске пароль администратора переносится в SQLite в виде хеша. После входа его можно изменить в разделе «Безопасность»; открытый пароль в SQLite не сохраняется.

Переменные интеграций:

```bash
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_SECRET=""
BITRIX_WEBHOOK_URL=""
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

После перехода со старой версии `npm run migrate` переносит существующие секреты из JSON в `.env.local`, очищает legacy-файлы и удаляет токены из журнала событий.

## SEO

Для production обязательно укажите публичный HTTPS-адрес:

```bash
CMS_SITE_URL="https://example.com"
CMS_SITE_NAME="Название организации"
CMS_DEFAULT_DESCRIPTION="Краткое описание сайта для поисковой выдачи."
```

Публичные страницы отдаются с серверным HTML, canonical, description, Open Graph, Twitter Card и JSON-LD. Доступны динамические `robots.txt` и `sitemap.xml`.

SEO title, description, изображение для соцсетей и запрет индексации страницы настраиваются в визуальном редакторе `/edit`. Для публикаций SEO title, description и запрет индексации настраиваются в разделе «Посты».

Старые ссылки вида `/?page=obrazovanie` и `/site.html?page=obrazovanie` перенаправляются на чистый URL `/obrazovanie`.

Пошаговая настройка — адрес сайта, Яндекс.Вебмастер, Google Search Console, поля вкладки SEO и чек-лист — в [docs/SEO.md](docs/SEO.md).

## Что уже есть

- Cookie-сессии и хеш пароля администратора в SQLite.
- Приватные CMS API для постов, страниц, настроек, интеграций, знаний и памяти.
- Публичные API для чтения сайта, AI-чата, Telegram webhook и Bitrix-формы.
- Серверный SEO-рендеринг публичных страниц и публикаций.
- Чистые URL, canonical, sitemap, robots и структурированные данные.
- Telegram polling/webhook, автопубликация и сохранение фото.
- Bitrix24 adapter для создания лидов.
- OpenAI-compatible AI-помощник с knowledge/memory. В запрос к модели попадают только записи базы знаний, подходящие к вопросу (полнотекстовый поиск SQLite FTS5 по заголовку, тексту и тегам). Проверить, что найдётся по вопросу: `GET /api/knowledge/search?q=...` под админом.
- Автоверсии статики: в HTML ссылки на JS/CSS/картинки получают `?v=<хеш содержимого>` автоматически, вручную `?v=` не пишется. Файл с актуальным хешем кэшируется навсегда, остальные запросы перепроверяются по `ETag` (ответ 304, если файл не менялся).

## Важные файлы

- `src/server.js` — точка входа: HTTP-сервер, проверка доступа и подключение маршрутов.
- `src/routes/` — маршруты по разделам: `site.js` (публичные страницы, sitemap, вход в админку и редактор), `auth.js`, `posts.js` (посты и слайдер), `pages.js`, `gallery.js`, `uploads.js`, `integrations.js`, `ai.js` (ассистент, база знаний, память), `system.js`, `access.js` (публичные API и лимиты).
- `src/domain/` — правила данных без HTTP: нормализация постов, страниц, галереи, настроек слайдера и интеграций.
- `src/core/store.js` — SQLite-хранилище и импорт legacy JSON.
- `src/services/auth.js` — сессии администратора.
- `src/integrations/telegram.js` — импорт Telegram.
- `src/integrations/bitrix.js` — Bitrix24 adapter.
- `src/services/assistant.js` — AI-помощник.
- `public/index.html` — админка.
- `public/site.html` — публичный сайт и защищённый редактор.
- `scripts/migrate-to-sqlite.js` — миграция и очистка секретов.
