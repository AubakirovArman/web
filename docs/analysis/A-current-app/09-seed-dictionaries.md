# A9. Seed-данные и словари

Источник конфигурации «по умолчанию»: таблица `runtime_dictionaries` (20 записей) + сборка в `lib/data/seed.ts`. Загрузка: `npm run admin:db:seed-dictionaries`.

## `lib/data/seed.ts` — сборка
| Экспорт | Источник | Что |
|---|---|---|
| `npas` | `seed_npas` | базовый список НПА |
| `documentTypes` | `seed_base_document_types` (+metadata) | базовые типы документов |
| `parameters` | `seed_base_parameters` + `seed_additional_parameters` | поля формы (81) |
| `productTypeLabels` | `seed_product_type_labels` | подписи типов препаратов |
| `applicationFormProfiles` | `seed_ls_*` / `seed_mi_*` fields | профили форм (base/required/procedure поля по ObjectType×Procedure) |
| `rules` | `seed_rules` | базовые правила (для не-ЛС ветки движка) |
| `defaultApplicationValues` | `seed_default_application_values` | значения заявки по умолчанию |

## Словари в БД (по размеру)
| key | размер | Роль |
|---|---|---|
| `ls_variation_checklist_rules` | 437 kB | чек-лист вариаций ЛС (внесение изменений) |
| `ls_registration_document_rules_raw` | 136 kB | сырые правила документов ЛС (до нормализации) |
| `applicant_memo_normalized_rules` | 133 kB | нормализованные правила «памятки заявителя» |
| `ls_document_requirement_rules` | 109 kB | правила документов ЛС |
| `ls_dossier_document_types_new` | 65 kB | новые типы документов досье ЛС |
| `seed_document_type_metadata` | 8.7 kB | метаданные типов |
| `seed_additional_parameters` | 6.4 kB | доп. поля |
| `seed_rules`, `seed_base_parameters`, `seed_base_document_types`, `seed_default_application_values`, `seed_ls_base_fields` | < 5 kB | базовые |
| `seed_ls_procedure_fields`, `seed_ls_required_fields`, `seed_mi_*_fields` | мелкие | профили полей ЛС/МИ |

## Профили форм (`applicationFormProfiles`)
`Record<ObjectType, { baseFields, requiredFields[procedure], procedureFields[procedure] }>` — определяет, какие поля показывать/обязательны для каждой пары ObjectType×Procedure. Есть и ЛС, и МИ профили (`seed_ls_*` / `seed_mi_*`).

## Наблюдения / gap-сигналы
- **Несколько слоёв правил ЛС:** `ls_registration_document_rules_raw` (сырые) → `ls_document_requirement_rules`/`applicant_memo_normalized_rules` (нормализованные) → таблица `document_requirement_rules` (рабочая). Нужно понять каноничный источник и пайплайн нормализации.
- **`ls_variation_checklist_rules` (437 kB)** — крупнейший словарь, для вариаций ЛС; но в `document_requirement_rules` процедуры «изменения» нет → словарь, похоже, не задействован движком документов. Проверить.
- Профили форм есть для МИ (`seed_mi_*`), но правил документов МИ нет → форма для МИ покажется, а документы — нет.
- Словари — снимок; нет процесса синхронизации с первоисточником НПА.
