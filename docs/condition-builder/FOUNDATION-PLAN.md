# Конструктор условий — план «фундамента» (предусловия до UI)

> Основано на мульти-агентном аудите кодовой базы (8 агентов, доказательства файл:строка).
> Вердикт аудита: **GO-WITH-PREREQS**. Движок `evaluateCondition` работает и УЖЕ применяется для
> ЛС-комплектности, но без фиксов конструктор будет массово создавать молча-ложные условия,
> а часть условий в данных НЕ работает уже сейчас.

Цель этого документа: что и в каком файле починить ДО реализации UI-конструктора, по шагам, с проверкой.

---

## Карта того, что есть (факты из аудита)
- Модель условия: `ConditionNode` — `lib/types.ts:95-102` (рассинхронизирован с движком).
- Движок: `evaluateCondition(condition, values)` — `lib/rules/condition-evaluator.ts`. Понимает
  `all/any/not/eq/neq/in/not_empty/empty/contains/manual` (тип в types.ts описывает НЕ всё).
- Применяется в 2 местах: `lib/rules/engine.ts:80` (requiredWhenCondition, ЛС-комплектность) и
  `lib/document-requirements/ls-registration-resolver.ts:142` (condition_json, ЛС/registration).
- Второй (старый) механизм: `RuleCondition[]` + `matchesConditions` — байт-в-байт скопирован в 5 местах
  (`lib/checks/matrix.ts:153`, `lib/checks/engine.ts:124`, `lib/checks/engine-utils.ts:200`,
  `check-step-formatters.ts:4`, `condition-formatters.ts:4`). Строгое `===`, без нормализации.
- Значения заявки: `Application.values: Record<string,string|string[]>` (`lib/types.ts:335`), ключи `param-*`.
- Реестр параметров (attr + options): `lib/data/seed.ts` + `lib/data/generated/seed-*parameters*.json`.

## Принцип контракта (зафиксировать и соблюдать в конструкторе)
- `attr` = **ID параметра** из реестра (`param-*`), который реально есть в `Application.values`.
- `val` (для select) = **строго `options[].value`** параметра. НЕ label, НЕ внутренний код нормализатора.
- Операторы зависят от типа параметра (см. Фаза 2.3).

---

## ФАЗА 0. Чекпойнт и бэкап
- [ ] git-commit текущего состояния + tag `checkpoint-before-condition-foundation`.
- [ ] `pg_dump` затрагиваемых данных: `document_requirement_rules` + `admin_runtime_config` +
      seed-файлы параметров (на случай миграции значений).

---

## ФАЗА 1. Контракт данных (честность условий) — САМОЕ ВАЖНОЕ
Без неё любой конструктор бесполезен: значения не совпадают, условия молча ложны.

### 1.1. Дедуп реестра параметров
- Проблема: `param-aseptic` определён дважды (select yes/no и boolean без options); `seed.ts:40`
  конкатенирует без дедупа → `.find` берёт первый.
- Файлы: `lib/data/seed.ts`, `lib/data/generated/seed-base-parameters.json`, `seed-additional-parameters.json`.
- Сделать: дедуп по `id` с выбором канонического определения (приоритет — с `options`); добавить
  invariant-проверку «нет дублей id».
- Проверка: скрипт — нет двух параметров с одинаковым `id`.

### 1.2. Единый канонический словарь значений (КРИТИЧНО)
- Проблема (подтверждена на данных): правила содержат значения, которых нет в options/values:
  - `param-dossier-type`: правила = `ctd_foreign`(535)/`domestic_kz`(197); форма пишет `ctd`/`domestic`.
    Нормализатор (`condition-evaluator.ts:184-196`) маппит `ctd→ctd` (НЕ `ctd_foreign`) → eq всегда false.
  - `param-product-type`: правила = `bioanalog`(194)/`advanced_therapy`/`well_established`/`biotechnological`/
    `immunological`; options = `biosimilar`/`advanced-therapy`/`well-established` (дефис vs подчёркивание,
    `biotechnological`/`immunological` нет вовсе).
- Решение по умолчанию (рекомендация): **одно каноническое множество значений** на параметр; привести к нему:
  (а) `options[].value` в seed, (б) значение, которое пишет визард, (в) `condition_json` в правилах,
  (г) `normalizeComparable`. Дефис→подчёркивание унифицировать в одну сторону. Добавить недостающие опции
  (`biotechnological`/`immunological`).
- Файлы: seed-параметры; `lib/rules/condition-evaluator.ts:175-196` (normalizeComparable); данные
  `lib/data/generated/ls-registration-document-rules.json` и/или БД `document_requirement_rules.condition_json`.
- Миграция данных: одноразовый скрипт «старое значение в правилах → каноническое».
- Проверка (юнит-тесты): `evaluateCondition({eq:['param-dossier-type', <канон_иностранного>]}, {'param-dossier-type':'ctd'})`
  даёт ожидаемый результат; то же для product-type по всем значениям.

