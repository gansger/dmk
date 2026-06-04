# API

Базовый адрес при локальном запуске: `http://localhost:3003`.

## Авторизация

`POST /api/auth/login`

```json
{
  "username": "admin",
  "password": "..."
}
```

`GET /api/auth/session`

`POST /api/auth/logout`

`POST /api/auth/password`

```json
{
  "currentPassword": "...",
  "password": "...",
  "passwordConfirmation": "..."
}
```

После входа браузер получает `HttpOnly` cookie-сессию. Все API закрыты авторизацией администратора, кроме health-check, публичного чтения сайта, AI-чата сайта, Telegram webhook и создания лида Bitrix.

## Health

`GET /api/health`

## Dashboard

`GET /api/dashboard`

Возвращает счетчики постов, состояние интеграций и последние события.

## Posts

`GET /api/posts`

`POST /api/posts`

```json
{
  "title": "Заголовок",
  "slug": "optional-slug",
  "content": "Текст",
  "tags": ["news"]
}
```

`PUT /api/posts/:id`

`POST /api/posts/:id/publish`

`DELETE /api/posts/:id`

## Public

Публичные HTML-маршруты:

`GET /`

`GET /:pageId`

`GET /news/:slug`

`GET /robots.txt`

`GET /sitemap.xml`

Старые URL с параметром `page` перенаправляются на чистые публичные URL с кодом `301`.

`GET /api/public/posts`

Возвращает только опубликованные посты.

`GET /api/public/slider`

Возвращает настройки слайдера и опубликованные посты, выбранные в CMS для показа:

```json
{
  "settings": {
    "enabled": true,
    "autoplay": true,
    "intervalMs": 6500,
    "transitionMs": 450,
    "showControls": true,
    "showDots": true,
    "pauseOnHover": true,
    "maxItems": 6
  },
  "posts": []
}
```

`GET /api/slider/settings`

`POST /api/slider/settings`

Сохраняет настройки слайдера из админки.

`GET /api/public/posts/:slug`

Возвращает один опубликованный пост с полным текстом и массивом `media`.

## Integrations

`GET /api/integrations`

`POST /api/integrations`

`POST /api/integrations/:name/test`

Где `:name` = `telegram`, `bitrix`, `ai`.

## Telegram

`POST /api/integrations/telegram/import`

Импортирует доступные updates через Telegram Bot API. Если в настройках Telegram включен `autoPublish`, новые записи сразу получают статус `published`.

Фото из Telegram сохраняются как `media`. Для альбомов Telegram используется `media_group_id`: несколько сообщений объединяются в один пост, первое фото становится `coverImage`.

`POST /api/integrations/telegram/webhook`

Webhook endpoint для Telegram.

## Bitrix

`POST /api/integrations/bitrix/lead`

```json
{
  "title": "Заявка с сайта",
  "name": "Иван",
  "phone": "+79990000000",
  "email": "client@example.com",
  "comments": "Текст заявки"
}
```

## AI

`POST /api/ai/assistant`

```json
{
  "visitorId": "client-1",
  "message": "Чем вы занимаетесь?"
}
```

## Knowledge

`GET /api/knowledge`

`POST /api/knowledge`

`PUT /api/knowledge/:id`

`DELETE /api/knowledge/:id`

## Memory

`GET /api/memory`

`POST /api/memory`
