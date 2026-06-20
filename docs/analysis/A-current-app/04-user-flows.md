# A4. Потоки по ролям

## Заявитель — `/wizard` (3 шага)
Состояние через `useApplications` (контекст, БД через `/api/applications`). При монтировании грузит `/api/admin/config?lite=1` → `documentTypes` + `rules`.

1. **Параметры** (`params-step.tsx`) — форма 81 поля, разбитая на под-шаги (`parameter-groups.ts`). Видимость полей условная. `updateValues` сохраняет черновик (`saveServerApplication`).
2. **Документы** (`docs-step.tsx`) — список обязательных документов из `getRequiredDocuments(app.values)` (движок правил, A5); загрузка файлов (`document-uploader.tsx`, `dossier-folder-uploader.tsx`) → `/api/files`, извлечение через document-parser; статус извлечения на карточке.
3. **Проверка** (`check-step.tsx`) — `runPreCheck(app, rules)` (клиентские проверки, A6): комплектность + расхождения; показ находок (`SeverityBadge`), блокирующие через `getBlockingFindings`. `submitApplication` → статус `submitted`.

Особенность: при открытии существующего черновика wizard догружает полную заявку по id (extracted-данные).

## Эксперт — `/expert` (список) и `/expert/[id]` (детали)
**Список:** таблица заявок (сводки, без extracted), фильтры статуса/результата (shadcn Select), кликабельные метрик-карточки, severity-бейджи. Сид демо: `/api/seed` (сценарии ideal, missing-gmp, expired-cpp, field-mismatch, bad-docx-format).

**Детали (`expert-application-detail.tsx`):**
- Догружает полную заявку по id; грузит `/api/admin/config?lite=1`.
- Вкладки: **Документы и проверки** / **Параметры заявки** / **Регистрационное досье** / **Замечания эксперту**.
- Серверные задачи (с прогресс-картой `ServerTaskCard`, поллинг 3с):
  - `/api/applications/[id]/extract` → document-parser (извлечь текст файлов)
  - `/api/applications/[id]/check` → серверная проверка
  - `/api/applications/[id]/npa-gemma-check` → LLM-проверка требований НПА (A7)
- Работа с находками: принять/отклонить/ложноположительное → `/api/applications/[id]/findings/[findingId]` (PATCH). Формирование запроса заявителю из находок.
- Статусы заявки: draft → submitted → checking → checked → expert-review.

## Админ — `/admin/*`
4 раздела (`AdminNavigation`):
- **Типы документов** — постранично из `document_requirement_rules` (серверная пагинация), карточка типа (`document-type-detail-panel`), правила/проверки/источники.
- **НПА** — реестр (`npa-registry-panel`), предпросмотр извлечения требований из НПА через LLM (`npa-gemma-preview-dialog` → `/api/admin/npa-gemma-preview`).
- **Требования** — плоский список (302), пагинация+поиск, `pointLabel` (НПА+пункт).
- **Поля** — 81 поле, пагинация, связь с документами.

## Карта статусов и переходов
```
draft ──submit──► submitted ──(expert)──► checking ──► checked ──► expert-review
                                   ▲ extract/check/npa-gemma запускают checking
```

## Наблюдения
- Проверки выполняются и на клиенте (wizard, `runPreCheck`), и на сервере (expert, `/check`, `/npa-gemma-check`) — двойная логика, нужно свести.
- Роли не разграничены доступом (нет auth) — любой видит все зоны.
- Вкладка «Параметры» wizard — условная видимость на клиенте; сверить с условностью форм НПА (B4).
