import fs from 'node:fs';

const DEFS = 'lib/data/generated/seed-additional-parameters.json';
const BASE = 'lib/data/generated/seed-mi-base-fields.json';

const yn = [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }];
const timeUnit = [{ value: 'year', label: 'Год' }, { value: 'month', label: 'Месяц' }, { value: 'day', label: 'День' }];
const productionOpts = [
  { value: 'full-here', label: 'Полностью на данном производстве' },
  { value: 'partial-here', label: 'Частично на данном производстве' },
  { value: 'full-other', label: 'Полностью на другом производстве' },
];
const authorityOpts = [
  { value: 'power-of-attorney', label: 'Доверенность' },
  { value: 'contract', label: 'Договор' },
  { value: 'agreement', label: 'Соглашение' },
];

// группа → поля (label/type/options). section — метаданные.
const PLAN = {
  base: [
    ['param-mi-accelerated-expertise', 'Вид экспертизы: ускоренная', 'select', yn],
    ['param-mi-basis', 'Основание', 'textarea'],
    ['param-mi-gmdn-code', 'Номенклатурный код GMDN (глобальный)', 'text'],
  ],
  'device-info': [
    ['param-mi-tech-characteristic-ru', 'Краткая техническая характеристика (рус.)', 'textarea'],
    ['param-mi-tech-characteristic-kz', 'Краткая техническая характеристика (каз.)', 'textarea'],
    ['param-mi-contains-medicine', 'В составе имеется лекарственное средство', 'select', yn],
  ],
  classification: [
    ['param-mi-ivd-closed-system', 'In vitro: закрытая система', 'select', yn],
    ['param-mi-is-kit', 'Изделие является набором', 'select', yn],
  ],
  'storage-production': [
    ['param-mi-shelf-life-value', 'Срок хранения (значение)', 'number'],
    ['param-mi-shelf-life-unit', 'Срок хранения (ед. изм.)', 'select', timeUnit],
    ['param-mi-warranty-value', 'Гарантийный срок эксплуатации (значение)', 'number'],
    ['param-mi-warranty-unit', 'Гарантийный срок (ед. изм.)', 'select', timeUnit],
    ['param-mi-transport-conditions', 'Условия транспортирования', 'textarea'],
    ['param-mi-production-mode', 'Производство', 'select', productionOpts],
  ],
  manufacturer: [
    ['param-mi-mfr-type', 'Тип производителя', 'text'],
    ['param-mi-mfr-legal-form', 'Организационная форма производителя', 'text'],
    ['param-mi-mfr-country', 'Страна производителя', 'text'],
    ['param-mi-mfr-name-ru', 'Наименование производителя (рус.)', 'text'],
    ['param-mi-mfr-name-kz', 'Наименование производителя (каз.)', 'text'],
    ['param-mi-mfr-name-en', 'Наименование производителя (англ.)', 'text'],
    ['param-mi-mfr-permit-number', '№ разрешительного документа производителя', 'text'],
    ['param-mi-mfr-permit-issue-date', 'Дата выдачи разрешительного документа', 'date'],
    ['param-mi-mfr-permit-expiry-date', 'Срок действия разрешительного документа', 'date'],
    ['param-mi-mfr-head', 'ФИО / должность руководителя (контактного лица) производителя', 'text'],
    ['param-mi-mfr-phone', 'Телефон / факс производителя', 'text'],
    ['param-mi-mfr-email', 'Электронная почта производителя', 'text'],
    ['param-mi-mfr-legal-address', 'Юридический адрес производителя', 'textarea'],
    ['param-mi-mfr-actual-address', 'Фактический адрес производителя', 'textarea'],
  ],
  representative: [
    ['param-mi-rep-bin-iin', 'БИН / ИИН уполномоченного представителя', 'text'],
    ['param-mi-rep-name', 'Наименование организации / ФИО представителя', 'text'],
    ['param-mi-rep-country', 'Страна представителя', 'text'],
    ['param-mi-rep-legal-address', 'Юридический адрес представителя', 'textarea'],
    ['param-mi-rep-actual-address', 'Фактический адрес представителя', 'textarea'],
    ['param-mi-rep-phone', 'Телефон / факс представителя', 'text'],
    ['param-mi-rep-email', 'Электронная почта представителя', 'text'],
    ['param-mi-rep-authority-doc', 'Документ, подтверждающий полномочия', 'select', authorityOpts],
    ['param-mi-rep-authority-number', 'Номер документа полномочий', 'text'],
    ['param-mi-rep-authority-issue-date', 'Дата выдачи документа полномочий', 'date'],
    ['param-mi-rep-authority-expiry-date', 'Срок действия документа полномочий', 'date'],
    ['param-mi-rep-applicant-head', 'ФИО / должность руководителя организации-заявителя', 'text'],
  ],
  'payment-sign': [
    ['param-mi-payer-name', 'Субъект оплаты: наименование юридического лица', 'text'],
    ['param-mi-payer-country', 'Субъект оплаты: страна', 'text'],
    ['param-mi-payer-legal-address', 'Субъект оплаты: юридический адрес', 'textarea'],
    ['param-mi-payer-actual-address', 'Субъект оплаты: фактический адрес', 'textarea'],
    ['param-mi-payer-person', 'Субъект оплаты: ФИО', 'text'],
    ['param-mi-payer-phone', 'Субъект оплаты: телефон', 'text'],
    ['param-mi-payer-fax', 'Субъект оплаты: факс', 'text'],
    ['param-mi-payer-email', 'Субъект оплаты: электронная почта', 'text'],
    ['param-mi-payer-bin', 'Субъект оплаты: БИН', 'text'],
    ['param-mi-payer-iin', 'Субъект оплаты: ИИН', 'text'],
    ['param-mi-payer-bank', 'Субъект оплаты: банк', 'text'],
    ['param-mi-payer-account', 'Субъект оплаты: расчётный счёт', 'text'],
    ['param-mi-payer-currency-account', 'Субъект оплаты: валютный счёт', 'text'],
    ['param-mi-payer-knp', 'Субъект оплаты: код (КНП/КБК)', 'text'],
    ['param-mi-payer-bik', 'Субъект оплаты: БИК', 'text'],
  ],
};

const defs = JSON.parse(fs.readFileSync(DEFS, 'utf8'));
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const defIds = new Set(defs.map((d) => d.id));
const baseSet = new Set(base);

let addedDefs = 0;
let addedBase = 0;
const groupAdds = {};

for (const [group, fields] of Object.entries(PLAN)) {
  groupAdds[group] = [];
  for (const [id, label, type, options] of fields) {
    if (!defIds.has(id)) {
      const def = { id, label, type, section: 'МИ. Доп. поля (официальная форма)' };
      if (options) def.options = options;
      defs.push(def);
      defIds.add(id);
      addedDefs++;
    }
    if (!baseSet.has(id)) {
      base.push(id);
      baseSet.add(id);
      addedBase++;
    }
    groupAdds[group].push(id);
  }
}

fs.writeFileSync(DEFS, JSON.stringify(defs, null, 2) + '\n');
fs.writeFileSync(BASE, JSON.stringify(base) + '\n');

console.log('Добавлено определений:', addedDefs, '| в base-fields:', addedBase);
console.log('\n=== ВСТАВИТЬ В getMiParameterGroups (fieldIds по группам) ===');
for (const [group, ids] of Object.entries(groupAdds)) {
  console.log(`\n[${group}]`);
  console.log(ids.map((i) => `'${i}'`).join(', '));
}
