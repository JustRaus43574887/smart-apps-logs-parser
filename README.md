# Express Log Parser

Веб-приложение для удобного просмотра и анализа логов в формате JSONL (JSON Lines). Позволяет загружать лог-файлы, фильтровать записи по типам и искать совпадения по всему контенту.

## Возможности

- 📁 **Загрузка JSONL файлов** — поддержка форматов `.jsonl`, `.json`, `.txt`
- 🔍 **Поиск** — поиск по всем полям логов, включая ключи и значения в payload
- 🔐 **Два режима поиска** — нестрогий (частичное совпадение) и строгий (точное совпадение)
- 🏷️ **Фильтрация по типам** — фильтруйте логи по типам событий:
  - Device Info
  - REST Event
  - WebSocket Event
  - Browser Log
  - SmartApp Event
  - Client Log
  - Client State

### Требования
- Node.js 16+
- npm или yarn

### Шаги установки

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd express-log-parser
```

2. Установите зависимости:
```bash
npm install
# или
yarn install
```

3. Перейдите в директорию веб-приложения:
```bash
cd apps/web
```

4. Установите зависимости приложения:
```bash
npm install
# или
yarn install
```

## Запуск

### Режим разработки

Из директории `apps/web`:
```bash
npm run dev
# или
yarn dev
```

Приложение запустится на `http://localhost:5173`

### Сборка для продакшена

Из директории `apps/web`:
```bash
npm run build
# или
yarn build
```

Собранные файлы будут в папке `dist/`

## Развертывание на VPS

### Требования к серверу
- **OS**: Ubuntu 20.04+ или CentOS 7+
- **Node.js**: 16+ (опционально, если используется статическое хостирование)
- **Nginx** или Apache (для проксирования)
- **Минимум**: 1 GB RAM, 10 GB дискового пространства

### Вариант 1: Статическое хостирование (рекомендуется)

#### Шаг 1: Собрите приложение локально
На вашем локальном компьютере в папке `apps/web`:
```bash
npm run build
```

#### Шаг 2: Загрузите файлы на VPS
```bash
scp -r dist/* user@your_vps_ip:/var/www/log-parser/
```

#### Шаг 3: Настройте Nginx

Создайте конфиг-файл `/etc/nginx/sites-available/log-parser`:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Замените на ваш домен

    root /var/www/log-parser;
    index index.html;

    # Обслуживание статических файлов
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Перенаправление на index.html для SPA
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Сжатие ответов
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript image/svg+xml;
}
```

#### Шаг 4: Включите конфиг и перезагрузите Nginx
```bash
sudo ln -s /etc/nginx/sites-available/log-parser /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Шаг 5: Настройте SSL (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Вариант 2: Развертывание с Node.js сервером

Если вам нужен Node.js для дополнительного функционала:

#### Шаг 1: Установите Node.js на VPS
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Шаг 2: Клонируйте репозиторий на VPS
```bash
cd /var/www
git clone https://github.com/your-username/express-log-parser.git
cd express-log-parser
```

#### Шаг 3: Установите зависимости и соберите приложение
```bash
npm install
cd apps/web
npm install
npm run build
cd /var/www/express-log-parser
```

#### Шаг 4: Установите PM2 для управления приложением
```bash
sudo npm install -g pm2
pm2 start "npm run preview --prefix apps/web" --name "log-parser"
pm2 startup
pm2 save
```

#### Шаг 5: Настройте Nginx как reverse proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Вариант 3: Docker развертывание

Создайте `Dockerfile` в корне проекта:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY . .

RUN npm install
RUN cd apps/web && npm install && npm run build

EXPOSE 4173

CMD ["npm", "run", "preview", "--prefix", "apps/web"]
```

Постройте образ:
```bash
docker build -t log-parser .
```

Запустите контейнер:
```bash
docker run -p 80:4173 log-parser
```

### Обновление приложения

Чтобы обновить приложение на VPS:

```bash
# Локально
npm run build
scp -r dist/* user@your_vps_ip:/var/www/log-parser/

# На VPS
sudo systemctl restart nginx
```

### Мониторинг и логи

Для просмотра логов Nginx:
```bash
sudo tail -f /var/log/nginx/error.log
```

Для PM2:
```bash
pm2 logs log-parser
pm2 monit
```

### Обеспечение безопасности

1. **Брандмауэр**: Открыть порты 80 и 443
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Регулярные обновления**:
```bash
sudo apt-get update
sudo apt-get upgrade
```

3. **Резервные копии**: Регулярно создавайте резервные копии папки `/var/www/log-parser`

## Формат JSONL

Файл должен содержать одну валидную JSON-запись на строку:

```jsonl
{"timestamp":"1677858452","type":"device_info","message":"Platform build version","status":"info","payload":{"huid":"bbc0b045-c3a7-5bc8-8c18-122c11b8b6c8","platform":{"type":"android","version":"3.65.20+debug"}}}
{"timestamp":"1677858453","type":"rest_event","message":"GET /api/v1","status":"success","payload":{"request":{"url":"https://example.com","method":"GET","headers":{}},"response":{"status":200}}}
```

## Технологический стек

### Frontend
- **React 18** — UI библиотека
- **TypeScript** — типизированный JavaScript
- **Ant Design** — компоненты пользовательского интерфейса
- **Vite** — сборщик проекта

### Парсинг
- Собственный JSONL парсер с валидацией

Преобразует строку JSONL в массив объектов LogEntry.

### Обработка ошибок

Парсер выбрасывает ошибки с информацией о строке и причиной ошибки:

```typescript
try {
  const entries = JSONLinesParser.parse(content);
} catch (error) {
  console.error(error.message); // "Ошибка парсинга на строке 5: invalid JSON"
}
```

## Примеры лог-файлов

### Device Info
```json
{"timestamp":"1677858452","type":"device_info","message":"Platform build version","status":"info","payload":{"huid":"uuid-123","locale":"ru","platform":{"type":"android","version":"3.65.20+debug"}}}
```

### REST Event
```json
{"timestamp":"1677858453","type":"rest_event","message":"GET /api/v1/users","status":"success","payload":{"request":{"url":"https://api.example.com/users","method":"GET","headers":{"Authorization":"Bearer token"}},"response":{"status":200,"headers":{"Content-Type":"application/json"}}}}
```

### Browser Log
```json
{"timestamp":"1677858454","type":"browser_log","message":"Console error: Cannot read property 'map' of undefined","status":"error","payload":{"stack":"TypeError: Cannot read property 'map' of undefined\n  at Array.js:15:23"}}
```

## Автор

Создано для удобного анализа логов приложений.
