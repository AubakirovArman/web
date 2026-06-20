# A2. Модель данных

БД: **PostgreSQL `ndda_reference_kb` @ 127.0.0.1:55440** (одна база и для web-рантайма, и для справочника).
Схема создаётся в `lib/db/runtime-postgres.ts` (`ensureRuntimeSchema`), reference-пул — `lib/reference/db.ts`.

## Таблицы и наполнение
| Таблица | Строк | Роль |
|---|---|---|
| `runtime_applications` | 2 | заявки (всё тело в JSONB) |
| `admin_runtime_config` | 1 | конфиг админки (JSONB) |
| `document_requirement_rules` | **174** | правила: какие документы нужны (**только LS/registration**) |
| `runtime_dictionaries` | 20 | seed-словари (поля/параметры/типы/правила) |
| `reference_documents` | 68 | НПА для полнотекстового поиска (в UI не используется) |
| `reference_sections` | **42 909** | разделы НПА (tsvector) |
| `reference_experiment_documents` | 38 | справочник `/reference` (intelligence-анализ) |
| `reference_experiment_meta` | 1 | метаданные прогона эксперимента |
| `app_users` | 6 | пользователи/роли |
| `document_requirement_rules_backup_*` | 3×33 | **техдолг — бэкапы** |

## Схемы (ключевые)

### runtime_applications  — заявки
`id, data jsonb, status, object_type, procedure, applicant_user_id, assigned_expert_user_id, created_by_user_id, updated_by_user_id, created_at, updated_at`
- **`data` (JSONB)** = весь `Application`: `values` (поля заявки), `files[]` (с `extracted`, `processing`, `npaRequirementResults`), `checklist[]`, `findings[]`.
- Индексы: status, object_type, procedure, applicant_user, expert_user.
- ⚠️ Слабая нормализация: файлы/находки/чеклист не вынесены в таблицы → тяжёлый JSONB (1 заявка ≈ 1.2 МБ).

### admin_runtime_config — конфиг
`key (pk='default'), data jsonb, …`
- `data` = `{ documentTypes, rules, lsDossierDocumentTypes, npaRegistry }`. documentTypes/lsDossierDocumentTypes на чтении подменяются данными из `document_requirement_rules`.

### document_requirement_rules — правила документов (ядро)
`id, scope_object_type, scope_procedure, doc_code, document_type_id, document_name, row_type, upload_required, source_structure, dossier_variant, module_part, domestic_equivalent, required_document, applicability, show_logic, condition_json jsonb, condition_text, linked_params jsonb, activation_missing_params jsonb, recommended_params_for_validation jsonb, validation_checks jsonb, normalization_status, original_trigger_expression, source_reference, confidence, normalization_notes, active, version, source, …`
- **scope:** все 174 = `LS/registration`.
- **applicability:** `conditional_required` 94 · `always_required` 74 · `needs_new_param` 6.
- **module_part (CTD):** Модуль 3 — 71, Модуль 2 — 41, Модуль 1 — 27, Модуль 4 — 24, Модуль 5 — 11.
- `linked_params` — массив id полей заявки, влияющих на правило; `validation_checks` — текстовые проверки; `source_reference` — пункт НПА.

### reference_documents / reference_sections — НПА
- documents: `id, domain(LS/MI), title, file_name, kind, number, document_date, tags, summary, markdown, raw_text, gemma_status, gemma_model, gemma_json, search_vector`.
- sections: `id, document_id, title, level, anchor, text, formatted_text, heading_number, full_heading, section_type, numbering_path, parent_section_id, search_vector, …` (иерархия + полнотекст).
- ⚠️ Используются только роутами `/api/reference*` и `npa-gemma-preview`; **страница `/reference` их НЕ читает** (читает experiment).

### reference_experiment_documents / _meta — справочник `/reference`
- documents: `id, domain, title, file_name, number, document_date, tags, summary_short, status, sort_order, list_item jsonb (лёгкий), data jsonb (полный: sections+intelligence)`.
- meta: `generated_at, prompt_version, model, note`.
- Источник: миграция из `public/reference-intelligence/experiment.json`.

### runtime_dictionaries — словари (20)
seed-наборы: `seed_base_parameters`, `seed_additional_parameters`, `seed_base_document_types`, `seed_rules`, `seed_npas`, `seed_product_type_labels`, `seed_ls_*_fields`, `seed_mi_*_fields`, `ls_document_requirement_rules`, `ls_dossier_document_types_new`, `ls_variation_checklist_rules`, `applicant_memo_normalized_rules` и др.

## Доменные типы (`lib/types.ts`)
`Application`, `DocumentType`, `DocumentTypeRequirement`, `Parameter`, `Rule`/`RuleCondition`/`RequiredDoc`/`RuleSource`, `UploadedFile`/`FileProcessingMetadata`, `Finding`/`FindingEvidence`/`FindingStatus`, `CheckDefinition`/`CheckMethod`, `ChecklistItem`, `DocumentRequirementCheckResult`, `ReferenceDocument`/`ReferenceSection`.

## Главные выводы для целевого решения
- Перейти от «всё в JSONB» к нормализованным таблицам (files, findings, checks) для масштабирования и аналитики.
- Расширить `document_requirement_rules` scope на **MI** и процедуры **re-registration/variation** (сейчас отсутствуют).
- Удалить backup-таблицы; развести reference-БД и runtime-БД (или явно задокументировать совмещение).
