# Публикация сайта: VDS Selectel + домен

Пошагово: сервер в Selectel (Ubuntu 22.04), привязка домена, запуск сайта в Docker на портах 80 и 443 с автоматическим HTTPS, перенос текущей базы и резервные копии. После этого — настройка поиска по [SEO.md](SEO.md).

Домен — `dmk05.ru`. `203.0.113.10` ниже — пример IP-адреса сервера: замените его на публичный IP вашего сервера в Selectel.

## Как это устроено

`docker compose` запускает два контейнера:

- **caddy** — принимает запросы на портах **80 и 443**, сам получает и продлевает бесплатный сертификат Let's Encrypt, перенаправляет `http://` → `https://` и `www.dmk05.ru` → `dmk05.ru`, передаёт запросы сайту. Настройки — в файле [`Caddyfile`](../Caddyfile).
- **cms-engine** — сам сайт. Наружу не открыт, доступен только через caddy.

nginx и certbot на сервере не нужны.

## 1. Сервер в Selectel

1. В панели Selectel создайте **облачный сервер**:
   - образ — **Ubuntu 22.04 LTS**;
   - для сайта колледжа хватит **1–2 vCPU, 2 ГБ памяти, 20 ГБ диска**;
   - **публичный IP-адрес** — обязательно;
   - доступ — **SSH-ключ** (надёжнее пароля). Если ключа нет, создайте на своём компьютере командой `ssh-keygen -t ed25519` и вставьте содержимое файла `~/.ssh/id_ed25519.pub` в форму Selectel.
2. Если для сервера в Selectel включён облачный файрвол — разрешите входящие порты **22, 80, 443** (TCP) и **443 (UDP)**.
3. Запишите публичный IP сервера и подключитесь (на Windows — в PowerShell или Git Bash):

   ```bash
   ssh root@203.0.113.10
   ```

## 2. Домен: DNS-записи у регистратора

В панели регистратора домена откройте управление DNS-записями и добавьте:

| Тип | Имя (хост) | Значение | TTL |
|---|---|---|---|
| `A` | `@` (сам домен) | `203.0.113.10` | 3600 |
| `A` | `www` | `203.0.113.10` | 3600 |

Если для `@` или `www` уже есть другие `A`-записи (например, на парковочную страницу регистратора) — удалите их.

> У `dmk05.ru` указаны DNS-серверы `ns1.reg.ru` и `ns2.reg.ru` — записи редактируются в DNS-панели, которая обслуживает эти серверы (у регистратора — раздел управления DNS / зоной домена). Если NS-серверы когда-нибудь сменят, записи нужно будет добавить там, куда укажут новые NS.
>
> Сейчас у `dmk05.ru` стоит `A`-запись на `37.228.116.226` — это не ваш сервер (адрес по умолчанию у регистратора). **Замените её** на IP сервера в Selectel и **добавьте** запись для `www` — её пока нет.

Записи начинают работать от нескольких минут до нескольких часов. Проверить на своём компьютере:

```bash
nslookup dmk05.ru
nslookup www.dmk05.ru
```

В обоих ответах должен быть IP вашего сервера. **Не запускайте сайт (шаг 5), пока домен не указывает на сервер:** caddy не сможет получить сертификат и будет повторять попытки, а Let's Encrypt ограничивает число неудачных попыток.

В этой же панели позже добавляются TXT-записи для подтверждения сайта в Яндекс.Вебмастере и Google Search Console (см. [SEO.md](SEO.md)).

## 3. Подготовка сервера (Ubuntu 22.04)

Все команды — на сервере, под `root`.

```bash
apt update && apt upgrade -y
apt install -y git ufw ca-certificates curl

# Docker и docker compose из официального репозитория Docker
# (в Ubuntu 22.04 версия из стандартных пакетов устаревшая).
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Файрвол: открыты только SSH, HTTP и HTTPS.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
```

Проверка:

```bash
docker --version
docker compose version
```

Если на сервере уже стоит nginx или apache и занимает порты 80/443 — остановите и отключите его: `systemctl disable --now nginx` (или `apache2`).

## 4. Код и настройки сайта

### Код

