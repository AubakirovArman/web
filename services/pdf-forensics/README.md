# PDF Forensics — сервис проверки подлинности PDF

Отдельный Python/FastAPI-сервис (изолирован от Next, чтобы не блокировать приложение).

## Что делает
- Метаданные и происхождение (Creator/Producer, даты, XMP, аномалии).
- Структура и правки (инкрементальные обновления = редактирование после создания).
- Цифровая подпись (ЭЦП): наличие, подписант, изменение после подписания.
- Скан vs родной PDF; шрифты (встроенные/нет).
- Встроенные изображения с эвристикой «вставленных» печатей/подписей (альфа, DPI, JPEG-overlay).
- Сравнение печати с эталоном: OpenCV (ORB) + мультимодальная Gemma-4.
- Агрегированная риск-оценка.

## Эндпоинты
- `GET /health`
- `POST /analyze` (multipart: file, use_gemma)
- `POST /compare-stamp` (multipart: file, stamp, use_gemma)

## Запуск (деплой на сервере — /mnt/models/NDDA_AI/8040/pdf-forensics/)
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
    ./venv/bin/uvicorn app:app --host 127.0.0.1 --port 8050

systemd-юнит: `pdf-forensics.service` (user). Gemma читается из web/.env.local (VLLM_*).
Next проксирует через /api/admin/tests/* (за правом admin:tests). PDF_FORENSICS_URL по умолчанию http://127.0.0.1:8050.
