# Применимость разделов рег. досье ЛС (по параметрам заявки)

Делает набор обязательных документов **зависимым от параметров заявки**
(product-type, procedure, contains-gmo, bioequivalence, biological-flag и т.д.),
чтобы система требовала только реально применимые разделы для данного профиля,
а не весь ОТД целиком. Применяется и при загрузке (визард), и при проверке (/check).

## Как работает
- `build_applicability_sql.py` — единый источник истины: матрица «код ОТД → условие
  применимости» (предикат condition_json). Генерирует `apply_applicability.sql`.
- SQL проставляет логический предикат (ключ `all`) в `document_requirement_rules.condition_json`,
  сохраняя `requirement_sources`. Резолвер (`lib/document-requirements/ls-registration-resolver.ts`)
  включает правило, только если `upload_required` И `evaluateCondition(condition_json)` = true.

## Покрытие (engine.ts)
`ctdCodeCoversRequired` — раздел считается покрытым, если есть файл на этом коде,
на родителе, на потомке или на соседнем подразделе той же секции 3.2.P/3.2.S.
`evaluateMissingRequiredDocuments` сворачивает пропуски до уровня раздела-карточки.

## Повторное применение
    python3 build_applicability_sql.py
    psql -h 127.0.0.1 -p 55440 -d ndda_reference_kb -f apply_applicability.sql

Бэкап перед применением: таблица `document_requirement_rules_backup_applicability_<ts>`
и SQL-дамп в `backups/applicability_<ts>/`.