Репозиторий на GitHub: `https://github.com/gansger/dmk`. Если он приватный, понадобится [токен доступа GitHub](https://github.com/settings/tokens) с правом только на чтение — git спросит его вместо пароля.

```bash
cd /opt
git clone https://github.com/gansger/dmk.git
cd dmk
mkdir -p storage public/uploads
```

### Файл настроек `.env.local`

```bash
cp .env.example .env.local
nano .env.local
```

Заполните (сохранить в nano: Ctrl+O, Enter, Ctrl+X):

```bash
# Домен без https:// и без www — для него caddy получит сертификат.
SITE_DOMAIN="dmk05.ru"

CMS_ADMIN_USERNAME="admin"
CMS_ADMIN_PASSWORD="длинный-случайный-пароль"

# Тот же домен, полным адресом.
CMS_SITE_URL="https://dmk05.ru"
CMS_SITE_NAME="Дагестанский медицинский колледж"
CMS_DEFAULT_DESCRIPTION="Медицинский колледж в Махачкале: ..."

# Ключи интеграций — если используются.
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_SECRET=""
BITRIX_WEBHOOK_URL=""
OPENAI_API_KEY=""
```

`CMS_TRUST_PROXY` и путь к базе задавать не нужно: они уже прописаны в `docker-compose.yml`. База будет лежать в `/opt/dmk/storage/cms.sqlite`.

### Перенос текущей базы с вашего компьютера

Всё, что сделано в редакторе (страницы, меню, карточки), хранится в базе `data/cms.sqlite` на вашем компьютере. Если её не перенести, сайт запустится с исходным содержимым из `data/*.json`.

На **своём компьютере**, в папке проекта:

```bash
npm run backup -- data/cms-for-server.sqlite
scp data/cms-for-server.sqlite root@203.0.113.10:/opt/dmk/storage/cms.sqlite
```

Загруженные через редактор картинки лежат в `public/uploads/` — их тоже нужно перенести, если там что-то есть:

```bash
scp -r public/uploads/* root@203.0.113.10:/opt/dmk/public/uploads/
```

> **Пароль администратора.** Вместе с базой переносится и учётная запись администратора с паролем, который был у вас локально. `CMS_ADMIN_PASSWORD` из `.env.local` используется только при самом первом запуске с пустой базой. Сразу после запуска войдите в админку и смените пароль в разделе **«Безопасность»**.

## 5. Запуск

Когда домен указывает на сервер (шаг 2):

```bash
cd /opt/dmk
docker compose up -d --build
docker compose ps
```

Оба контейнера — `cms-engine` и `caddy` — должны быть в состоянии `running`. Логи:

```bash
docker compose logs --tail=20 cms-engine
docker compose logs --tail=50 caddy
```

У сайта в логе — `CMS Engine Starter is running` без предупреждения про `CMS_SITE_URL`. У caddy через минуту после запуска — строка `certificate obtained successfully` для `dmk05.ru` и `www.dmk05.ru`.

### Проверка

С вашего компьютера:

```bash
curl -I http://dmk05.ru
curl -I https://www.dmk05.ru
curl -I https://dmk05.ru
```

Первые два ответа — `301` (или `308`) с `location: https://dmk05.ru/...`, третий — `200`. В браузере откройте `https://dmk05.ru`, затем `https://dmk05.ru/admin`, войдите и **смените пароль**. На «Панели» админки не должно быть жёлтого предупреждения.

## 6. Резервные копии

База — один файл; копия делается на ходу, без остановки сайта:

```bash
cd /opt/dmk
docker compose exec -T cms-engine node scripts/backup-db.js
```

Копии появляются в `/opt/dmk/storage/backups/`. Ежедневная копия в 3:00 и удаление копий старше 30 дней:

```bash
crontab -e
```

Добавьте строки:

```cron
0 3 * * * cd /opt/dmk && docker compose exec -T cms-engine node scripts/backup-db.js >> /var/log/dmk-backup.log 2>&1
30 3 * * * find /opt/dmk/storage/backups -name 'cms-*.sqlite' -mtime +30 -delete
```

Копии на том же сервере не спасут, если пропадёт сам сервер. Раз в неделю забирайте свежую копию и папку `public/uploads` к себе:

```bash
scp "root@203.0.113.10:/opt/dmk/storage/backups/cms-*.sqlite" ./backups/
scp -r root@203.0.113.10:/opt/dmk/public/uploads ./backups/uploads
```

(или настройте выгрузку в объектное хранилище Selectel).

**Восстановление** из копии:

```bash
cd /opt/dmk
# Сначала копия текущего состояния — на случай, если восстановили не ту.
docker compose exec -T cms-engine node scripts/backup-db.js /app/storage/backups/before-restore.sqlite
docker compose stop cms-engine
cp storage/backups/cms-ГГГГ-ММ-ДД-ЧЧММ.sqlite storage/cms.sqlite
rm -f storage/cms.sqlite-wal storage/cms.sqlite-shm
docker compose start cms-engine
```

## 7. Обновление сайта

Когда в репозитории появились изменения:

```bash
cd /opt/dmk
docker compose exec -T cms-engine node scripts/backup-db.js
git pull
docker compose up -d --build
docker compose logs --tail=20 cms-engine
```

База, загруженные картинки и сертификаты лежат вне контейнеров и при обновлении не пропадают.

## Если что-то не работает

| Признак | Что проверить |
|---|---|
| Сайт не открывается по домену | `nslookup dmk05.ru` — должен быть IP сервера; `docker compose ps` — оба контейнера `running`; `ufw status` и облачный файрвол Selectel — открыты 80 и 443 |
| `docker compose up` пишет, что порт 80 или 443 занят | На сервере работает другой веб-сервер: `ss -ltnp \| grep -E ':80 \|:443 '`, затем `systemctl disable --now nginx` (или `apache2`) |
| Браузер ругается на сертификат | `docker compose logs caddy` — обычно домен ещё не указывает на сервер или в `SITE_DOMAIN` опечатка. После исправления: `docker compose restart caddy` |
| `502 Bad Gateway` | Сайт не запущен или упал: `docker compose logs --tail=50 cms-engine` |
| Фото не загружается в редакторе | `docker compose logs --tail=50 cms-engine`; лимит — 8 МБ на файл |
| На «Панели» админки предупреждение про адрес сайта | В `.env.local` нет `CMS_SITE_URL`; после правки — `docker compose up -d` |
| После переноса пустой сайт с исходными страницами | База не скопирована в `/opt/dmk/storage/cms.sqlite` до первого запуска: `docker compose stop cms-engine`, скопируйте базу, `rm -f storage/cms.sqlite-wal storage/cms.sqlite-shm`, `docker compose start cms-engine` |
