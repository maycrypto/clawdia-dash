# Clawdia Dashboard — API Specification v2.1

## Задача

Подними API-сервер для дашборда Clawdia. Дашборд уже установлен и ждёт API на порту 3100. Тебе нужно создать сервер, который отдаёт данные о задачах, скиллах, процессах и статусе агента.

**Важно:** ты лучше знаешь свою файловую систему — найди где хранятся данные и парси их. Ниже описан формат ответов, который ожидает дашборд.

---

## Концепция

### Tasks — разовые задачи
Задачи, которые нужно сделать один раз. Могут быть задачи агента ИЛИ личные задачи пользователя. После выполнения закрываются.

Примеры:
- "пофиксить баг дублирования сообщений" (agent)
- "сходить к стоматологу в 18:00" (me)
- "написать пост в канал" (me)
- "создать OSINT realty skill" (agent)

### Processes — повторяемые по расписанию
Автоматические процессы, которые запускаются регулярно по расписанию. Работают постоянно, пока не отключены.

Примеры:
- "CIAN мониторинг каждый день в 10:00 и 20:00" (крон)
- "тренировка через день в 11:00" (расписание)
- "еженедельный ревью памяти" (крон)

---

## Технические требования

- **Порт:** 3100 (слушать на 127.0.0.1, nginx проксирует)
- **Формат:** JSON
- **Фреймворк:** Express.js (Node) или любой другой
- **Запуск:** через pm2 с именем `clawdia-api`
- **Расположение:** `~/clawdia-api/`

---

## Эндпоинты

### GET /api/status

Общая информация об агенте.

```json
{
  "name": "Clawdia",
  "version": "2026.2.15",
  "uptime": "3д 12ч 45м",
  "currentTask": "текущая задача в работе или null",
  "memorySize": "5.3 MB",
  "totalTasks": 12,
  "completedTasks": 7
}
```

- `version` — версия OpenClaw (из `openclaw --version` или `package.json`)
- `uptime` — время работы API-сервера
- `currentTask` — первая задача со статусом `in_progress`, или null
- `memorySize` — размер файлов памяти агента
- `totalTasks` — всего задач
- `completedTasks` — завершённых задач

### GET /api/tasks

Список разовых задач. Поддерживает фильтры: `?status=done`, `?date=2026-02-17`, `?assignee=agent`

```json
{
  "tasks": [
    {
      "id": "task_001",
      "title": "название задачи",
      "status": "open | in_progress | done",
      "date": "2026-02-17",
      "deadline": "2026-02-17T18:00:00+03:00",
      "priority": "high | medium | low",
      "category": "system | apartment | fitness | personal | ...",
      "assignee": "agent | me"
    }
  ]
}
```

Поля:
- `id` — уникальный идентификатор
- `title` — название задачи
- `status` — `open` (новая), `in_progress` (в работе), `done` (завершена)
- `date` — дата задачи (YYYY-MM-DD)
- `deadline` — дата и время дедлайна (ISO 8601) или null если без дедлайна
- `priority` — `high`, `medium`, `low`. По умолчанию `medium`. Пользователь может изменить приоритет в дашборде кликом
- `category` — агент определяет автоматически из контекста задачи. Стандартные категории: `work` (работа), `home` (дом), `health` (здоровье), `fitness` (спорт), `finance` (финансы), `system` (системные задачи агента), `other` (всё остальное)
- `assignee` — кто выполняет: `agent` (агент) или `me` (пользователь)

### PATCH /api/tasks/:id (только для агента)

Обновить задачу. Используется агентом с localhost, не из дашборда.

```json
{ "status": "done" }
```

Ответ: `{ "success": true, "id": "task_001" }`

### POST /api/tasks (только для агента)

Создать задачу. Используется агентом с localhost, не из дашборда.

```json
{
  "title": "сходить к стоматологу",
  "priority": "medium",
  "category": "health",
  "date": "2026-02-18",
  "deadline": "2026-02-18T18:00:00+03:00",
  "assignee": "me"
}
```

Все поля кроме `title` опциональны. Дефолты:
- `priority`: "medium" (пользователь может изменить в дашборде)
- `category`: агент определяет автоматически. Допустимые значения: `work`, `home`, `health`, `fitness`, `finance`, `system`, `other`
- `date`: сегодня
- `deadline`: null
- `assignee`: "agent"

### GET /api/processes

Повторяемые процессы с расписанием. Крон-задачи и регулярные активности.

```json
{
  "processes": [
    {
      "id": "уникальный id",
      "name": "CIAN Monitor (Codex)",
      "type": "cron",
      "schedule": "0 10,20 * * * МСК",
      "status": "running | idle",
      "lastRun": "2026-02-17T10:00:00Z",
      "nextRun": "2026-02-17T20:00:00Z",
      "description": "Сканирование квартир на CIAN через Codex"
    }
  ]
}
```

- `type`: `cron` (автоматический крон) или `schedule` (регулярная активность)
- `status`: `running` = активный, `idle` = отключён
- `lastRun`/`nextRun`: ISO 8601 или null

### GET /api/skills

Все скиллы (системные + кастомные).

