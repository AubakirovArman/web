# A3. Карта маршрутов (страницы + API)

## Страницы (App Router)
| Маршрут | Роль | Назначение | Источник данных |
|---|---|---|---|
| `/` | все | лендинг «что делает система» | статика |
| `/wizard` | заявитель | мастер заявки: Параметры → Документы → Проверка | `useApplications`, `/api/admin/config?lite=1`, клиентские проверки |
| `/demo` | — | сид эталонной заявки → редирект на эксперта | `/api/seed` |
| `/expert` | эксперт | список заявок, фильтры, метрики | `useApplications` (`/api/applications`) |
| `/expert/[id]` | эксперт | досье + проверки + замечания | `/api/applications/[id]`, `/api/admin/config?lite=1`, серверные задачи |
| `/reference` | все | умный справочник НПА (ЛС/МИ фильтр, поиск) | `/api/reference-experiment*` (из БД) |
| `/admin` → `/admin/document-types` | админ | редирект | — |
| `/admin/document-types` (+`[id]`) | админ | типы документов (постранично из БД) | `/api/admin/document-types*` |
| `/admin/npa` (+`[id]`) | админ | реестр НПА | `/api/admin/npa*` |
| `/admin/requirements` | админ | требования (302, пагинация+поиск) | `/api/admin/requirements` |
| `/admin/fields` | админ | поля заявки (81, пагинация) | `/api/admin/fields` |

Layouts: `app/layout.tsx` (тема, провайдеры Application/Rules, Toaster), `app/admin/layout.tsx` (шапка админки + `AdminNavigation`).

Глобальные провайдеры (в корневом layout): `ApplicationProvider` (грузит сводки заявок на ВСЕХ страницах), `RulesProvider`, `ThemeProvider`.

## API-роуты (24)
### Заявки
| Роут | Методы | Вход → Выход |
|---|---|---|
| `/api/applications` | GET/POST/PUT | GET → **сводки** заявок (без extracted); POST upsert одной; PUT bulk (защищён заголовками) |
| `/api/applications/[id]` | GET/DELETE | GET → полная заявка по id (прямой SQL); DELETE |
| `/api/applications/[id]/extract` | POST | запуск извлечения файлов (→ document-parser) |
| `/api/applications/[id]/check` | POST | серверная проверка |
| `/api/applications/[id]/npa-gemma-check` | POST | LLM-проверка требований НПА (→ gemma-checker) |
| `/api/applications/[id]/findings/[findingId]` | PATCH | изменение статуса находки экспертом |
| `/api/applications/[id]/test-submit` | POST | служебная отправка (тест) |

### Админ
| Роут | Методы | Назначение |
|---|---|---|
| `/api/admin/config` | GET/POST | конфиг; `?lite=1` → только documentTypes+rules (−45%) |
| `/api/admin/document-types` (+`[id]`) | GET/DELETE | постраничный список / деталь / удаление (из `document_requirement_rules`) |
| `/api/admin/npa` (+`[id]`) | GET/… | реестр НПА из admin-config |
| `/api/admin/requirements` | GET | плоский список требований + `pointLabel`/`npaShortName` |
| `/api/admin/fields` | GET | поля LS/registration (81) |
| `/api/admin/npa-gemma-preview` | POST | предпросмотр извлечения требований из НПА (→ vLLM, читает `reference/db`) |

### Справочник / файлы / прочее
| Роут | Методы | Назначение |
|---|---|---|
| `/api/reference-experiment` (+`[id]`) | GET | справочник `/reference` из БД (список / деталь) |
| `/api/reference` (+`[id]`) | GET | НПА из `reference_documents` (**0 потребителей в UI**) |
| `/api/files` (+`[fileId]`) | POST/GET | загрузка/выдача файлов (`runtime-upload-store`) |
| `/api/extract` | POST | разовое извлечение текста (→ parser) |
| `/api/document-requirements/resolve` | POST/GET | разрешение обязательных документов по параметрам |
| `/api/seed` | POST | генерация демо-заявок (сценарии: ideal, missing-gmp, expired-cpp, field-mismatch, bad-docx-format) |

## Наблюдения
- **`/api/reference` и `/api/reference/[id]`** — legacy, не вызываются из UI (кандидат на удаление; но `reference/db.ts` нужен `npa-gemma-preview`).
- `ApplicationProvider` в корне → каждая страница тянет список заявок (оптимизировано до сводок).
- Все API `runtime=nodejs`, большинство `dynamic=force-dynamic`.
- Бизнес-логика вынесена в `lib/` — роуты тонкие.
