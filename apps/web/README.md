# @canvas/web

React + TypeScript + React Flow приложение для задания canvas.

## Запуск

Из корня репозитория:

```sh
npm ci
npm run dev            # API на 127.0.0.1:4001
npm run dev:web        # web на 127.0.0.1:4173
```

Сборка web:

```sh
npm run build:web
```

Опционально API URL можно переопределить через `VITE_API_BASE_URL`.

## Архитектура DRY

- Все HTTP вызовы идут через единый слой `src/api/http.ts` и endpoint-фасад `src/api/client.ts`.
- Нормализация ошибок (`network/http/parse`) выполняется в одном месте: `src/api/errors.ts`.
- Логика графа и правил связей вынесена в `src/domain/graph.ts`.
- Orchestration сохранения (debounce + очередь + ETag) и генерации (flush + idempotency + polling) находится в `src/state/useCanvasApp.ts`.
- UI-компоненты нод тонкие и получают только подготовленные данные и действия.

## Сценарии

- Ноды: текст, генератор, результат.
- Разрешенные связи: `prompt -> generator` и `generator -> result`.
- Autosave: debounce 500ms + последовательные PUT с `If-Match`.
- Генерация: перед запуском всегда принудительный flush сохранения.
- Поддержан `scenario=failure` для проверки ошибок генерации.
