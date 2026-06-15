import { ApplicationFormSchema, DocumentType, NPA, ObjectType, Parameter, ProductType, Procedure, Rule } from '@/lib/types';

export const npas: NPA[] = [
  { id: 'npa-1', name: 'Соглашение о единых принципах и правилах обращения лекарственных средств в рамках ЕАЭС', number: '№ 355-V', date: '12.10.2015', direction: 'LS', status: 'active' },
  { id: 'npa-2', name: 'Правила регистрации и экспертизы лекарственных средств для медицинского применения', number: 'Решение № 78', date: '03.11.2016', direction: 'LS', status: 'active' },
  { id: 'npa-3', name: 'Правила проведения исследований биоэквивалентности лекарственных препаратов в рамках ЕАЭС', number: 'Решение № 85', date: '03.11.2016', direction: 'LS', status: 'active' },
  { id: 'npa-4', name: 'Правила надлежащей производственной практики ЕАЭС', number: 'Решение № 77', date: '03.11.2016', direction: 'LS', status: 'active' },
  { id: 'npa-5', name: 'Требования к инструкции по медицинскому применению и общей характеристике лекарственного препарата', number: 'Решение № 88', date: '03.11.2016', direction: 'LS', status: 'active' },
  { id: 'npa-6', name: 'Правила надлежащей практики фармаконадзора ЕАЭС', number: 'Решение № 87', date: '03.11.2016', direction: 'LS', status: 'active' },
  { id: 'npa-7', name: 'Классификатор типов изменений регистрационного досье лекарственного препарата', number: 'Решение № 65', date: '24.04.2018', direction: 'LS', status: 'active' },
  { id: 'npa-8', name: 'Правила проведения экспертизы лекарственного средства или медицинского изделия', number: 'Приказ ҚР ДСМ-10', date: '27.01.2021', direction: 'LS', status: 'active' },
  { id: 'npa-9', name: 'Правила проведения фармацевтических инспекций по надлежащим фармацевтическим практикам', number: 'Приказ ҚР ДСМ-9', date: '27.01.2021', direction: 'LS', status: 'active' },
  { id: 'npa-10', name: 'Правила проведения фармаконадзора и мониторинга безопасности, качества и эффективности медицинских изделий', number: 'Приказ ҚР ДСМ-320', date: '23.12.2020', direction: 'LS', status: 'active' },
  { id: 'npa-11', name: 'Правила маркировки и прослеживаемости лекарственных средств и маркировки медицинских изделий', number: 'Приказ ҚР ДСМ-11', date: '27.01.2021', direction: 'LS', status: 'active' },
  { id: 'npa-12', name: 'Правила регистрации и экспертизы безопасности, качества и эффективности медицинских изделий', number: 'Решение № 46', date: '12.02.2016', direction: 'MI', status: 'active' },
];

