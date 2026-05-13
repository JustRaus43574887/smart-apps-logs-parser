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
