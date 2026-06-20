# A10. Поля заявки (параметры)

Источник: `/api/admin/fields` (LS/registration), seed-словари `runtime_dictionaries` (`seed_base_parameters`, `seed_additional_parameters`, `seed_ls_*_fields`), типы `Parameter` в `lib/types.ts`.

## Сводка
- **Всего полей: 81.** Обязательных: **22**.
- Все поля имеют usage **`condition_for_document_upload`** — т.е. каждое потенциально влияет на состав требуемых документов (через `linked_params` в правилах).
- По типам: text 26 · textarea 21 · **select 19** · boolean 9 · date 5 · multiselect 1.
- Видимость на шаге «Параметры» в wizard управляется группами под-шагов (`parameter-groups.ts`) и условиями.

## Ключевые управляющие поля (триггеры)
| Поле | Тип | Опции | Влияние |
|---|---|---|---|
| `param-object-type` | select | ЛС / МИ | домен (но правила есть только для ЛС) |
| `param-procedure` | select | регистрация / перерег / изменения | процедура (правила — только регистрация) |
| `param-product-type` | select | original / generic / hybrid / biological / biosimilar / vaccine / herbal / homeopathic / radiopharmaceutical / orphan / blood / well-established / advanced-therapy | **главный условный драйвер документов** |
| `param-dossier-type` | select | структура досье (Прил.2/Прил.3 CTD) | вариант досье |
| `param-manufacturer-country` | select | страна | GMP/CPP-логика |
| `param-bioequivalence-required` | select | да/нет | отчёт БЭ (generic) |
| `param-new-api-flag` | boolean | — | мастер-файл АФС |
| `param-biological-flag` / `param-immunobiological-flag` | boolean | — | биологические требования |
| `param-orphan-status` (+8 орфанных полей) | boolean/… | — | орфанный трек |
| `param-who-prequalification` | boolean | — | упрощения |
| `param-transfer-enabled` | boolean | — | трансфер технологии |

## Группы полей (по смыслу)
1. **Маршрутизация:** object-type, procedure, dossier-type, expertise-mode, product-type, manufacturer-country.
2. **Идентификация препарата:** trade-name (kz/ru/en), export-trade-names, inn (kz/ru/en + comments), atc (enabled/code/name/comments), dosage (form/amount/unit), administration-routes (multiselect), composition-table, packaging, api-name.
3. **Характеристики/хранение:** shelf-life, storage-conditions, transport-conditions, use-period-after-opening/dissolution (amount+unit), sterile/aseptic, dispensing(+comment).
4. **Производство:** manufacturer(+address/role/permits/contact), manufacturers, production-sites, transfer(enabled/site), qc-lab (name/address/country/phone/email).
5. **Регуляторика/статусы:** product-type, biological/immunobiological flags, new-api-flag, reference-product, contains-gmo, human-animal-origin, foreign-registrations, patent-trademark, who-prequalification, additional-monitoring, bioequivalence-required, clinical-studies, lab-testing-required.
6. **Орфанный блок:** orphan-status, orphan-status-state, orphan-assigned-date, orphan-registration-number, orphan-refusal-flag/date, orphan-decision-number, orphan-withdrawal-date.
7. **Заявитель/оплата:** applicant, holder, payment-request, payment-subject, contract-number/date/term, applicant-confirmation.
8. **Вариации (для процедуры изменений):** variation-area, variation-class, variation-changes-table, variation-old/new-value, variation-linked-changes — поля присутствуют, но правил документов для процедуры «изменения» в БД нет.

## Поля, которые влияют на проверку эксперта
Через `linked_params` правил и проверки: `product-type`, `procedure`, `bioequivalence-required`, `new-api-flag`, `biological/immunobiological`, `sterile/aseptic`, `manufacturer-country`, `shelf-life`/`storage-conditions` (расхождения), `composition-table` (состав), `who-prequalification`. Пример: правило 1.2.5 (декларация ОХЛП) завязано на bioequivalence/biological/clinical/new-api/reference-product/shelf-life/storage/trade-name.

## Наблюдения / gap-сигналы (для Части C)
- Поля заявки богаче, чем правила: есть `object-type=МИ` и `procedure=перерег/изменения`, но **правил документов под них нет** → в этих режимах список документов будет пустым/некорректным.
- Часть полей дублируют форму заявления НПА (хорошо), часть — служебные. Сверку с формами НПА — в B4 (C1 gap).
- Условная видимость полей реализована группами под-шагов на клиенте — нужно сверить с условностью форм НПА (когда какое поле должно появляться).