export const documentTypes: DocumentType[] = [
  { id: 'doc-application', name: 'Заявление на экспертизу', acceptedFormats: ['pdf', 'docx'], direction: 'both' },
  { id: 'doc-payment', name: 'Документ об оплате', acceptedFormats: ['pdf', 'jpg', 'png'], direction: 'both' },
  { id: 'doc-cover-letter', name: 'Сопроводительное письмо', acceptedFormats: ['pdf', 'docx'], direction: 'both' },
  { id: 'doc-registration-dossier', name: 'Регистрационное досье (модули 1–5 / Части I–IV)', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-samples', name: 'Образцы препарата / стандартные образцы / реагенты', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-cpp', name: 'Сертификат фармацевтического продукта (CPP) / регистрация в стране-производителе', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-gmp', name: 'GMP-сертификат или ссылка на GMP-реестр', acceptedFormats: ['pdf', 'jpg'], direction: 'LS' },
  { id: 'doc-manufacturing-license', name: 'Лицензия на производство', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-foreign-registrations', name: 'Сведения о регистрации в других странах', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-trademark', name: 'Охранный документ на товарный знак', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-spc-ru', name: 'ОХЛП (русский)', acceptedFormats: ['pdf', 'doc', 'docx'], direction: 'LS' },
  { id: 'doc-spc-kz', name: 'ОХЛП (казахский)', acceptedFormats: ['pdf', 'doc', 'docx'], direction: 'LS' },
  { id: 'doc-instruction-ru', name: 'Инструкция / листок-вкладыш (русский)', acceptedFormats: ['pdf', 'doc', 'docx'], direction: 'LS' },
  { id: 'doc-instruction-kz', name: 'Инструкция / листок-вкладыш (казахский)', acceptedFormats: ['pdf', 'doc', 'docx'], direction: 'LS' },
  { id: 'doc-labeling-text', name: 'Текст маркировки', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-mockup', name: 'Макеты упаковки', acceptedFormats: ['jpg', 'jpeg', 'png'], direction: 'LS' },
  { id: 'doc-quality-nd', name: 'Нормативный документ по качеству', acceptedFormats: ['doc', 'docx'], direction: 'LS' },
  { id: 'doc-module3', name: 'Модуль 3. Качество', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-bioequivalence-report', name: 'Отчет об исследовании биоэквивалентности', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-bioequivalence-waiver', name: 'Обоснование отсутствия биоэквивалентности (биовейвер)', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-risk-management', name: 'План управления рисками (ПУР)', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-pharmacovigilance-master', name: 'Мастер-файл системы фармаконадзора', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-pharmacovigilance-contact', name: 'Документ о контактном лице по фармаконадзору', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-generic-summary', name: 'Резюме обоснования воспроизведенного/гибридного/биоаналогичного препарата', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-spc-comparison', name: 'Построчное сравнение ОХЛП/инструкции с референтным препаратом', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-stability', name: 'Данные по стабильности', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-registration-certificate', name: 'Действующее регистрационное удостоверение', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-current-spc-ru', name: 'Действующая ОХЛП (русский)', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-current-spc-kz', name: 'Действующая ОХЛП (казахский)', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-updated-spc-ru', name: 'Проект ОХЛП с изменениями (русский)', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-updated-spc-kz', name: 'Проект ОХЛП с изменениями (казахский)', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-variation-description', name: 'Описание вносимых изменений', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-variation-justification', name: 'Обоснование изменений', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-variation-comparison', name: 'Сравнительная таблица изменений', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  { id: 'doc-post-marketing-data', name: 'Пострегистрационные данные по безопасности и эффективности', acceptedFormats: ['pdf'], direction: 'LS' },
  { id: 'doc-no-changes-statement', name: 'Заявление об отсутствии изменений', acceptedFormats: ['pdf', 'docx'], direction: 'LS' },
  // MI documents
  { id: 'doc-mi-application', name: 'Заявление на регистрацию/экспертизу МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-payment', name: 'Документ об оплате (МИ)', acceptedFormats: ['pdf', 'jpg', 'png'], direction: 'MI' },
  { id: 'doc-mi-cover-letter', name: 'Сопроводительное письмо (МИ)', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-registration-dossier', name: 'Регистрационное досье МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-technical-tests', name: 'Протокол технических испытаний МИ', acceptedFormats: ['pdf'], direction: 'MI' },
  { id: 'doc-mi-biological-studies', name: 'Протокол исследований биологического действия МИ', acceptedFormats: ['pdf'], direction: 'MI' },
  { id: 'doc-mi-clinical-trials', name: 'Протокол клинических/клинико-лабораторных испытаний МИ', acceptedFormats: ['pdf'], direction: 'MI' },
  { id: 'doc-mi-instructions', name: 'Инструкция / эксплуатационная документация МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-labeling', name: 'Текст маркировки МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-mockup', name: 'Макет маркировки МИ', acceptedFormats: ['jpg', 'jpeg', 'png'], direction: 'MI' },
  { id: 'doc-mi-qms-certificate', name: 'Сертификат СМК / декларация соответствия МИ', acceptedFormats: ['pdf'], direction: 'MI' },
  { id: 'doc-mi-registration-certificate', name: 'Действующее регистрационное удостоверение МИ', acceptedFormats: ['pdf'], direction: 'MI' },
  { id: 'doc-mi-post-marketing', name: 'Пострегистрационные данные по безопасности/эффективности МИ', acceptedFormats: ['pdf'], direction: 'MI' },
  { id: 'doc-mi-variation-description', name: 'Описание изменений МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-variation-justification', name: 'Обоснование изменений МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-current-instructions', name: 'Действующая инструкция / эксплуатационная документация МИ', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
  { id: 'doc-mi-updated-instructions', name: 'Проект инструкции / эксплуатационной документации МИ с изменениями', acceptedFormats: ['pdf', 'docx'], direction: 'MI' },
];

export const parameters: Parameter[] = [
  { id: 'param-object-type', label: 'Тип объекта', type: 'select', options: [{ value: 'LS', label: 'Лекарственное средство' }, { value: 'MI', label: 'Медицинское изделие' }] },
  { id: 'param-procedure', label: 'Тип процедуры', type: 'select', options: [{ value: 'registration', label: 'Регистрация' }, { value: 're-registration', label: 'Перерегистрация' }, { value: 'variation', label: 'Внесение изменений' }] },
  { id: 'param-product-type', label: 'Тип лекарственного средства', type: 'select', options: [
    { value: 'original', label: 'Оригинальный' },
    { value: 'generic', label: 'Воспроизведенный (generic)' },
    { value: 'hybrid', label: 'Гибридный' },
    { value: 'biological', label: 'Биологический' },
    { value: 'biosimilar', label: 'Биоаналогичный (биосимиляр)' },
  ] },
  { id: 'param-trade-name', label: 'Торговое наименование', type: 'text' },
  { id: 'param-inn', label: 'МНН', type: 'text' },
  { id: 'param-dosage-form', label: 'Лекарственная форма', type: 'select', options: [
    { value: 'tablets', label: 'Таблетки' },
    { value: 'film-coated-tablets', label: 'Таблетки, покрытые пленочной оболочкой' },
    { value: 'capsules', label: 'Капсулы' },
    { value: 'solution', label: 'Раствор' },
    { value: 'powder', label: 'Порошок' },
    { value: 'injection', label: 'Раствор для инъекций' },
  ] },
  { id: 'param-dosage', label: 'Дозировка', type: 'text' },
  { id: 'param-administration-route', label: 'Путь введения', type: 'select', options: [
    { value: 'oral', label: 'Перорально' },
    { value: 'parenteral', label: 'Парентерально' },
    { value: 'topical', label: 'Местно' },
    { value: 'inhalation', label: 'Ингаляционно' },
  ] },
  { id: 'param-dispensing', label: 'Форма отпуска', type: 'select', options: [
    { value: 'otc', label: 'Без рецепта' },
    { value: 'prescription', label: 'По рецепту' },
    { value: 'hospital', label: 'Для стационаров' },
  ] },
  { id: 'param-sterile', label: 'Стерильный препарат', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-aseptic', label: 'Асептическое производство', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-bioequivalence-required', label: 'Требуется биоэквивалентность', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-clinical-studies', label: 'Есть клинические исследования', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-additional-monitoring', label: 'Препарат требует дополнительного мониторинга безопасности', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-applicant', label: 'Заявитель', type: 'text' },
  { id: 'param-holder', label: 'Держатель регистрационного удостоверения', type: 'text' },
  { id: 'param-manufacturer', label: 'Производитель', type: 'text' },
  { id: 'param-manufacturer-address', label: 'Адрес производственной площадки', type: 'text' },
  { id: 'param-registration-number', label: 'Номер регистрационного удостоверения', type: 'text' },
  { id: 'param-variation-class', label: 'Класс изменений', type: 'select', options: [{ value: 'IA', label: 'IA' }, { value: 'IB', label: 'IB' }, { value: 'II', label: 'II' }] },
  { id: 'param-variation-area', label: 'Область изменений', type: 'select', options: [
    { value: 'spc', label: 'ОХЛП / инструкция' },
    { value: 'labeling', label: 'Маркировка / макет' },
    { value: 'quality', label: 'Качество / НДК / Модуль 3' },
    { value: 'manufacturing', label: 'Производство / GMP' },
    { value: 'pharmacovigilance', label: 'Фармаконадзор / ПУР' },
  ] },
  { id: 'param-variation-old-value', label: 'Текущее (старое) значение', type: 'text' },
  { id: 'param-variation-new-value', label: 'Планируемое (новое) значение', type: 'text' },
  { id: 'param-mi-risk-class', label: 'Класс риска медицинского изделия', type: 'select', options: [
    { value: 'I', label: 'I' },
    { value: 'IIa', label: 'IIa' },
    { value: 'IIb', label: 'IIb' },
    { value: 'III', label: 'III' },
  ] },
  { id: 'param-mi-type', label: 'Тип медицинского изделия', type: 'select', options: [
    { value: 'diagnostic', label: 'Диагностическое' },
    { value: 'therapeutic', label: 'Терапевтическое' },
    { value: 'surgical', label: 'Хирургическое' },
    { value: 'ivd', label: 'IVD (in vitro)' },
    { value: 'implantable', label: 'Имплантируемое' },
    { value: 'software', label: 'Программное обеспечение' },
  ] },
  { id: 'param-mi-sterile', label: 'Стерильное изделие', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-mi-measuring', label: 'Является средством измерения', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-mi-ivd', label: 'Изделие для диагностики in vitro', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-mi-implantable', label: 'Имплантируемое изделие', type: 'select', options: [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }] },
  { id: 'param-mi-registration-number', label: 'Номер регистрационного удостоверения МИ', type: 'text' },
  { id: 'param-mi-variation-class', label: 'Класс изменений МИ', type: 'select', options: [{ value: 'IA', label: 'IA' }, { value: 'IB', label: 'IB' }, { value: 'II', label: 'II' }] },
  { id: 'param-mi-variation-area', label: 'Область изменений МИ', type: 'select', options: [
    { value: 'labeling', label: 'Маркировка / инструкция' },
    { value: 'quality', label: 'Качество / дизайн' },
    { value: 'manufacturing', label: 'Производство / СМК' },
    { value: 'software', label: 'ПО' },
  ] },
  { id: 'param-mi-variation-old-value', label: 'Текущее значение (МИ)', type: 'text' },
  { id: 'param-mi-variation-new-value', label: 'Новое значение (МИ)', type: 'text' },
];

export const productTypeLabels: Record<ProductType, string> = {
  original: 'Оригинальный',
  generic: 'Воспроизведенный (generic)',
  hybrid: 'Гибридный',
  biological: 'Биологический',
  biosimilar: 'Биоаналогичный (биосимиляр)',
};

const lsBaseFields: string[] = [
  'param-object-type',
  'param-procedure',
  'param-trade-name',
  'param-inn',
  'param-dosage-form',
  'param-dosage',
  'param-administration-route',
  'param-dispensing',
  'param-manufacturer',
  'param-manufacturer-address',
  'param-applicant',
];

const lsProcedureFields: Record<Procedure, string[]> = {
  registration: ['param-product-type', 'param-sterile', 'param-aseptic', 'param-bioequivalence-required', 'param-clinical-studies', 'param-holder', 'param-additional-monitoring'],
  're-registration': ['param-product-type', 'param-sterile', 'param-aseptic', 'param-bioequivalence-required', 'param-clinical-studies', 'param-holder', 'param-registration-number', 'param-additional-monitoring'],
  variation: [
    'param-product-type',
    'param-sterile',
    'param-aseptic',
    'param-bioequivalence-required',
    'param-clinical-studies',
    'param-holder',
    'param-additional-monitoring',
    'param-registration-number',
    'param-variation-class',
    'param-variation-area',
    'param-variation-old-value',
    'param-variation-new-value',
  ],
};

const lsRequiredFields: Record<Procedure, string[]> = {
  registration: [
    'param-trade-name',
    'param-inn',
    'param-dosage-form',
    'param-dosage',
    'param-product-type',
    'param-administration-route',
    'param-dispensing',
    'param-manufacturer',
    'param-manufacturer-address',
    'param-applicant',
  ],
  're-registration': [
    'param-trade-name',
    'param-inn',
    'param-dosage-form',
    'param-dosage',
    'param-product-type',
    'param-administration-route',
    'param-dispensing',
    'param-registration-number',
    'param-holder',
    'param-manufacturer',
    'param-manufacturer-address',
    'param-applicant',
  ],
  variation: [
    'param-trade-name',
    'param-inn',
    'param-dosage-form',
    'param-dosage',
    'param-product-type',
    'param-administration-route',
    'param-dispensing',
    'param-registration-number',
    'param-holder',
    'param-variation-class',
    'param-variation-area',
    'param-variation-old-value',
    'param-variation-new-value',
    'param-manufacturer',
    'param-manufacturer-address',
    'param-applicant',
  ],
};

const miBaseFields: string[] = [
  'param-object-type',
  'param-procedure',
  'param-trade-name',
  'param-applicant',
  'param-mi-type',
  'param-mi-risk-class',
  'param-manufacturer',
  'param-manufacturer-address',
  'param-mi-sterile',
  'param-mi-measuring',
  'param-mi-ivd',
  'param-mi-implantable',
];

const miProcedureFields: Record<Procedure, string[]> = {
  registration: [],
  're-registration': ['param-mi-registration-number'],
  variation: [
    'param-mi-registration-number',
    'param-mi-variation-class',
    'param-mi-variation-area',
    'param-mi-variation-old-value',
    'param-mi-variation-new-value',
  ],
};

const miRequiredFields: Record<Procedure, string[]> = {
  registration: [
    'param-trade-name',
    'param-applicant',
    'param-mi-type',
    'param-mi-risk-class',
    'param-manufacturer',
    'param-manufacturer-address',
  ],
  're-registration': [
    'param-trade-name',
    'param-applicant',
    'param-mi-type',
    'param-mi-risk-class',
    'param-manufacturer',
    'param-manufacturer-address',
    'param-mi-registration-number',
  ],
  variation: [
    'param-trade-name',
    'param-applicant',
    'param-mi-type',
    'param-mi-risk-class',
    'param-mi-registration-number',
    'param-mi-variation-class',
    'param-mi-variation-area',
    'param-mi-variation-old-value',
    'param-mi-variation-new-value',
    'param-manufacturer',
    'param-manufacturer-address',
  ],
};

const lsProfile: ApplicationFormSchema['LS'] = {
  baseFields: lsBaseFields,
  requiredFields: lsRequiredFields,
  procedureFields: lsProcedureFields,
};

const miProfile: ApplicationFormSchema['MI'] = {
  baseFields: miBaseFields,
  requiredFields: miRequiredFields,
  procedureFields: miProcedureFields,
};

export const applicationFormProfiles: ApplicationFormSchema = {
  LS: lsProfile,
  MI: miProfile,
};

export function getVisibleParameterIds(
  objectType: ObjectType = 'LS',
  procedure: Procedure = 'registration',
  values: Record<string, string> = {}
): string[] {
  const profile = applicationFormProfiles[objectType] || applicationFormProfiles.LS;
  const fields = [...profile.baseFields, ...profile.procedureFields[procedure]];
  const visible = new Set(fields);

  if (objectType === 'MI' && values['param-mi-risk-class']) {
    visible.add('param-mi-risk-class');
  }

  return Array.from(visible);
}

export function getRequiredParameterIds(
  objectType: ObjectType = 'LS',
  procedure: Procedure = 'registration'
): string[] {
  const profile = applicationFormProfiles[objectType] || applicationFormProfiles.LS;
  return Array.from(new Set(profile.requiredFields[procedure]));
}

export function getParameterLabelById(paramId: string): string {
  return parameters.find((param) => param.id === paramId)?.label || paramId;
}

export const rules: Rule[] = [
  {
    id: 'rule-common-registration',
    name: 'Общий пакет документов для регистрации',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'registration' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-application', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-payment', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-cover-letter', severityIfMissing: 'warning' },
      { documentTypeId: 'doc-registration-dossier', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-samples', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-gmp', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-cpp', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-foreign-registrations', severityIfMissing: 'warning' },
      { documentTypeId: 'doc-spc-ru', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-spc-kz', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-instruction-ru', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-instruction-kz', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-labeling-text', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-mockup', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-quality-nd', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-module3', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-stability', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-2',
  },
  {
    id: 'rule-generic-bioequivalence',
    name: 'Generic: биоэквивалентность или обоснование отсутствия',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-product-type', operator: 'equals', value: 'generic' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'registration' },
    ],
    requiredDocuments: [
      {
        documentTypeId: 'doc-bioequivalence-report',
        severityIfMissing: 'critical',
        alternativeDocumentTypeId: 'doc-bioequivalence-waiver',
        checks: ['document_presence', 'reference_product_extraction', 'dosage_consistency'],
      },
      { documentTypeId: 'doc-generic-summary', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-spc-comparison', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-3',
  },
  {
    id: 'rule-biological-risk-management',
    name: 'Биологический / биоаналогичный: ПУР и фармаконадзор',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-product-type', operator: 'includes', value: 'biological' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-risk-management', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-pharmacovigilance-master', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-pharmacovigilance-contact', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-6',
  },
  {
    id: 'rule-biosimilar-comparison',
    name: 'Биоаналогичный: сравнительные данные с референтным препаратом',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-product-type', operator: 'equals', value: 'biosimilar' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-generic-summary', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-spc-comparison', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-risk-management', severityIfMissing: 'critical' },
    ],
    sourceNpaId: 'npa-2',
  },
  {
    id: 'rule-hybrid-data',
    name: 'Гибридный: обоснование отличий и доп. данные',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-product-type', operator: 'equals', value: 'hybrid' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-generic-summary', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-spc-comparison', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-2',
  },
  {
    id: 'rule-sterile',
    name: 'Стерильный препарат: валидация стерильности',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-sterile', operator: 'equals', value: 'yes' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-module3', severityIfMissing: 'critical', checks: ['sterility_validation'] },
    ],
    sourceNpaId: 'npa-4',
  },
  {
    id: 'rule-trademark',
    name: 'Товарный знак',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-trade-name', operator: 'notEmpty' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-trademark', severityIfMissing: 'warning' },
    ],
    sourceNpaId: 'npa-8',
  },
  {
    id: 'rule-re-registration',
    name: 'Пакет документов для перерегистрации',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-procedure', operator: 'equals', value: 're-registration' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-application', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-payment', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-registration-certificate', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-cover-letter', severityIfMissing: 'warning' },
      { documentTypeId: 'doc-registration-dossier', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-gmp', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-spc-ru', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-spc-kz', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-instruction-ru', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-instruction-kz', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-post-marketing-data', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-pharmacovigilance-master', severityIfMissing: 'warning' },
    ],
    sourceNpaId: 'npa-2',
  },
  {
    id: 'rule-variation',
    name: 'Пакет документов для внесения изменений',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-application', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-payment', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-registration-certificate', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-variation-description', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-variation-justification', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-variation-comparison', severityIfMissing: 'warning' },
      { documentTypeId: 'doc-current-spc-ru', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-current-spc-kz', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-updated-spc-ru', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-updated-spc-kz', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-labeling-text', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-mockup', severityIfMissing: 'warning' },
    ],
    sourceNpaId: 'npa-7',
  },
  {
    id: 'rule-variation-gmp',
    name: 'Изменение в области производства / GMP: нужны GMP и CPP',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
      { parameterId: 'param-variation-area', operator: 'equals', value: 'manufacturing' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-gmp', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-cpp', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-manufacturing-license', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-7',
  },
  {
    id: 'rule-variation-quality',
    name: 'Изменение в области качества: нужны НДК и Модуль 3',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
      { parameterId: 'param-variation-area', operator: 'equals', value: 'quality' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-quality-nd', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-module3', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-stability', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-7',
  },
  {
    id: 'rule-variation-pharmacovigilance',
    name: 'Изменение в области фармаконадзора: нужны ПУР и мастер-файл',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'LS' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
      { parameterId: 'param-variation-area', operator: 'equals', value: 'pharmacovigilance' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-risk-management', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-pharmacovigilance-master', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-pharmacovigilance-contact', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-7',
  },
  // MI rules
  {
    id: 'rule-mi-common-registration',
    name: 'Общий пакет документов для регистрации МИ',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'registration' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-application', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-payment', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-cover-letter', severityIfMissing: 'warning' },
      { documentTypeId: 'doc-mi-registration-dossier', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-technical-tests', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-instructions', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-labeling', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-mockup', severityIfMissing: 'warning' },
      { documentTypeId: 'doc-mi-qms-certificate', severityIfMissing: 'critical' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-biological-studies',
    name: 'МИ IIb/III или имплантируемое: нужны исследования биологического действия',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'registration' },
      { parameterId: 'param-mi-risk-class', operator: 'includes', value: 'II' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-biological-studies', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-clinical-trials',
    name: 'МИ IIb/III, IVD или имплантируемое: нужны клинические испытания',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'registration' },
      { parameterId: 'param-mi-risk-class', operator: 'includes', value: 'II' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-clinical-trials', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-implantable-extra',
    name: 'Имплантируемое МИ: дополнительные данные',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'registration' },
      { parameterId: 'param-mi-implantable', operator: 'equals', value: 'yes' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-biological-studies', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-clinical-trials', severityIfMissing: 'critical' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-re-registration',
    name: 'Пакет документов для перерегистрации МИ',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 're-registration' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-application', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-payment', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-registration-certificate', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-registration-dossier', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-qms-certificate', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-instructions', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-post-marketing', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-variation',
    name: 'Пакет документов для внесения изменений МИ',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-application', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-payment', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-registration-certificate', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-variation-description', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-variation-justification', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-mi-current-instructions', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-updated-instructions', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-labeling', severityIfMissing: 'serious' },
      { documentTypeId: 'doc-mi-mockup', severityIfMissing: 'warning' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-variation-quality',
    name: 'Изменение качества/дизайна МИ: нужны испытания',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
      { parameterId: 'param-mi-variation-area', operator: 'equals', value: 'quality' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-technical-tests', severityIfMissing: 'critical' },
      { documentTypeId: 'doc-mi-biological-studies', severityIfMissing: 'serious' },
    ],
    sourceNpaId: 'npa-12',
  },
  {
    id: 'rule-mi-variation-manufacturing',
    name: 'Изменение производства/СМК МИ: нужны документы по СМК',
    active: true,
    conditions: [
      { parameterId: 'param-object-type', operator: 'equals', value: 'MI' },
      { parameterId: 'param-procedure', operator: 'equals', value: 'variation' },
      { parameterId: 'param-mi-variation-area', operator: 'equals', value: 'manufacturing' },
    ],
    requiredDocuments: [
      { documentTypeId: 'doc-mi-qms-certificate', severityIfMissing: 'critical' },
    ],
    sourceNpaId: 'npa-12',
  },
];

export const defaultApplicationValues: Record<string, string> = {
  'param-object-type': 'LS',
  'param-procedure': 'registration',
  'param-product-type': 'generic',
  'param-trade-name': 'Парацетамол-Тева',
  'param-inn': 'Парацетамол',
  'param-dosage-form': 'tablets',
  'param-dosage': '500 мг',
  'param-administration-route': 'oral',
  'param-dispensing': 'otc',
  'param-sterile': 'no',
  'param-aseptic': 'no',
  'param-bioequivalence-required': 'yes',
  'param-clinical-studies': 'no',
  'param-applicant': 'ООО «Тева Казахстан»',
  'param-holder': 'ООО «Тева Казахстан»',
  'param-manufacturer': 'Teva Pharmaceutical Industries Ltd.',
  'param-manufacturer-address': 'Ул. Производственная, 10, Венгрия',
};