```json
{
  "skills": [
    {
      "id": "skill_system_discord",
      "name": "discord",
      "type": "system | custom",
      "active": true,
      "description": "Краткое описание скилла",
      "addedDate": "2026-02-16",
      "usageCount": null
    }
  ]
}
```

- Системные скиллы: обычно в `/usr/lib/node_modules/openclaw/skills/`
- Кастомные: в workspace агента
- Найди оба пути и объедини

### GET /api/skills/:name/content

Полное содержимое SKILL.md для конкретного скилла.

```json
{
  "name": "discord",
  "content": "# Discord\n\nFull markdown content of SKILL.md..."
}
```

Ищи файл в обоих директориях (system и custom).

### GET /api/files

Список файлов агента для просмотра в дашборде. Агент сам определяет какие файлы показывать.

```json
{
  "files": [
    {
      "name": "AGENTS.md",
      "path": "AGENTS.md",
      "category": "core",
      "size": "18.2 KB",
      "modified": "2026-02-17T10:00:00Z"
    }
  ]
}
```

Поля:
- `name` — имя файла для отображения
- `path` — относительный путь от корня workspace (используется для запроса содержимого)
- `category` — группировка: `core` (ядро агента), `notes` (заметки), `learnings` (обучение), `memory` (память), `other` (прочее)
- `size` — человекочитаемый размер
- `modified` — дата последнего изменения (ISO 8601)

Какие файлы показывать:
- **core:** AGENTS.md, MEMORY.md, SOUL.md, TOOLS.md, USER.md, IDENTITY.md, HEARTBEAT.md, SESSION-STATE.md и подобные .md в корне
- **notes:** всё из notes/ (tasks.md, training-log.md и т.д.)
- **learnings:** всё из .learnings/ (ERRORS.md, LEARNINGS.md и т.д.)
- **memory:** всё из memory/ (ежедневные заметки)
- **НЕ показывать:** .credentials/, .venv, node_modules, tmp-файлы, бинарные файлы, скрипты .py, кэш .json

### GET /api/files/content?path=AGENTS.md

Содержимое конкретного файла.

```json
{
  "name": "AGENTS.md",
  "path": "AGENTS.md",
  "content": "# Agent Configuration\n\n..."
}
```

- `path` — тот же путь что в списке файлов
- **Безопасность:** не отдавай файлы из .credentials/ и не выходи за пределы workspace (проверяй path traversal `../`)

### GET /api/health

```json
{ "ok": true }
```

## Безопасность

**КРИТИЧНО:** Дашборд и API доступны на порту 80 без авторизации. Без защиты кто угодно может увидеть твои задачи и инжектить фейковые данные через POST-запросы (prompt injection).

### Обязательно: Basic Auth на nginx

Закрой весь дашборд паролем. Только ты сможешь его открыть.

```bash
# Создай файл паролей (замени USERNAME и PASSWORD)
sudo apt-get install -y apache2-utils
sudo htpasswd -cb /etc/nginx/.htpasswd USERNAME PASSWORD
```

Добавь в nginx-конфиг (`/etc/nginx/sites-available/clawdia`) внутри блока `server`:

```nginx
auth_basic "Clawdia Dashboard";
auth_basic_user_file /etc/nginx/.htpasswd;
```

Полный конфиг:
```nginx
server {
    listen 80;
    server_name YOUR_IP;

    auth_basic "Clawdia Dashboard";
    auth_basic_user_file /etc/nginx/.htpasswd;

    root ~/clawdia-dashboard/dist;
    index index.html;

    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:3100/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

После: `sudo nginx -t && sudo systemctl reload nginx`

Теперь при открытии дашборда браузер попросит логин/пароль. API тоже защищён — без авторизации POST-запросы не пройдут.

---

```bash
cd ~/clawdia-api
pm2 start server.js --name clawdia-api
pm2 save
```

## Автообновление процессов

Крон-задачи хранятся в OpenClaw gateway и недоступны через файлы напрямую. Для отображения процессов в дашборде:

1. Создай файл `~/clawdia-api/cron-cache.json` с текущими крон-задачами в формате из раздела `GET /api/processes`
2. **Настрой автообновление каждые 15 минут** — запускай `cron list`, парси результат и обновляй JSON-файл. Это нужно чтобы `lastRun`/`nextRun` были актуальными
3. API читает процессы из этого файла

### ВАЖНОЕ ПРАВИЛО

**Каждый раз когда ты меняешь, добавляешь или удаляешь крон-задачи — СРАЗУ обнови `~/clawdia-api/cron-cache.json`.** Не жди автообновления. Дашборд показывает данные из этого файла, и если ты его не обновишь — пользователь увидит старые данные.

## Автообновление данных

Дашборд запрашивает все эндпоинты каждые 30 секунд. Убедись, что API читает данные из актуальных файлов при каждом запросе (не кешируй в памяти).

---

## Проверка

После запуска проверь:
```
curl http://localhost:3100/api/status
curl http://localhost:3100/api/tasks
curl http://localhost:3100/api/skills
curl http://localhost:3100/api/processes
```

Дашборд должен показать данные на `http://IP_СЕРВЕРА`
