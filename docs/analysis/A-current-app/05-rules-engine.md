# A5. Движок правил (обязательные документы)

Файл: `lib/rules/engine.ts`. Назначение: по параметрам заявки определить список обязательных документов и построить чеклист.

## Главная функция: `getRequiredDocuments(app, rules, availableDocumentTypes)`
Ветвление по домену:

### Ветка ЛС (`param-object-type === 'LS'`)
1. **Admin-configured** (`getAdminConfiguredLsRequiredDocuments`): перебирает `availableDocumentTypes` (из `document_requirement_rules`), для каждого ЛС-досье-типа (`new-ls-*` / `memo-ls-*`) берёт `requiredWhenExpression`/`applicabilityCondition` и проверяет `matchesLsRequirementTriggerExpression(trigger, values, source)`. Если выражение истинно — документ обязателен. Severity и checkIds берутся из типа/требования.
2. **Fallback** (если admin-список пуст): `getLsRequiredDossierDocuments(values)` из `ls-document-checks-mapping.ts` + фильтрация «целого досье».

### Ветка прочее (МИ и др.)
Перебор `rules` (seed `Rule[]`): для каждого правила проверяет `matchesConditions(values, rule.conditions)`, и если выполняется — добавляет `rule.requiredDocuments`.
> ⚠️ Для МИ полноценных правил в БД нет (см. A11) → ветка опирается на seed `rules` (минимальные).

## Условия (`matchesConditions`)
Операторы `RuleCondition`: `equals`, `notEquals`, `notEmpty`, `includes` (по строке/массиву, case-insensitive).
Для ЛС условность сложнее — текстовые trigger-выражения (`requiredWhenExpression`) разбираются `matchesLsRequirementTriggerExpression` (DSL поверх значений полей).

## Чеклист: `buildChecklist(app, rules)`
Для каждого обязательного документа ищет загруженный файл (`findUploadedRequiredFile`) → `ChecklistItem { documentTypeId, required, uploaded, fileId, severityIfMissing, alternativeDocumentTypeId, matchedDocumentTypeId, checks }`.

`fileMatchesRequiredDocument` сопоставляет файл с требуемым типом по `documentTypeId` / альтернативе / (далее по коду раздела досье).

## Связанные функции
- `evaluateMissingDocuments` / `evaluateMissingRequiredDocuments` — формируют находки об отсутствующих документах (используются в `runPreCheck`, A6).
- Спец. «целое досье» (`doc-registration-dossier`, `doc-mi-registration-dossier`) исключается из обязательных (это контейнер, не отдельный документ).

## Источники данных
- ЛС: `document_requirement_rules` (через admin-config) — приоритет; иначе `ls-document-checks-mapping.ts`.
- Прочее: seed `rules` (`lib/data/seed.ts` ← `seed_rules`).

## Наблюдения / gap-сигналы
- **Асимметрия ЛС/МИ:** для ЛС — богатый admin-движок (174 правила, текстовые триггеры); для МИ — только seed-правила (бедно). Целевое решение должно унифицировать.
- Условность ЛС держится на **текстовых выражениях** (`requiredWhenExpression`) — хрупко, нужно валидируемое представление (структурированные условия).
- Два источника для ЛС (admin-config vs mapping-файл) — дублирование; решить единый источник.
- Сопоставление файла с типом документа — по id/альтернативе/коду раздела; качество автосопоставления при загрузке папкой (`dossier-folder-uploader`) — проверить в A7/тестах.
