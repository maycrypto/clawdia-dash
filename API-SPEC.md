# Clawdia Dashboard — API Specification

## Задача

Подними API-сервер для дашборда Clawdia. Дашборд уже установлен и ждёт API на порту 3100. Тебе нужно создать сервер, который отдаёт данные о задачах, скиллах, процессах и статусе агента.

**Важно:** ты лучше знаешь свою файловую систему — найди где хранятся данные и парси их. Ниже описан формат ответов, который ожидает дашборд.

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

Список задач. Поддерживает фильтры: `?status=done`, `?date=2026-02-17`

```json
{
  "tasks": [
    {
      "id": "task_001",
      "title": "название задачи",
      "status": "open | in_progress | done",
      "date": "2026-02-17",
      "priority": "high | medium | low",
      "category": "system | apartment | fitness | ..."
    }
  ]
}
```

### PATCH /api/tasks/:id

Обновить статус задачи. Тело запроса:

```json
{ "status": "done" }
```

Ответ: `{ "success": true, "id": "task_001" }`

### POST /api/tasks

Создать задачу. Тело:

```json
{
  "title": "новая задача",
  "priority": "medium",
  "category": "general",
  "date": "2026-02-17"
}
```

### GET /api/processes

Крон-задачи и фоновые процессы.

```json
{
  "processes": [
    {
      "id": "уникальный id",
      "name": "CIAN Monitor",
      "type": "cron",
      "schedule": "0 10,20 * * * МСК",
      "status": "running | idle",
      "lastRun": "2026-02-17T10:00:00Z",
      "nextRun": "2026-02-17T20:00:00Z",
      "description": "Описание задачи"
    }
  ]
}
```

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

### GET /api/health

```json
{ "ok": true }
```

---

## Запуск

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
