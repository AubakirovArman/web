import { CheckDefinition, Finding } from '@/lib/types';

export const checkDefinitions: CheckDefinition[] = [
  {
    id: 'required_fields_check',
    name: 'Обязательные поля заявления',
    category: 'Заявление',
    description: 'Проверяет заполненность обязательных полей для типа объекта и процедуры.',
    method: 'rule',
    defaultSeverity: 'critical',
    appliesTo: ['both'],
    npaReferences: ['Приказ ҚР ДСМ-10, формы заявлений'],
    enabledByDefault: true,
  },
  {
    id: 'required_document_presence_check',
    name: 'Комплектность обязательных документов',
    category: 'Комплектность',
    description: 'Проверяет наличие обязательных документов с учетом альтернативных документов.',
    method: 'rule',
    defaultSeverity: 'critical',
    appliesTo: ['both'],
    npaReferences: ['Приказ ҚР ДСМ-10', 'Решение ЕЭК №78', 'Решение ЕЭК №46'],
    enabledByDefault: true,
  },
  {
    id: 'file_format_check',
    name: 'Формат файла',
    category: 'Файлы и форматы',
    description: 'Сравнивает расширение загруженного файла с допустимыми форматами типа документа.',
    method: 'parser',
    defaultSeverity: 'serious',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'ocr_quality_check',
    name: 'Статус OCR/извлечения',
    category: 'OCR',
    description: 'Фиксирует статус распознавания, частичного извлечения и ошибки парсинга.',
    method: 'ocr',
    defaultSeverity: 'warning',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'expected_extracted_fields_check',
    name: 'Обязательные извлечённые поля документа',
    category: 'Извлечённые данные',
    description: 'Проверяет, что из файла удалось извлечь поля, ожидаемые для этого типа документа.',
    method: 'parser',
    defaultSeverity: 'warning',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'npa_imported_requirement_check',
    name: 'Требования НПА к документу',
    category: 'НПА / ручная проверка',
    description: 'Показывает требования, извлеченные из НПА и привязанные к типу документа. Требует экспертной или гибридной проверки.',
    method: 'manual',
    defaultSeverity: 'unknown',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'gmp_certificate_check',
    name: 'GMP и производственная площадка',
    category: 'GMP / производство',
    description: 'Проверяет срок действия, производителя, адрес и покрытие лекарственной формы в GMP.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    documentTypeIds: ['doc-gmp'],
    npaReferences: ['Решение ЕЭК №77', 'Приказ ҚР ДСМ-9'],
    enabledByDefault: true,
  },
  {
    id: 'cpp_certificate_check',
    name: 'CPP / регистрация в стране-производителе',
    category: 'CPP / регистрация',
    description: 'Проверяет CPP, срок действия и связь со страной производства.',
    method: 'hybrid',
    defaultSeverity: 'warning',
    appliesTo: ['LS'],
    documentTypeIds: ['doc-cpp'],
    npaReferences: ['Решение ЕЭК №78'],
    enabledByDefault: true,
  },
  {
    id: 'document_expiry_check',
    name: 'Срок действия документа',
    category: 'Срок действия',
    description: 'Проверяет извлечённое поле validUntil и выявляет просроченные или скоро истекающие документы.',
    method: 'parser',
    defaultSeverity: 'warning',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'core_field_consistency_check',
    name: 'Согласованность ключевых полей',
    category: 'Расхождения между документами',
    description: 'Сравнивает торговое наименование, МНН, дозировку, форму, производителя между заявлением и документами.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'shelf_life_consistency_check',
    name: 'Срок годности',
    category: 'Расхождения между документами',
    description: 'Проверяет согласованность срока годности между ОХЛП, инструкцией, НДК и стабильностью.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'storage_consistency_check',
    name: 'Условия хранения',
    category: 'Расхождения между документами',
    description: 'Проверяет условия хранения между ОХЛП, инструкцией и макетом.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'translation_length_check',
    name: 'Полнота перевода RU/KZ',
    category: 'Перевод',
    description: 'Ищет существенное расхождение объема русской и казахской версии.',
    method: 'parser',
    defaultSeverity: 'warning',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'docx_format_check',
    name: 'Оформление DOCX',
    category: 'Оформление',
    description: 'Проверяет шрифт, размер и цвет текста для DOCX документов.',
    method: 'parser',
    defaultSeverity: 'warning',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'required_sections_check',
    name: 'Обязательные разделы ОХЛП/инструкции',
    category: 'Структура документа',
    description: 'Проверяет наличие ключевых разделов в ОХЛП и инструкции.',
    method: 'parser',
    defaultSeverity: 'warning',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'black_triangle_check',
    name: 'Дополнительный мониторинг',
    category: 'Фармаконадзор',
    description: 'Проверяет наличие отметки о дополнительном мониторинге безопасности.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'pharmacovigilance_contact_check',
    name: 'Фармаконадзор и контактное лицо',
    category: 'Фармаконадзор',
    description: 'Проверяет мастер-файл/краткую характеристику системы фармаконадзора, ПУР и наличие уполномоченного контактного лица в РК.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    documentTypeIds: ['doc-pharmacovigilance-master', 'doc-pharmacovigilance-contact', 'doc-risk-management'],
    npaReferences: ['Решение ЕЭК №87', 'Памятка заявителю, раздел 1.6'],
    enabledByDefault: true,
  },
  {
    id: 'bioequivalence_report_check',
    name: 'Отчет биоэквивалентности',
    category: 'Биоэквивалентность',
    description: 'Проверяет отчет БЭ, дозировку, лекарственную форму, референтный препарат и вывод.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    documentTypeIds: ['doc-bioequivalence-report'],
    npaReferences: ['Решение ЕЭК №85'],
    enabledByDefault: true,
  },
  {
    id: 'bioequivalence_waiver_check',
    name: 'Биовейвер',
    category: 'Биоэквивалентность',
    description: 'Проверяет обоснование отсутствия исследования биоэквивалентности.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    documentTypeIds: ['doc-bioequivalence-waiver'],
    npaReferences: ['Решение ЕЭК №85'],
    enabledByDefault: true,
  },
  {
    id: 'module3_content_check',
    name: 'Модуль 3 / качество',
    category: 'Качество',
    description: 'Проверяет наличие спецификаций, валидации и данных стабильности в Модуле 3.',
    method: 'hybrid',
    defaultSeverity: 'warning',
    appliesTo: ['LS'],
    documentTypeIds: ['doc-module3'],
    enabledByDefault: true,
  },
  {
    id: 'sterility_validation_check',
    name: 'Стерильность',
    category: 'Стерильность',
    description: 'Проверяет наличие подтверждения стерильности для стерильных ЛС/МИ.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
  {
    id: 'ls_reregistration_consistency_check',
    name: 'Перерегистрация ЛС',
    category: 'Перерегистрация',
    description: 'Проверяет номер РУ, срок действия и пострегистрационные данные для ЛС.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'ls_variation_consistency_check',
    name: 'Внесение изменений ЛС',
    category: 'Внесение изменений',
    description: 'Проверяет описание, обоснование, сравнительную таблицу и проекты документов для изменений ЛС.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['LS'],
    enabledByDefault: true,
  },
  {
    id: 'mi_registration_consistency_check',
    name: 'Регистрация МИ',
    category: 'Медицинское изделие',
    description: 'Проверяет ключевые документы, испытания, СМК и класс риска МИ.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['MI'],
    enabledByDefault: true,
  },
  {
    id: 'mi_variation_consistency_check',
    name: 'Изменения МИ',
    category: 'Медицинское изделие',
    description: 'Проверяет описание изменений, обоснование и обновленные инструкции/маркировку МИ.',
    method: 'hybrid',
    defaultSeverity: 'serious',
    appliesTo: ['MI'],
    enabledByDefault: true,
  },
  {
    id: 'undocumented_variation_check',
    name: 'Недокументированное изменение',
    category: 'Внесение изменений',
    description: 'Ищет изменение значений, которое не отражено в описании или сравнительной таблице.',
    method: 'hybrid',
    defaultSeverity: 'warning',
    appliesTo: ['both'],
    enabledByDefault: true,
  },
];

export function getCheckDefinition(checkerId?: string) {
  return checkerId ? checkDefinitions.find((check) => check.id === checkerId) : undefined;
}

export function inferCheckerId(finding: Pick<Finding, 'category' | 'title'>): string {
  const title = finding.title.toLowerCase();
  const category = finding.category.toLowerCase();

  if (title.includes('отсутствует документ')) return 'required_document_presence_check';
  if (category.includes('заявлен')) return 'required_fields_check';
  if (category.includes('файлы')) return 'file_format_check';
  if (category.includes('ocr')) return 'ocr_quality_check';
  if (category.includes('gmp')) return 'gmp_certificate_check';
  if (category.includes('cpp')) return 'cpp_certificate_check';
  if (title.includes('срок годности')) return 'shelf_life_consistency_check';
  if (title.includes('условия хранения')) return 'storage_consistency_check';
  if (category.includes('расхождения')) return 'core_field_consistency_check';
  if (category.includes('перевод')) return 'translation_length_check';
  if (category.includes('оформление')) return 'docx_format_check';
  if (category.includes('структура')) return 'required_sections_check';
  if (category.includes('фармаконадзор')) {
    return title.includes('контакт') || title.includes('мастер') || title.includes('пур') || title.includes('рисками')
      ? 'pharmacovigilance_contact_check'
      : 'black_triangle_check';
  }
  if (category.includes('биоэквивалент')) {
    return title.includes('обоснован') || title.includes('биовейвер')
      ? 'bioequivalence_waiver_check'
      : 'bioequivalence_report_check';
  }
  if (category.includes('качество')) return 'module3_content_check';
  if (category.includes('стериль')) return 'sterility_validation_check';
  if (category.includes('перерегистрация')) return 'ls_reregistration_consistency_check';
  if (category.includes('внесение изменений')) return 'ls_variation_consistency_check';
  if (category.includes('медицинское изделие')) {
    return title.includes('изменен') || title.includes('изменен') || title.includes('изменений')
      ? 'mi_variation_consistency_check'
      : 'mi_registration_consistency_check';
  }
  return 'core_field_consistency_check';
}

export function enrichFinding(finding: Finding): Finding {
  const checkerId = finding.checkerId || inferCheckerId(finding);
  const status =
    finding.status ||
    (finding.accepted === true ? 'accepted' : finding.accepted === false ? 'rejected' : 'open');
  return {
    ...finding,
    checkerId,
    status,
    confidence: finding.confidence ?? (finding.quotes?.length ? 0.82 : 0.68),
    evidence:
      finding.evidence ||
      finding.quotes?.map((quote) => ({
        source: quote.source,
        text: quote.text,
      })),
  };
}

export function enrichFindings(findings: Finding[]): Finding[] {
  return findings.map(enrichFinding);
}
