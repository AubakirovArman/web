# Индекс глубокого анализа

Артефакты по плану `docs/deep-analysis-plan.md`. Статус: 🟢 готово · 🟡 в работе · ⬜ не начато.

## Часть A — текущий MVP
| # | Артефакт | Статус |
|---|---|---|
| A1 | [01-architecture.md](A-current-app/01-architecture.md) | 🟢 |
| A2 | [02-data-model.md](A-current-app/02-data-model.md) | 🟢 |
| A3 | [03-routes-map.md](A-current-app/03-routes-map.md) | 🟢 |
| A4 | [04-user-flows.md](A-current-app/04-user-flows.md) | 🟢 |
| A5 | [05-rules-engine.md](A-current-app/05-rules-engine.md) | 🟢 |
| A6 | [06-checks-engine.md](A-current-app/06-checks-engine.md) | 🟢 |
| A7 | [07-llm-pipeline.md](A-current-app/07-llm-pipeline.md) | 🟢 |
| A8 | [08-reference.md](A-current-app/08-reference.md) | 🟢 |
| A9 | [09-seed-dictionaries.md](A-current-app/09-seed-dictionaries.md) | 🟢 |
| A10 | [10-application-fields.md](A-current-app/10-application-fields.md) | 🟢 |
| A11 | [11-document-types.md](A-current-app/11-document-types.md) | 🟢 |
| A12 | [12-gaps-and-debt.md](A-current-app/12-gaps-and-debt.md) | 🟢 |
| A13 | [13-tests.md](A-current-app/13-tests.md) | 🟢 |

## Часть B — методология ЛС/МИ
| # | Артефакт | Статус |
|---|---|---|
| B1 | [01-corpus-map.md](B-regulatory/01-corpus-map.md) | 🟢 |
| B2 | [02-procedures-ls.md](B-regulatory/02-procedures-ls.md) | 🟢 |
| B3 | [03-procedures-mi.md](B-regulatory/03-procedures-mi.md) | 🟢 |
| B4 | [04-application-forms-fields.md](B-regulatory/04-application-forms-fields.md) | 🟢 |
| B5 | [05-dossier-composition.md](B-regulatory/05-dossier-composition.md) | 🟢 |
| B6 | [06-section-requirements.md](B-regulatory/06-section-requirements.md) | 🟢 |
| B7 | [07-expert-methodology.md](B-regulatory/07-expert-methodology.md) | 🟢 |
| B8 | [08-classifiers.md](B-regulatory/08-classifiers.md) | 🟢 |
| B9 | [09-conditional-matrix.md](B-regulatory/09-conditional-matrix.md) | 🟢 |

## Часть C — gap-анализ и цель
| # | Артефакт | Статус |
|---|---|---|
| C1 | [01-fields-gap.md](C-gap-and-target/01-fields-gap.md) | 🟢 |
| C2 | [02-documents-gap.md](C-gap-and-target/02-documents-gap.md) | 🟢 |
| C3 | [03-checks-gap.md](C-gap-and-target/03-checks-gap.md) | 🟢 |
| C4 | [04-procedures-gap.md](C-gap-and-target/04-procedures-gap.md) | 🟢 |
| C5 | [05-target-requirements.md](C-gap-and-target/05-target-requirements.md) | 🟢 |
| C6 | [06-build-vs-improve.md](C-gap-and-target/06-build-vs-improve.md) | 🟢 |
| C7 | [07-ls-registration-defects.md](C-gap-and-target/07-ls-registration-defects.md) — **что неверно в ЛС/регистрации** | 🟢 |

**Все 4 этапа завершены.** Итог: дорабатывать MVP эволюционно (не переписывать); приоритет наполнения — ЛС/изменения → ЛС/перерег → МИ/регистрация.

---
## Главные находки этапа 1
1. **MVP покрывает только ЛС/регистрацию.** `document_requirement_rules` = 174 строки, все `scope=LS/registration`. Нет МИ, нет перерегистрации, нет внесения изменений на уровне правил документов.
2. **81 поле заявки**, все с usage `condition_for_document_upload` (влияют на состав документов). 22 обязательных.
3. **Reference-БД и runtime-БД — одна физическая база** `ndda_reference_kb:55440`.
4. **Заявки и конфиг хранятся как JSONB** (`runtime_applications.data`, `admin_runtime_config.data`) — слабая нормализация.
5. **3 backup-таблицы** `document_requirement_rules_backup_*` — техдолг.
