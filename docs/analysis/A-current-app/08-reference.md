# A8. Справочник НПА

В приложении **две параллельные справочные системы** (одна используется в UI, другая — нет).

## 1. Умный справочник `/reference` — ИСПОЛЬЗУЕТСЯ
- Источник: таблицы `reference_experiment_documents` (38) + `reference_experiment_meta`.
- Доступ: `lib/reference/experiment-store.ts` → роуты `/api/reference-experiment` (список, из `list_item`) и `/api/reference-experiment/[id]` (полный `data` с секциями + `intelligence`).
- **DB-only** (после рефакторинга этой сессии): при пустой таблице бросает `REFERENCE_DB_EMPTY` → 404. Файлового fallback нет.
- `intelligence` = ИИ-анализ документа: summary, requirements, document_types, applicant_parameters, dependencies, checks, highlights, key_points — это то, что рендерит карточка документа.
- Наполнение: `npm run reference:db:migrate-experiment` ← `public/reference-intelligence/experiment.json` (генерируется `reference:intelligence:experiment` через vLLM).
- UI: страница со списком (фильтр ЛС/МИ, поиск, метрики), карточка с вкладками (требования/типы/параметры/зависимости/проверки).

## 2. Полнотекстовый справочник `reference_documents` — НЕ в UI
- Таблицы `reference_documents` (68) + `reference_sections` (42 909, `search_vector` tsvector).
- Доступ: `lib/reference/db.ts` → роуты `/api/reference`, `/api/reference/[id]` — **0 потребителей в UI**.
- Также используется `/api/admin/npa-gemma-preview` (берёт документ через `getReferenceDocument`).
- Наполнение: `reference:db:ingest:docx:all` ← `ЛС/` + `МИ/` (docx → `reference-ingest/*`: docx-parser → gemma-formatter → legal-section-builder).

## Сравнение
| | experiment (`/reference`) | reference_documents |
|---|---|---|
| Документов | 38 («ядро MVP») | 68 (полный набор) |
| Секций | в `data` каждого | 42 909 (структур.) |
| `intelligence` (анализ) | ✅ есть | ❌ нет |
| Полнотекстовый поиск | нет (клиентский фильтр) | ✅ tsvector |
| В UI | ✅ да | ❌ нет |

## Прочее
- `lib/reference/rule-sources.ts` — связь требований с источниками (пункты НПА) для админки.
- `lib/reference/index.ts` — реэкспорты.

## Наблюдения / gap-сигналы
- **Дублирование систем:** 38-док. эксперимент с анализом (в UI) vs 68-док. полнотекст (не в UI). Целевое решение — один источник: БД с секциями + анализом + полнотекстом.
- `/api/reference*` — legacy, кандидат на удаление (но `db.ts` нужен npa-gemma-preview).
- `intelligence` генерируется офлайн (эксперимент) — нет инкрементального обновления при изменении НПА.
- `reference_documents` богаче (все 68 + поиск), но без анализа — потенциал объединения.
