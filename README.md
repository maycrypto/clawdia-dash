# Clawdia Dashboard

> Matrix-style дашборд для твоего [OpenClaw](https://openclaw.ai) AI-агента.

Мониторь задачи, процессы, скиллы и файлы агента в реальном времени через красивый веб-интерфейс.

## Установка

Скопируй это сообщение и отправь своему OpenClaw-агенту:

```
Установи дашборд Clawdia на сервер:

1. Выполни команду: curl -fsSL https://raw.githubusercontent.com/maycrypto/clawdia-dash/main/install.sh | bash
2. Запиши логин и пароль которые покажет скрипт — они нужны для входа в дашборд.
3. Прочитай файл ~/clawdia-api/API-SPEC.md и создай API-сервер по этой спецификации. Найди где на сервере хранятся задачи, скиллы, процессы, файлы и подключи их. Запусти через pm2.
4. Скинь мне ссылку на дашборд и логин/пароль.
```

Готово. Агент сделает всё сама.

## Что внутри

| Вкладка | Описание |
|---------|----------|
| **Overview** | Статус агента, текущая задача, аптайм, задачи дня |
| **Tasks** | Все задачи (агента + личные) с фильтрами |
| **Processes** | Крон-задачи и повторяемые процессы |
| **Skills** | Системные и кастомные модули с документацией |
| **Files** | Файлы агента (AGENTS.md, MEMORY.md и т.д.) |
| **Guide** | Гайд по использованию дашборда |

## Обновление

Отправь агенту:

```
Обнови дашборд Clawdia:
curl -fsSL https://raw.githubusercontent.com/maycrypto/clawdia-dash/main/App.jsx -o ~/clawdia-dashboard/src/App.jsx
cd ~/clawdia-dashboard && npm run build
Также проверь ~/clawdia-api/API-SPEC.md на новые эндпоинты и добавь если нужно.
```

## Удаление

```
Удали дашборд Clawdia:
pm2 delete clawdia-api
sudo rm -f /etc/nginx/sites-enabled/clawdia /etc/nginx/sites-available/clawdia
sudo systemctl restart nginx
rm -rf ~/clawdia-api ~/clawdia-dashboard
```

## Безопасность

- Basic Auth — дашборд закрыт паролем
- Данные доступны только после авторизации
- Пароль генерируется автоматически при установке

## License

MIT

---

Made by [@maycrypto](https://t.me/maycrypto) for the OpenClaw community