### 1.3. Чистка заведомо-мёртвых условий
- `1.2.4`: условие на `param-trademark-required` — параметра нет в реестре → документ НИКОГДА не обязателен.
- 17 правил с sentinel `__none__` — условия-заглушки, всегда ложны.
- Плейсхолдеры в правилах: `param-id-or-path`, `param-dosage-form.category='solid_oral'`,
  `param-submitter-is-representative` — нет в реестре/values.
- Сделать: по каждому решить — (1) добавить параметр в реестр, (2) исправить attr/val на существующий,
  (3) удалить условие (сделать «всегда»/убрать). Зафиксировать решения списком.
- Файлы: данные правил (`ls-registration-document-rules.json` / `document_requirement_rules`),
  при необходимости `apply_applicability.sql`.
- Проверка: 0 условий ссылается на attr вне реестра параметров (линт-скрипт).

### 1.4. Линт-валидатор данных (постоянный)
- Скрипт `scripts/lint-conditions.mjs`: пройти по всем `condition_json`/`requiredWhenCondition`/link-условиям и
  проверить: каждый `attr` ∈ реестр параметров; каждый `val` ∈ `options[].value` (для select);
  нет sentinel `__none__`. Вывести список нарушений. Гонять в CI/перед коммитом.

---

## ФАЗА 2. Движок условий (унификация и расширение)

### 2.1. Синхронизировать тип `ConditionNode` с движком
- Проблема: `lib/types.ts:95-102` не описывает `not/empty/manual` и объектную форму `contains`
  (`{contains:{param,where:{field,eq?,value?}}}`), которые реально исполняются (`condition-evaluator.ts:24,30,31,60-80`).
- Сделать: расширить union: `{not:ConditionNode[]}`, `{empty:[string]}`, `{manual:string|true}`,
  объектная `contains`. Конструктор ДОЛЖЕН сохранять неизвестные/расширенные узлы без потери при ре-сериализации.
- Файл: `lib/types.ts`.
- Проверка: типы компилируются; round-trip существующих условий не теряет узлы.

### 2.2. Единый компаратор и устранение дублей `matchesConditions`
- Проблема: 5 байт-в-байт копий `matchesConditions`; строгое `===` без нормализации даёт ДРУГОЙ результат,
  чем `evaluateCondition` на тех же values (булевы `'yes'/'no'` vs `'True'`; `'KZ'` vs `'kz'`).
- Сделать (минимум): вынести `matchesConditions` в один модуль, заменить 5 импортов.
- Решение по направлению (рекомендация): вынести **единый нормализующий компаратор** и использовать его и в
  `evaluateCondition`, и в `RuleCondition`-ветке; ИЛИ зафиксировать, что конструктор пишет только в места,
  читаемые `evaluateCondition` (ЛС-комплектность/резолвер), а для MI/проверок/визарда/эксперта — отдельная
  задача (см. Фаза 5). На первом этапе — второй вариант + конвертер при необходимости.
- Файлы: `lib/checks/*`, `lib/rules/engine.ts`, `*-formatters.ts`.

### 2.3. Типобезопасные операторы и хранение значений
- Boolean-коэрция: `normalizeComparable` (`condition-evaluator.ts:175-176`) приводит `'1'/'0'/'no'/'да'` к boolean
  для ЛЮБОГО параметра → ломает числа и коды стран (`'NO'`=Норвегия→false). Сделать: коэрсить только при
  `Parameter.type==='boolean'`.
- Массивы/таблицы: multiselect и таблицы (`param-administration-routes='["oral"]'` и т.п.) хранятся как
  JSON-СТРОКИ; `eq/in/neq` их не парсят → всегда false. Сделать: либо парсить JSON-массив в `equalsValue/valueIn`,
  либо в конструкторе для таких параметров разрешать ТОЛЬКО `contains{where}`/`not_empty`. Рекомендация — оба:
  парсинг + ограничение операторов в UI.
- `neq` при пустом поле = false (асимметрия): показывать в UI предупреждение/предлагать `any:[{empty},{neq}]`.
- Файлы: `lib/rules/condition-evaluator.ts`; контракт операторов — в конфиг конструктора (Фаза 6).
- Проверка: юнит-тесты на number/код-страны/multiselect/пустое поле.

---

## ФАЗА 3. Путь ЗАПИСИ предиката + кэш

### 3.1. Сохранение `condition_json`/`requiredWhenCondition`
- Проблема: `updateAdminDocumentTypeDetail` (`server-store.ts:380-391`) НЕ пишет `condition_json` (только
  `condition_text`); `createAdminDocumentType` кладёт фиксированный `condition_json` без предиката. Конструктор
  отправит предикат — он будет молча отброшен.
- Сделать: вносить предикат в `condition_json` верхнего уровня в `updateAdminDocumentTypeDetail` (merge `...cj`,
  как делает `updateCheckProfileRequirements`) и в `INSERT` `createAdminDocumentType`. Форма — та, что читает
  `pickConditionPredicate` (`server-store.ts:815,856`).
- Файлы: `lib/admin/server-store.ts`.
- Проверка: сохранить условие через API → прочитать detail → предикат на месте; следующая проверка/комплектность
  его учитывает.

