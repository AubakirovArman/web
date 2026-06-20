# A7. LLM-пайплайн (извлечение + проверка требований)

Две связки: (1) извлечение текста из файлов (document-parser), (2) смысловая проверка требований НПА к документам (gemma-checker → vLLM).

## 1. Извлечение текста
`lib/ai/extract.ts` и `lib/document-checker/file-extractor.ts` → HTTP на **document-parser** (`DOCUMENT_PARSER_URL=127.0.0.1:8051`).
- `extractDocumentContent(file)` — текст по страницам, метаданные (`processing`), при необходимости OCR-рендер страниц в PNG (для LLM-зрения).
- `detectDocumentFormat(file)` — pdf/docx/doc/xlsx/image/txt.
- Fallback отключён: без сервиса извлечение PDF/картинок падает с ошибкой.
- Запуск из UI: `/api/applications/[id]/extract`, `/api/extract`.

## 2. Проверка требований НПА: `runNpaGemmaCheck` (`lib/applications/npa-gemma-check/service.ts`)
Оркестратор серверной LLM-проверки. Вызов: `/api/applications/[id]/npa-gemma-check` (поддерживает `dryRun`, `skipCompleted`).

**Параметры (с дефолтами):** maxFiles 200, maxRequirementsPerFile 12, maxTotalRequirements 5000, maxTextCharsPerChunk 45000.

**Поток:**
1. Загружает заявку + admin-config → `loadDocumentTypesForApplication`.
2. `buildCandidates(app, documentTypes, …)` — формирует «кандидатов»: связки {файл(ы) / bundle по коду раздела досье, тип документа, список требований}.
3. Для каждого кандидата → `runDocumentCheckCandidate(candidate)` (`lib/document-checker/run-document-check.ts`):
   - `extractDocumentContent` (если не извлечено)
   - `chunkExtractedContent` (`chunker.ts`, ~45k симв/чанк)
   - `evaluateCandidateChunks` (`gemma-evaluator.ts`) → батчи требований (≤12) → **gemma-checker** (`GEMMA_CHECKER_URL=127.0.0.1:8052`) → vLLM
   - `reduceChunkResults` (`result-reducer.ts`) — сведение результатов по чанкам; `buildSkippedResults` для пропусков
4. Каждый результат → `DocumentRequirementCheckResult { status: passed|failed|uncertain|not_applicable|skipped, evidence, comment, confidence, … }` + `Finding` (если применимо).
5. **Инкрементально сохраняет прогресс** (`upsertApplication` после каждого кандидата) → UI поллит статус.
6. Финальный статус заявки + агрегаты (stats: passed/failed/uncertain/notApplicable/skipped).

## gemma-checker (`services/gemma-checker/main.py`)
- `build_prompt` — русскоязычный промпт: «оцени только по переданному тексту/изображениям, не выдумывай»; правила статусов (passed/failed/uncertain/not_applicable); поля заявления как равноправный источник.
- Батчинг требований (`maxRequirementsPerCall`), мультимодальность (текст + base64-картинки страниц).
- Вызов vLLM (`temperature=0`), парсинг строгого JSON (`clean_json`), нормализация статусов.
- API: `POST /check` (синхронно), `POST /jobs` (фоном).

## npa-gemma-preview (admin)
`/api/admin/npa-gemma-preview` (`lib/admin/npa-gemma-preview/*`) — извлечение требований из НПА через LLM (наполнение реестра требований). Читает `reference/db`.

## Где задаются требования
Требования (`DocumentTypeRequirement`) приходят из типов документов (`importedRequirements`) — т.е. из `document_requirement_rules` (validation_checks/source) и admin-config.

## Наблюдения / gap-сигналы
- Вся «умная» проверка зависит от **внешнего vLLM** (89.106.235.4) — единая точка отказа; нет ретраев/очереди уровня приложения (есть jobs в сервисах через файлы).
- Качество = качество промпта + извлечённого текста; OCR-зависимость для сканов.
- `buildCandidates` группирует по коду раздела досье (bundle) — корректность зависит от автосопоставления файлов (загрузка папкой).
- Нет кэширования результатов LLM по (файл,требование) — повторные прогоны дороги.
- Результаты пишутся в `runtime_applications.data` (JSONB) → раздувание (см. A2).
- Отчёт о качестве LLM-проверки уже существует: `docs/npa-gemma-quality-report.md` (учесть в C3).
