# Checker routing для требований ЛС-регистрация

Дата обновления: 2026-06-18

## Задача

Для требований типа документа нельзя всегда проверять только один загруженный файл. Часть требований относится:

- к содержимому текущего документа;
- к полям заявления;
- к связанным разделам регистрационного досье;
- к условию применимости;
- к совокупности нескольких файлов одного кода раздела.

Поэтому для LS/registration добавлен слой `checker_routing`.

## Источник истины

Источник runtime-данных: Postgres.

Таблица:

`document_requirement_rules`

Поле:

`condition_json.checker_routing`

Локальные JSON/seed-файлы не должны использоваться как fallback для LS/registration runtime-проверок.

## Что хранится в checker_routing

Для каждого атомарного требования хранится:

- `requirement_id`;
- `requirement_text`;
- `source_point`;
- `check_target`;
- `checker_mode`;
- `linked_application_fields`;
- `missing_application_fields`;
- `related_document_codes`;
- `applicability_gate_required`;
- `aggregate_by_dossier_section_code`;
- `expected_checker_inputs`;
- `decision_logic`.

## Как данные попадают в runtime

Файл:

`/mnt/models/NDDA_AI/8040/web/lib/document-requirements/ls-registration-resolver.ts`

Логика:

1. Resolver читает активные правила LS/registration из Postgres.
2. Для каждого правила строит `DocumentType`.
3. `importedRequirements` формируются из:
   - `document_check_profile`, если он есть;
   - `validation_checks`, если профиля нет;
   - `condition_json.checker_routing.requirements`, если они есть.
4. Требования из `checker_routing` не удаляют старые проверки, а дополняют/заменяют совпадающие по тексту атомарные требования расширенной маршрутизацией.

## Как Gemma получает поля заявки

Файл:

`/mnt/models/NDDA_AI/8040/web/lib/applications/npa-gemma-check/gemma-batch.ts`

В payload `/check` дополнительно передается:

- `applicationFieldValues`;
- `checkerMode`;
- `checkTarget`;
- `linkedApplicationFields`;
- `missingApplicationFields`;
- `relatedDocumentCodes`;
- `expectedCheckerInputs`;
- `applicabilityGateRequired`;
- `aggregateByDossierSectionCode`;
- `decisionLogic`.

## Как подключаются связанные документы

Файл:

`/mnt/models/NDDA_AI/8040/web/lib/applications/npa-gemma-check/utils.ts`

Логика:

1. Файлы группируются по полному коду раздела, например `2.3.P.5.4`.
2. Для требования берутся `relatedDocumentCodes`.
3. Файлы связанных разделов добавляются в тот же candidate.
4. `document-checker` извлекает текст/изображения из всех файлов пакета.
5. Gemma получает единый пакет: текущий раздел + связанные разделы + поля заявления.

## FastAPI Gemma checker

Файл:

`/mnt/models/NDDA_AI/8040/services/gemma-checker/main.py`

Сервис `/check` теперь принимает:

- расширенные поля требования;
- `applicationFieldValues`;
- текстовые чанки;
- страницы изображений.

Prompt прямо объясняет модели:

- использовать поля заявления как источник данных;
- учитывать связанные разделы досье;
- сначала проверять применимость, если требование требует applicability gate;
- считать требование выполненным, если оно подтверждено совокупностью файлов пакета.

## Службы

Веб:

`ndda-web.service`

Gemma checker:

`ndda-gemma-checker.service`

Document parser:

`ndda-document-parser.service`

Если systemd restart недоступен из-за `Interactive authentication required`, текущие пользовательские процессы можно найти так:

```bash
ss -ltnp | rg ':(8040|8051|8052)\b'
ps -eo pid,ppid,user,cmd | rg -i 'next-server|uvicorn|gemma-checker|document-parser'
```

Порты:

- web: `8040`;
- document parser: `8051`;
- Gemma checker: `8052`.

## Проверка после изменений

Проверка web:

```bash
curl -sS http://127.0.0.1:8040/ | head
```

Проверка Gemma checker:

```bash
curl -sS http://127.0.0.1:8052/health
```

Проверка resolver:

```bash
curl -sS -X POST http://127.0.0.1:8040/api/document-requirements/resolve \
  -H 'content-type: application/json' \
  -d '{"values":{"param-object-type":"LS","param-procedure":"registration"}}'
```

## Текущее применённое обновление БД

На 2026-06-18 в Postgres добавлен `checker_routing` для 25 правил, покрывающих 87 атомарных требований активной заявки Kelun/Natrium chloride.

Backup table, созданная перед update:

`document_requirement_rules_backup_checker_routing_2026061818210`

Рабочие файлы аудита:

`/mnt/models/NDDA_AI/8040/experiments/ls-registration-requirement-field-audit/`