### 3.2. Инвалидация кэша
- Проблема: TTL=2 мин (`server-store.ts:15`); `invalidateLsDocTypeCache()` зовётся только в
  `createAdminDocumentType:452` и `writeAdminRuntimeConfig:1076`. `update*`/`deactivate`/`updateCheckProfileRequirements`
  НЕ инвалидируют → правки условий стейлятся до 2 мин.
- Сделать: добавить `invalidateLsDocTypeCache()` в конец `updateAdminDocumentTypeDetail`,
  `updateCheckProfileRequirements`, `deactivateAdminDocumentType` и нового пути записи предиката.
- Проверка: правка условия видна сразу (без 2-минутной задержки).

### 3.3. Синхронизация `condition_text` ↔ `condition_json`
- Проблема: предикат приоритетнее текста (`engine.ts:79-85`); если конструктор пишет предикат, а старый текст
  расходится — админ видит устаревший текст. Сделать: при записи предиката обновлять текстовое превью
  (человекочитаемая строка из конструктора) или депрекейтить текстовое поле.

---

## ФАЗА 4. Место (б): условие привязки требования (link.condition)
- Проблема: `applicabilityCondition: string` (`types.ts:44`) уходит в LLM ТЕКСТОМ (`gemma-batch.ts:49`);
  `evaluateCondition` к нему не применяется. `ConditionNode`-объект там даст `[object Object]`.
- Сделать: ввести отдельное структурное поле `applicabilityConditionNode: ConditionNode` (в требовании и в
  `AdminNpaRequirement`); добавить **pre-gate** `evaluateCondition(node, app.values)` ПЕРЕД отправкой требования
  в Gemma (в `npa-gemma-check`/`evaluateBatch`) → если false, статус `not_applicable`, в LLM не уходит.
  Текстовый `applicabilityCondition` оставить как подсказку LLM.
- Файлы: `lib/types.ts`, `lib/admin/server-store.ts` (AdminNpaRequirement + bind*), `lib/checks/*` (npa-gemma),
  `lib/admin/npa-record-builder.ts`.
- Проверка: требование с условием `ls_type=generic` не уходит в проверку у оригинального препарата.

---

## ФАЗА 5. Область ЛС/МИ (scope)
- Проблема: резолвер и admin-store жёстко `scope='LS'/'registration'`
  (`ls-registration-resolver.ts:130-131`, `server-store.ts:388-389`); 0 правил `scope='MI'`. МИ-комплектность —
  через старый `RuleCondition[]`; содержание МИ — хардкод (`engine-mi-runner.ts`).
- Решение для первого этапа (рекомендация): **ограничить конструктор LS/registration** в UI + явное
  предупреждение «для МИ/иных процедур условие пока не действует». Обобщение scope (параметризовать
  object_type/procedure в резолвере и admin-store; перевести МИ на `evaluateCondition`) — отдельная задача.
- Файлы (если обобщать): `ls-registration-resolver.ts`, `server-store.ts`, `lib/checks/engine.ts`.

---

## ФАЗА 6. Конфиг конструктора + тесты (готовность к UI)
- `lib/admin/condition-attributes.ts` — выборка из реестра параметров: `{key,label,type,options:[{value,label}]}`,
  + допустимые операторы по типу: select→`eq/in/neq`; boolean→да/нет (eq true/false); multiselect/таблица→
  `contains{where}`/`not_empty`/`empty`; text→`contains/eq`; number→`eq/neq` (без boolean-коэрции).
- Юнит-тесты `evaluateCondition` на канонических парах (dossier-type, product-type, boolean, multiselect, neq-пусто).
- Сквозная сверка: заявка с атрибутом A vs B → разный список обязательных документов и разный набор требований.

---

## ФАЗА 7. Сам UI-конструктор (ПОСЛЕ фундамента)
- Компонент `<ConditionBuilder>` (строки attr·оператор·значение, И/ИЛИ, живое превью, «всегда»).
- value-aware: attr только из реестра, val только из options, операторы по типу (Фаза 6).
- Встроить: вкладка «Обязательность в досье» (doc_applicability) + условие на привязке требования (link.condition).
- Серверный валидатор сохранения (attr∈реестр, val∈options, нет `__none__`).

---

## Рекомендуемый порядок исполнения
1 → 2 → 3 → 4 → 5 → 6 → 7. **Фазы 1–3 — обязательный минимум** (без них даже существующие условия частично
ложны). Фаза 4 (link.condition) и Фаза 5 (МИ) можно делать после первого рабочего цикла ЛС-комплектности.

## Решения, которые нужно подтвердить (до старта)
- Направление унификации значений (Фаза 1.2): менять seed-опции под коды правил ИЛИ коды правил под seed?
  (Рекомендация: единый канонический словарь, миграция данных правил под него.)
- Унификация двух механизмов (Фаза 2.2): мигрировать всех на `evaluateCondition` ИЛИ конвертер + ограничение
  конструктора местами на `evaluateCondition`? (Рекомендация: на первом этапе ограничить, мигрировать поэтапно.)
- МИ (Фаза 5): ограничить конструктор ЛС сейчас ИЛИ сразу обобщать scope? (Рекомендация: ограничить, обобщить потом.)
