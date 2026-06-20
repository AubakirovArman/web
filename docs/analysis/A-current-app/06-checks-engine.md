# A6. Движок проверок

Каталог: `lib/checks/`. Публичный API: `lib/checks/index.ts`.

## Точки входа
- `runPreCheck(app, rules, {scope})` — основной: (1) `evaluateMissingDocuments` (комплектность) + (2) `runChecks` (содержательные) → дедуп по id → `enrichFindings`.
- `runValidation` / `runSubmissionValidation` / `runSectionValidation` — обёртки с режимами `draft|section|submit` и scope `all|params|documents`.
- `getBlockingFindings` / `hasBlockingFindings` — блокирующие = severity `critical`|`serious`.

## Исполнение проверок
`runChecks` → `runChecksWithCatalog` (`engine-runner.ts`) запускает 3 runner'а и фильтрует по scope/правилам:
- `runApplicationAndFileChecks` (general) — поля заявки, файлы, форматы, OCR, расхождения
- `runLsChecks` (`engine-ls-runner.ts`) — ЛС-специфика (+ подпапка `runners/ls/*`: bioequivalence, bioquality, consistency, manufacturing, quality-support, reregistration, variation/*)
- `runMiChecks` (`engine-mi-runner.ts`) — МИ-специфика

Контекст и хелперы: `engine-context.ts`, `engine-file-helpers.ts` (читает `file.extracted`), `engine-utils.ts`, `matrix.ts` (матрица расхождений).

## Реестр проверок (`registry.ts`) — 26 определений
| # | id | method | severity (default) |
|---|---|---|---|
| 1 | required_fields_check | rule | critical |
| 2 | required_document_presence_check | rule | critical |
| 3 | file_format_check | parser | serious |
| 4 | ocr_quality_check | ocr | warning |
| 5 | expected_extracted_fields_check | parser | warning |
| 6 | npa_imported_requirement_check | manual | unknown |
| 7 | gmp_certificate_check | hybrid | serious |
| 8 | cpp_certificate_check | hybrid | warning |
| 9 | document_expiry_check | parser | warning |
| 10 | core_field_consistency_check | hybrid | serious |
| 11 | shelf_life_consistency_check | hybrid | serious |
| 12 | storage_consistency_check | hybrid | serious |
| 13 | translation_length_check | parser | warning |
| 14 | docx_format_check | parser | — |
| 15 | required_sections_check | — | — |
| 16 | black_triangle_check | — | — |
| 17 | pharmacovigilance_contact_check | — | — |
| 18 | bioequivalence_report_check | — | — |
| 19 | bioequivalence_waiver_check | — | — |
| 20 | module3_content_check | — | — |
| 21 | sterility_validation_check | — | — |
| 22 | ls_reregistration_consistency_check | — | — |
| 23 | ls_variation_consistency_check | — | — |
| 24 | mi_registration_consistency_check | — | — |
| 25 | mi_variation_consistency_check | — | — |
| 26 | undocumented_variation_check | — | — |

Методы (`CheckMethod`): `rule` (детерминир.), `parser` (по извлечённому тексту/метаданным), `ocr`, `llm` (смысловая), `manual`, `hybrid`. `enrichFindings` навешивает на находки определения (категория, NPA-ссылки).

## Категории (~20)
Комплектность, Оформление, Файлы и форматы, OCR, Извлечённые данные, Расхождения между документами (×3), Срок действия, GMP/производство, CPP/регистрация, Качество, Структура документа, Стерильность, Перевод, Заявление, Биоэквивалентность (×2), Фармаконадзор (×2), Перерегистрация, Внесение изменений, Медицинское изделие (×2), НПА/ручная проверка.

## Что реально проверяется (по сути)
- **Комплектность** — есть ли обязательные документы (через движок правил).
- **Расхождения** — срок годности / условия хранения / ключевые поля между документами (matrix).
- **Технические** — формат файла, качество OCR/текстового слоя, оформление DOCX (шрифт/размер), срок действия сертификатов (GMP/CPP).
- **Специфика** — биоэквивалентность (generic), модуль 3, стерильность, фармаконадзор, перерег/вариации.
- **НПА-требования** — `npa_imported_requirement_check` (manual/unknown) — наполняется результатами LLM-проверки (A7).

## Наблюдения / gap-сигналы
- Часть проверок (15–26) в реестре есть, но severity/детали не показаны — нужно проверить реализацию runner'ов (заглушки?).
- `npa_imported_requirement_check` = `manual` — т.е. фактическая «умная» проверка идёт через LLM-пайплайн, а реестр лишь регистрирует тип.
- Дублирование логики клиент/сервер (wizard vs expert) — `runPreCheck` вызывается и там, и там.
- Соответствие 26 проверок методологии эксперта (B7) — предмет gap-анализа C3.
