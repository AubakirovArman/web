# A1. Архитектура и инфраструктура

## Топология сервисов
```
Браузер
  │  HTTP
  ▼
ndda-8040  (Next.js 16 / React 19, prod, порт 8040, systemd --user)
  │
  ├─► document-parser  (FastAPI/uvicorn, 127.0.0.1:8051) — извлечение текста/OCR-рендер
  └─► gemma-checker    (FastAPI/uvicorn, 127.0.0.1:8052) — проверка требований через LLM
                          │
                          └─► vLLM (89.106.235.4:8000/v1/chat/completions, google/gemma-4-31B-it)

PostgreSQL  ndda_reference_kb @ 127.0.0.1:55440  (общая БД для web и reference)
```

## Сервисы (systemd)

| Сервис | Тип | Порт | WorkingDir | Запуск | Restart |
|---|---|---|---|---|---|
| `ndda-8040.service` | **user** | 8040 | `/mnt/models/NDDA_AI/8040/web` | `npm run start -- -H 0.0.0.0 -p 8040` | always/3s |
| `ndda-document-parser.service` | system (User=arman) | 8051 | `services/document-parser` | `python -m uvicorn main:app --host 127.0.0.1 --port 8051` | always/3s |
| `ndda-gemma-checker.service` | system (User=arman) | 8052 | `services/gemma-checker` | `python -m uvicorn main:app --host 127.0.0.1 --port 8052` | always/3s |

> Веб — **user-служба** (`systemctl --user …`), парсеры — **системные** (`systemctl …`). Все три `enabled` (автозапуск), `Restart=always`.

## Технологический стек (web)
- **Next.js 16.2**, React 19, TypeScript, App Router
- Tailwind CSS 4, shadcn/ui (17 ui-компонентов) + Radix, framer-motion, sonner, next-themes
- БД-доступ: `pg` (Pool); парсинг: `mammoth`, `pdf-parse`, `pdfjs-dist`; `jszip`, `@napi-rs/canvas`
- Формы (установлены, **частично не используются**): `react-hook-form`, `zod`, `@hookform/resolvers`
- Тесты: Playwright (9 e2e)

## Сервисы-парсеры (Python)
- `services/document-parser/main.py` (~437 строк): PDF (PyMuPDF/`fitz`), DOCX (zip+XML), DOC/XLS (LibreOffice), XLSX (openpyxl), картинки/txt. API: `POST /parse`, `POST /jobs`, `GET /jobs/{id}`, `GET /health`. Состояние задач — JSON-файлы в `.runtime/document-parser/jobs/`.
- `services/gemma-checker/main.py` (~358 строк): строит промпт по требованиям, батчит (≤12 req/вызов), мультимодальность (текст+картинки), вызывает vLLM, парсит строгий JSON. Статусы: passed/failed/uncertain/not_applicable/skipped. API: `POST /check`, `POST /jobs`, `GET /jobs/{id}`, `GET /health`.

## Конфигурация (env, `web/.env.local`)
```
VLLM_URL=http://89.106.235.4:8000/v1/chat/completions
VLLM_API_KEY=***
VLLM_MODEL=google/gemma-4-31B-it
DOCUMENT_PARSER_URL=http://127.0.0.1:8051
GEMMA_CHECKER_URL=http://127.0.0.1:8052
```
БД-URL (default): `postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb` (env: `NDDA_DATABASE_URL`/`REFERENCE_DATABASE_URL`/`DATABASE_URL`).

## Деплой (ручной)
```
git push origin main
cd web && npm run build
systemctl --user restart ndda-8040.service
```
Автодеплоя/CI нет (по решению владельца).

## Риски/наблюдения
- vLLM — внешний хост (единая точка отказа для всех LLM-проверок; fallback'и отключены — без сервисов извлечение/проверка падают с ошибкой).
- Парсеры пишут задачи в файлы без очистки (накопление в `.runtime/`).
- API сервисов без аутентификации (ок — только localhost).
- LibreOffice-конвертация DOC/XLS — таймаут 60с, тяжёлая зависимость.
