# План разбиения крупных файлов

Цель: удерживать рабочие файлы в районе 300-350 строк, чтобы изменения в заявках, админке и кабинете эксперта не ломали соседнюю логику.

## Этапы

1. `web/app/wizard/page.tsx` — выполнено: страница оставлена координатором, параметры/документы/проверка вынесены в компоненты заявителя.
2. `web/components/expert/expert-application-detail.tsx` — выполнено: экран заявки эксперта разбит на панели, диалоги, форматтеры и review-logic.
3. `web/app/admin/page.tsx` — выполнено: страница оставлена тонким экраном с двумя вкладками `Типы документов` и `НПА и требования`; состояние вынесено в `useAdminPageState`, UI НПА/типов документов вынесен в компоненты, чистая логика — в `lib/admin`.
4. `web/lib/data/ls-document-checks-mapping.ts` — выполнено: массивы вынесены в generated JSON и загружены в Postgres `runtime_dictionaries`; в `.ts` остались типы и helper-функции.
5. `web/lib/data/ls-dossier-document-types-new.ts` — выполнено: массив типов документов вынесен в generated JSON и загружен в Postgres `runtime_dictionaries`; в `.ts` остались типы и экспорт typed seed.
6. `web/lib/checks/engine.ts` — выполнено: монолитный движок проверок разложен на фасад, общий runner, LS/MI runners, file/dossier helpers и LS-подмодули по группам проверок.
7. `web/lib/data/seed.ts` — выполнено: НПА, legacy-типы документов, metadata требований, параметры заявки, профили видимости/обязательности, правила комплектности и дефолтные значения вынесены в `lib/data/generated/seed-*.json` и добавлены в сидер Postgres `runtime_dictionaries`; в `.ts` остался adapter с типами и helper-функциями.
8. `web/scripts/ingest-reference-docx-structured.mjs` — выполнено: CLI-скрипт парсинга DOCX оставлен тонким координатором; поиск источников, конвертация DOC, DOCX-parser, построение юридических секций, Gemma-formatting, запись в справочник Postgres и общие utils вынесены в `web/scripts/reference-ingest/*`.
9. Крупные кандидаты второго прохода — выполнено: `reference/page.tsx`, `lib/dossier/sections.ts`, `api/admin/npa-gemma-preview`, `api/applications/[id]/npa-gemma-check`, `scripts/reference-intelligence-experiment.mjs` и `scripts/ingest-reference-db.mjs` разнесены на UI, service, parser, Gemma, DB и data-модули.

## Правило на будущее

Если файл стабильно превышает 350 строк, сначала выносим UI-компоненты и чистые helper-функции. Бизнес-данные и правила не смешиваем с React-разметкой. Большие справочники храним как runtime-словари в Postgres, а в коде оставляем только типы, seed adapter и функции доступа.
