import { Application, Finding, Severity, UploadedFile } from '@/lib/types';
import { documentTypes, parameters, productTypeLabels } from '@/lib/data/seed';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getDocName(id: string) {
  return documentTypes.find((d) => d.id === id)?.name || id;
}

function getDocType(id: string) {
  return documentTypes.find((d) => d.id === id);
}

function normalize(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^\w\u0400-\u04ff\d]/g, '')
    .trim();
}

function createFinding(
  severity: Severity,
  category: string,
  title: string,
  description: string,
  documents: string[],
  recommendation: string,
  quotes?: { source: string; text: string }[],
  npaReference?: string
): Finding {
  return {
    id: uid(),
    severity,
    category,
    title,
    description,
    documents,
    recommendation,
    quotes,
    npaReference,
  };
}

function extract(file: UploadedFile, key: string): string | undefined {
  return file.extracted?.[key];
}

function findFile(app: Application, docTypeId: string): UploadedFile | undefined {
  return app.files.find((f) => f.documentTypeId === docTypeId);
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!parts) return null;
  const date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T00:00:00`);
  return isNaN(date.getTime()) ? null : date;
}

function isExpired(dateStr: string): boolean {
  const date = parseDate(dateStr);
  return !!date && date < new Date();
}

function daysUntil(dateStr: string): number | null {
  const date = parseDate(dateStr);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function halfPointsToPt(val: string): number | null {
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  return n / 2;
}

function isTimesNewRoman(font: string): boolean {
  return /times\s*new\s*roman|tnr/i.test(font);
}

function checkDocxFormatting(
  file: UploadedFile,
  docLabel: string,
  findings: Finding[],
  npaReference: string
) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'docx') {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Автоматическая проверка шрифта для «${docLabel}» недоступна`,
        'Формат файла не DOCX. Проверка шрифта, размера и цвета по Решению №88 выполняется вручную.',
        [docLabel],
        'Для автоматической проверки оформления предоставьте DOCX-версию документа.',
        undefined,
        npaReference
      )
    );
    return;
  }

  const fontsRaw = extract(file, 'fonts');
  const sizesRaw = extract(file, 'sizes');
  const colorsRaw = extract(file, 'colors');

  if (!fontsRaw && !sizesRaw && !colorsRaw) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Не удалось извлечь параметры шрифта для «${docLabel}»`,
        'Не удалось определить шрифт, размер или цвет из DOCX.',
        [docLabel],
        'Проверьте оформление документа вручную или перезагрузите файл.',
        undefined,
        npaReference
      )
    );
    return;
  }

  const fonts = fontsRaw?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  if (fonts.length > 0 && !fonts.some(isTimesNewRoman)) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Шрифт в «${docLabel}» отличается от Times New Roman`,
        `Обнаруженные шрифты: ${fonts.join(', ')}. Решение №88 рекомендует Times New Roman 12 пт.`,
        [docLabel],
        'Приведите шрифт документа к Times New Roman.',
        [{ source: docLabel, text: fonts.join(', ') }],
        npaReference
      )
    );
  }

  const sizes = sizesRaw?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const bodySizes = sizes.map(halfPointsToPt).filter((n): n is number => n !== null);
  if (bodySizes.length > 0 && bodySizes.some((s) => s !== 12)) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Размер шрифта в «${docLabel}» отличается от 12 пт`,
        `Обнаружены размеры: ${bodySizes.join(', ')} пт. Основной текст должен быть 12 пт.`,
        [docLabel],
        'Приведите основной текст документа к размеру 12 пт.',
        [{ source: docLabel, text: bodySizes.join(', ') + ' пт' }],
        npaReference
      )
    );
  }

  const colors = colorsRaw?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  if (colors.length > 0 && !colors.includes('000000')) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Цвет текста в «${docLabel}» отличается от чёрного`,
        `Обнаружены цвета: ${colors.join(', ')}. Текст должен быть чёрным (000000).`,
        [docLabel],
        'Используйте чёрный цвет для основного текста.',
        [{ source: docLabel, text: colors.join(', ') }],
        npaReference
      )
    );
  }
}

const SPC_REQUIRED_SECTIONS = [
  { keyword: 'состав', label: 'состав' },
  { keyword: 'показани', label: 'показания к применению' },
  { keyword: 'противопоказани', label: 'противопоказания' },
  { keyword: 'дозировк', label: 'дозировка' },
  { keyword: 'побочн', label: 'побочные действия' },
  { keyword: 'срок годности', label: 'срок годности' },
  { keyword: 'условия хранения', label: 'условия хранения' },
];

const INSTRUCTION_REQUIRED_SECTIONS = [
  ...SPC_REQUIRED_SECTIONS,
  { keyword: 'передозировк', label: 'передозировка' },
  { keyword: 'взаимодействие', label: 'взаимодействие' },
];

function checkRequiredSections(
  file: UploadedFile,
  docLabel: string,
  sections: { keyword: string; label: string }[],
  findings: Finding[],
  npaReference: string
) {
  const text = extract(file, 'textContent') || '';
  if (!text) return;
  const missing = sections
    .filter((s) => !normalize(text).includes(normalize(s.keyword)))
    .map((s) => s.label);
  if (missing.length > 0) {
    findings.push(
      createFinding(
        'warning',
        'Структура документа',
        `В «${docLabel}» не найдены обязательные разделы`,
        `Отсутствуют разделы: ${missing.join(', ')}.`,
        [docLabel],
        'Добавьте недостающие разделы в соответствии с требованиями Решения №88.',
        [{ source: docLabel, text: text.slice(0, 200) }],
        npaReference
      )
    );
  }
}

function checkBlackTriangle(
  file: UploadedFile,
  docLabel: string,
  findings: Finding[],
  npaReference: string
) {
  const hasFlag = extract(file, 'hasBlackTriangle');
  const text = extract(file, 'textContent') || '';
  const hasSymbol = /▼|черн.*треугольник|дополнительный мониторинг/i.test(text);
  const confirmed = normalize(hasFlag) === 'да' || hasSymbol;
  if (!confirmed) {
    findings.push(
      createFinding(
        'serious',
        'Фармаконадзор',
        `В «${docLabel}» отсутствует отметка о дополнительном мониторинге`,
        'Препарат отмечен как требующий дополнительного мониторинга безопасности, но в инструкции не найден чёрный перевернутый треугольник и пояснение.',
        [docLabel],
        'Добавьте в инструкцию символ дополнительного мониторинга и пояснение.',
        [{ source: docLabel, text: text.slice(0, 200) }],
        npaReference
      )
    );
  }
}

export function runChecks(app: Application): Finding[] {
  const findings: Finding[] = [];
  const values = app.values;
  const objectType = values['param-object-type'] as string;
  const productType = values['param-product-type'] as string;
  const productLabel = productTypeLabels[productType as keyof typeof productTypeLabels] || productType;
  const procedure = values['param-procedure'] as string;

  // 1. Application completeness
  const requiredAppFields = [
    { id: 'param-trade-name', label: 'Торговое наименование' },
    { id: 'param-inn', label: 'МНН' },
    { id: 'param-dosage', label: 'Дозировка' },
    { id: 'param-manufacturer', label: 'Производитель' },
    { id: 'param-manufacturer-address', label: 'Адрес производства' },
    { id: 'param-applicant', label: 'Заявитель' },
  ];
  for (const field of requiredAppFields) {
    const val = values[field.id];
    if (!val || (typeof val === 'string' && val.trim() === '')) {
      findings.push(
        createFinding(
          'critical',
          'Заявление',
          `Не заполнено поле заявления: ${field.label}`,
          `В заявлении отсутствует обязательное поле «${field.label}».`,
          ['Заявление'],
          `Заполните поле «${field.label}» в параметрах заявки.`,
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 2'
        )
      );
    }
  }

  // 2. File format validation for all uploaded documents
  for (const file of app.files) {
    const docType = getDocType(file.documentTypeId);
    if (!docType) continue;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!docType.acceptedFormats.includes(ext)) {
      findings.push(
        createFinding(
          'serious',
          'Файлы и форматы',
          `Неверный формат файла: ${docType.name}`,
          `Для документа «${docType.name}» допустимы форматы: ${docType.acceptedFormats.join(', ')}. Загружен: ${file.name}.`,
          [docType.name],
          `Переведите файл в один из допустимых форматов и загрузите повторно.`,
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 3'
        )
      );
    }
  }

  // 3. GMP validity and address
  const gmp = findFile(app, 'doc-gmp');
  if (gmp) {
    const gmpAddress = extract(gmp, 'address');
    const appAddress = values['param-manufacturer-address'] as string;
    if (gmpAddress && appAddress && normalize(gmpAddress) !== normalize(appAddress)) {
      findings.push(
        createFinding(
          'serious',
          'GMP / производство',
          'Адрес производственной площадки в GMP отличается от заявления',
          `В заявлении указан адрес: «${appAddress}». В GMP-сертификате: «${gmpAddress}».`,
          [getDocName('doc-gmp'), 'Заявление'],
          'Проверьте соответствие GMP-сертификата заявленной площадке.',
          [
            { source: 'Заявление', text: appAddress },
            { source: getDocName('doc-gmp'), text: gmpAddress },
          ],
          'Приказ ҚР ДСМ-10, Приложение 2, IА1; Решение Совета ЕЭК № 77'
        )
      );
    }
    const gmpValid = extract(gmp, 'validUntil');
    if (gmpValid && isExpired(gmpValid)) {
      findings.push(
        createFinding(
          'critical',
          'GMP / производство',
          'GMP-сертификат просрочен',
          `Срок действия GMP-сертификата: ${gmpValid}.`,
          [getDocName('doc-gmp')],
          'Предоставьте действующий GMP-сертификат или актуальную выписку из реестра.',
          [{ source: getDocName('doc-gmp'), text: gmpValid! }],
          'Решение Совета ЕЭК № 77'
        )
      );
    }
    const gmpValidDays = gmpValid ? daysUntil(gmpValid) : null;
    if (gmpValidDays !== null && gmpValidDays >= 0 && gmpValidDays <= 180) {
      findings.push(
        createFinding(
          'warning',
          'GMP / производство',
          'Срок действия GMP-сертификата истекает в ближайшие 6 месяцев',
          `GMP-сертификат действителен до ${gmpValid} (осталось ${gmpValidDays} дн.).`,
          [getDocName('doc-gmp')],
          'Убедитесь, что к моменту рассмотрения заявки сертификат будет действителен, или предоставьте новый.',
          [{ source: getDocName('doc-gmp'), text: gmpValid! }],
          'Решение Совета ЕЭК № 77'
        )
      );
    }
    const gmpManufacturer = extract(gmp, 'manufacturer');
    const appManufacturer = values['param-manufacturer'] as string;
    if (gmpManufacturer && appManufacturer && normalize(gmpManufacturer) !== normalize(appManufacturer)) {
      findings.push(
        createFinding(
          'serious',
          'GMP / производство',
          'Производитель в GMP-сертификате отличается от заявления',
          `В заявлении указан производитель: «${appManufacturer}». В GMP-сертификате: «${gmpManufacturer}».`,
          [getDocName('doc-gmp'), 'Заявление'],
          'Проверьте, что GMP-сертификат выдан для заявленного производителя.',
          [
            { source: 'Заявление', text: appManufacturer },
            { source: getDocName('doc-gmp'), text: gmpManufacturer },
          ],
          'Решение Совета ЕЭК № 77'
        )
      );
    }
    const gmpScope = extract(gmp, 'scope');
    const appDosageForm = values['param-dosage-form'] as string;
    const dosageFormParam = parameters.find((p) => p.id === 'param-dosage-form');
    const appDosageFormLabel = dosageFormParam?.options?.find((o) => o.value === appDosageForm)?.label || appDosageForm;
    if (gmpScope && appDosageForm && !normalize(gmpScope).includes(normalize(appDosageForm)) && !normalize(gmpScope).includes(normalize(appDosageFormLabel))) {
      findings.push(
        createFinding(
          'warning',
          'GMP / производство',
          'GMP-сертификат может не покрывать заявленную лекарственную форму',
          `В заявлении лекарственная форма: «${appDosageFormLabel}». Область действия GMP: «${gmpScope}».`,
          [getDocName('doc-gmp'), 'Заявление'],
          'Проверьте, что GMP-сертификат покрывает производство заявленной лекарственной формы.',
          [
            { source: 'Заявление', text: appDosageFormLabel },
            { source: getDocName('doc-gmp'), text: gmpScope },
          ],
          'Решение Совета ЕЭК № 77; Приказ ҚР ДСМ-9'
        )
      );
    }
  }

  // 4. CPP validity
  const cpp = findFile(app, 'doc-cpp');
  if (cpp) {
    const cppValid = extract(cpp, 'validUntil');
    if (cppValid && isExpired(cppValid)) {
      findings.push(
        createFinding(
          'serious',
          'CPP / регистрация',
          'Сертификат фармацевтического продукта просрочен',
          `Срок действия CPP: ${cppValid}.`,
          [getDocName('doc-cpp')],
          'Предоставьте действующий CPP.',
          [{ source: getDocName('doc-cpp'), text: cppValid }],
          'Решение Совета ЕЭК № 78'
        )
      );
    }
  }

  // 5. Cross-document core fields consistency
  const appData = app.values as any;
  const spcRu = findFile(app, 'doc-spc-ru');
  const instrRu = findFile(app, 'doc-instruction-ru');
  const mockup = findFile(app, 'doc-mockup');
  const qualityNd = findFile(app, 'doc-quality-nd');
  const labeling = findFile(app, 'doc-labeling-text');

  // 5a. Manufacturer consistency across GMP, SPC, instruction, quality ND and application
  const appManufacturer = values['param-manufacturer'] as string;
  if (appManufacturer) {
    const manufacturerSources: [string, UploadedFile | undefined][] = [
      ['Заявление', undefined],
      [getDocName('doc-gmp'), gmp],
      [getDocName('doc-spc-ru'), spcRu],
      [getDocName('doc-instruction-ru'), instrRu],
      [getDocName('doc-quality-nd'), qualityNd],
    ];
    const manufacturerValues: { source: string; text: string }[] = [];
    for (const [sourceName, file] of manufacturerSources) {
      const val = sourceName === 'Заявление' ? appManufacturer : file ? extract(file, 'manufacturer') : undefined;
      if (val) manufacturerValues.push({ source: sourceName, text: val });
    }
    const distinctManufacturer = Array.from(new Set(manufacturerValues.map((v) => normalize(v.text)))).filter(Boolean);
    if (distinctManufacturer.length > 1) {
      findings.push(
        createFinding(
          'serious',
          'Расхождения между документами',
          'Расхождение наименования производителя между документами',
          `Наименование производителя не совпадает в заявлении и/или прикреплённых документах.`,
          manufacturerValues.map((v) => v.source),
          'Приведите наименование производителя к единому значению во всех документах.',
          manufacturerValues,
          'Решение Совета ЕЭК № 77; Приказ ҚР ДСМ-10, Приложение 2'
        )
      );
    }
  }

  const fieldsToCheck: { key: string; label: string; sources: [string, UploadedFile | undefined][] }[] = [
    {
      key: 'tradeName',
      label: 'Торговое наименование',
      sources: [
        ['Заявление', undefined],
        [getDocName('doc-spc-ru'), spcRu],
        [getDocName('doc-instruction-ru'), instrRu],
        [getDocName('doc-mockup'), mockup],
        [getDocName('doc-quality-nd'), qualityNd],
      ],
    },
    {
      key: 'inn',
      label: 'МНН',
      sources: [
        ['Заявление', undefined],
        [getDocName('doc-spc-ru'), spcRu],
        [getDocName('doc-instruction-ru'), instrRu],
      ],
    },
    {
      key: 'dosage',
      label: 'Дозировка',
      sources: [
        ['Заявление', undefined],
        [getDocName('doc-spc-ru'), spcRu],
        [getDocName('doc-instruction-ru'), instrRu],
        [getDocName('doc-mockup'), mockup],
        [getDocName('doc-quality-nd'), qualityNd],
      ],
    },
    {
      key: 'dosageForm',
      label: 'Лекарственная форма',
      sources: [
        ['Заявление', undefined],
        [getDocName('doc-spc-ru'), spcRu],
        [getDocName('doc-instruction-ru'), instrRu],
      ],
    },
  ];

  for (const field of fieldsToCheck) {
    const appValue = appData[field.key === 'tradeName' ? 'param-trade-name' : field.key === 'inn' ? 'param-inn' : field.key === 'dosage' ? 'param-dosage' : 'param-dosage-form'] as string;
    const valuesMap: { source: string; text: string }[] = [];
    for (const [sourceName, file] of field.sources) {
      const val = sourceName === 'Заявление' ? appValue : file ? extract(file, field.key) : undefined;
      if (val) valuesMap.push({ source: sourceName, text: val });
    }
    const distinct = Array.from(new Set(valuesMap.map((v) => normalize(v.text)))).filter(Boolean);
    if (distinct.length > 1) {
      findings.push(
        createFinding(
          'serious',
          'Расхождения между документами',
          `Расхождение поля «${field.label}» между документами`,
          `Значения поля «${field.label}» не совпадают в загруженных документах.`,
          valuesMap.map((v) => v.source),
          `Приведите поле «${field.label}» к единому значению во всех документах.`,
          valuesMap,
          'Решение Совета ЕЭК № 88; Приказ ҚР ДСМ-10, Приложение 4'
        )
      );
    }
  }

  // 6. Shelf life consistency
  if (spcRu && instrRu) {
    const spcShelf = extract(spcRu, 'shelfLife');
    const instrShelf = extract(instrRu, 'shelfLife');
    if (spcShelf && instrShelf && normalize(spcShelf) !== normalize(instrShelf)) {
      findings.push(
        createFinding(
          'serious',
          'Расхождения между документами',
          'Разные сроки годности в ОХЛП и инструкции',
          `В ОХЛП указан срок годности «${spcShelf}», а в инструкции — «${instrShelf}».`,
          [getDocName('doc-spc-ru'), getDocName('doc-instruction-ru')],
          'Проверьте данные стабильности и приведите сроки годности к единому значению.',
          [
            { source: getDocName('doc-spc-ru'), text: spcShelf },
            { source: getDocName('doc-instruction-ru'), text: instrShelf },
          ],
          'Решение Совета ЕЭК № 88, раздел 6.3'
        )
      );
    }
  }

  if (spcRu && qualityNd) {
    const spcShelf = extract(spcRu, 'shelfLife');
    const ndShelf = extract(qualityNd, 'shelfLife');
    if (spcShelf && ndShelf && normalize(spcShelf) !== normalize(ndShelf)) {
      findings.push(
        createFinding(
          'serious',
          'Расхождения между документами',
          'Срок годности в НДК не совпадает с ОХЛП',
          `В ОХЛП: «${spcShelf}». В нормативном документе по качеству: «${ndShelf}».`,
          [getDocName('doc-spc-ru'), getDocName('doc-quality-nd')],
          'Обеспечьте согласованность срока годности в НДК и ОХЛП.',
          [
            { source: getDocName('doc-spc-ru'), text: spcShelf },
            { source: getDocName('doc-quality-nd'), text: ndShelf },
          ],
          'Решение Совета ЕЭК № 88, раздел 6.3'
        )
      );
    }
  }

  // 7. Storage consistency
  if (spcRu && instrRu) {
    const spcStorage = extract(spcRu, 'storage');
    const instrStorage = extract(instrRu, 'storage');
    if (spcStorage && instrStorage && normalize(spcStorage) !== normalize(instrStorage)) {
      findings.push(
        createFinding(
          'serious',
          'Расхождения между документами',
          'Разные условия хранения в ОХЛП и инструкции',
          `В ОХЛП: «${spcStorage}». В инструкции: «${instrStorage}».`,
          [getDocName('doc-spc-ru'), getDocName('doc-instruction-ru')],
          'Приведите условия хранения к единому значению.',
          [
            { source: getDocName('doc-spc-ru'), text: spcStorage },
            { source: getDocName('doc-instruction-ru'), text: instrStorage },
          ],
          'Решение Совета ЕЭК № 88, п. 102'
        )
      );
    }
  }

  if (spcRu && mockup) {
    const spcStorage = extract(spcRu, 'storage');
    const mockupStorage = extract(mockup, 'storage');
    if (spcStorage && mockupStorage && normalize(spcStorage) !== normalize(mockupStorage)) {
      findings.push(
        createFinding(
          'warning',
          'Расхождения между документами',
          'Условия хранения в макете отличаются от ОХЛП',
          `В ОХЛП: «${spcStorage}». В макете упаковки: «${mockupStorage}».`,
          [getDocName('doc-spc-ru'), getDocName('doc-mockup')],
          'Уточните актуальные условия хранения и приведите макет в соответствие.',
          [
            { source: getDocName('doc-spc-ru'), text: spcStorage },
            { source: getDocName('doc-mockup'), text: mockupStorage },
          ],
          'Решение Совета ЕЭК № 88, п. 102'
        )
      );
    }
  }

  // 8. Labeling text vs mockup
  if (labeling && mockup) {
    const mockupTrade = extract(mockup, 'tradeName');
    const mockupDosage = extract(mockup, 'dosage');
    const labelText = labeling.name; // we don't extract labeling text yet; use file content placeholder
    if (mockupTrade || mockupDosage) {
      // placeholder check; could be expanded with OCR/AI extraction of labeling text
    }
  }

  // 9. RU / KZ length consistency
  const spcKz = findFile(app, 'doc-spc-kz');
  const instrKz = findFile(app, 'doc-instruction-kz');
  if (spcRu && spcKz) {
    const ruLen = parseInt(extract(spcRu, 'textLength') || '0', 10);
    const kzLen = parseInt(extract(spcKz, 'textLength') || '0', 10);
    if (ruLen && kzLen && Math.abs(ruLen - kzLen) / Math.max(ruLen, kzLen) > 0.4) {
      findings.push(
        createFinding(
          'warning',
          'Перевод',
          'Значительное расхождение объёма ОХЛП RU и KZ',
          `ОХЛП (русский): ${ruLen} знаков, ОХЛП (казахский): ${kzLen} знаков. Перевод может быть неполным.`,
          [getDocName('doc-spc-ru'), getDocName('doc-spc-kz')],
          'Проверьте полноту перевода ОХЛП на казахский язык.',
          undefined,
          'Решение Совета ЕЭК № 88; Приказ ҚР ДСМ-10, Приложение 4'
        )
      );
    }
  }
  if (instrRu && instrKz) {
    const ruLen = parseInt(extract(instrRu, 'textLength') || '0', 10);
    const kzLen = parseInt(extract(instrKz, 'textLength') || '0', 10);
    if (ruLen && kzLen && Math.abs(ruLen - kzLen) / Math.max(ruLen, kzLen) > 0.4) {
      findings.push(
        createFinding(
          'warning',
          'Перевод',
          'Значительное расхождение объёма инструкции RU и KZ',
          `Инструкция (русский): ${ruLen} знаков, инструкция (казахский): ${kzLen} знаков.`,
          [getDocName('doc-instruction-ru'), getDocName('doc-instruction-kz')],
          'Проверьте полноту перевода инструкции на казахский язык.',
          undefined,
          'Решение Совета ЕЭК № 88; Приказ ҚР ДСМ-10, Приложение 4'
        )
      );
    }
  }

  // 9.1. Formatting and structural checks for SPC and instruction
  if (spcRu) {
    checkDocxFormatting(spcRu, getDocName('doc-spc-ru'), findings, 'Решение Совета ЕЭК № 88');
    checkRequiredSections(
      spcRu,
      getDocName('doc-spc-ru'),
      SPC_REQUIRED_SECTIONS,
      findings,
      'Решение Совета ЕЭК № 88'
    );
  }
  if (instrRu) {
    checkDocxFormatting(instrRu, getDocName('doc-instruction-ru'), findings, 'Решение Совета ЕЭК № 88');
    checkRequiredSections(
      instrRu,
      getDocName('doc-instruction-ru'),
      INSTRUCTION_REQUIRED_SECTIONS,
      findings,
      'Решение Совета ЕЭК № 88'
    );
  }

  // 9.2. Black triangle / additional monitoring
  if (values['param-additional-monitoring'] === 'yes' && instrRu) {
    checkBlackTriangle(instrRu, getDocName('doc-instruction-ru'), findings, 'Решение Совета ЕЭК № 88');
  }

  // 10. Generic bioequivalence
  if (productType === 'generic') {
    const hasReport = findFile(app, 'doc-bioequivalence-report');
    const hasWaiver = findFile(app, 'doc-bioequivalence-waiver');
    if (!hasReport && !hasWaiver) {
      findings.push(
        createFinding(
          'critical',
          'Комплектность',
          'Отсутствует отчет биоэквивалентности',
          `Для ${productLabel} препарата должен быть представлен отчет об исследовании биоэквивалентности или обоснование отсутствия таковой.`,
          [getDocName('doc-bioequivalence-report'), getDocName('doc-bioequivalence-waiver')],
          'Запросите отчёт биоэквивалентности или обоснование биовейвера.',
          undefined,
          'Решение Совета ЕЭК № 85, п. 4; Приказ ҚР ДСМ-10, Приложение 4'
        )
      );
    }
  }

  // 11. Biological / biosimilar RMP
  if (['biological', 'biosimilar'].includes(productType)) {
    const hasRmp = findFile(app, 'doc-risk-management');
    if (!hasRmp) {
      findings.push(
        createFinding(
          'critical',
          'Комплектность',
          `Отсутствует план управления рисками для ${productLabel} препарата`,
          `Для ${productLabel.toLowerCase()} препаратов требуется план управления рисками.`,
          [getDocName('doc-risk-management')],
          'Запросите план управления рисками.',
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 3, 1.6.3'
        )
      );
    }
  }

  // 12. BE report consistency if present
  const beReport = findFile(app, 'doc-bioequivalence-report');
  if (beReport) {
    const refProduct = extract(beReport, 'referenceProduct');
    const beDosage = extract(beReport, 'dosage');
    const appDosage = values['param-dosage'] as string;
    if (beDosage && appDosage && normalize(beDosage) !== normalize(appDosage)) {
      findings.push(
        createFinding(
          'serious',
          'Биоэквивалентность',
          'Дозировка в отчёте биоэквивалентности не совпадает с заявлением',
          `В заявлении: «${appDosage}». В отчёте БЭ: «${beDosage}».`,
          [getDocName('doc-bioequivalence-report'), 'Заявление'],
          'Проверьте, что исследование биоэквивалентности проведено для заявленной дозировки.',
          [
            { source: 'Заявление', text: appDosage },
            { source: getDocName('doc-bioequivalence-report'), text: beDosage },
          ],
          'Решение Совета ЕЭК № 85'
        )
      );
    }
    const beDosageForm = extract(beReport, 'dosageForm');
    const appDosageForm = values['param-dosage-form'] as string;
    if (beDosageForm && appDosageForm && normalize(beDosageForm) !== normalize(appDosageForm)) {
      findings.push(
        createFinding(
          'serious',
          'Биоэквивалентность',
          'Лекарственная форма в отчёте биоэквивалентности не совпадает с заявлением',
          `В заявлении: «${appDosageForm}». В отчёте БЭ: «${beDosageForm}».`,
          [getDocName('doc-bioequivalence-report'), 'Заявление'],
          'Проверьте, что исследование биоэквивалентности проведено для заявленной лекарственной формы.',
          [
            { source: 'Заявление', text: appDosageForm },
            { source: getDocName('doc-bioequivalence-report'), text: beDosageForm },
          ],
          'Решение Совета ЕЭК № 85'
        )
      );
    }
    if (!refProduct) {
      findings.push(
        createFinding(
          'warning',
          'Биоэквивалентность',
          'Не указан референтный препарат в отчёте биоэквивалентности',
          'В отчёте не удалось идентифицировать референтный препарат.',
          [getDocName('doc-bioequivalence-report')],
          'Укажите референтный препарат в отчёте.',
          undefined,
          'Решение Совета ЕЭК № 85'
        )
      );
    }
    const conclusion = extract(beReport, 'conclusion');
    if (conclusion && !/подтвержден|успеш|положител/i.test(conclusion)) {
      findings.push(
        createFinding(
          'serious',
          'Биоэквивалентность',
          'Вывод отчёта биоэквивалентности неподтверждающий',
          `Вывод в отчёте: «${conclusion}». Требуется подтверждение биоэквивалентности.`,
          [getDocName('doc-bioequivalence-report')],
          'Предоставьте положительный отчёт биоэквивалентности или обоснуйте отсутствие исследования.',
          undefined,
          'Решение Совета ЕЭК № 85'
        )
      );
    }
  }

  // 12.1 Bioequivalence waiver check
  const beWaiver = findFile(app, 'doc-bioequivalence-waiver');
  if (beWaiver) {
    const waiverReason = extract(beWaiver, 'waiverReason');
    const justified = extract(beWaiver, 'justified');
    const waiverDosageForm = extract(beWaiver, 'dosageForm');
    const appDosageForm = values['param-dosage-form'] as string;
    if (!waiverReason) {
      findings.push(
        createFinding(
          'serious',
          'Биоэквивалентность',
          'В обосновании отсутствия биоэквивалентности не указана причина',
          'Для биовейвера необходимо обосновать, почему исследование биоэквивалентности не требуется.',
          [getDocName('doc-bioequivalence-waiver')],
          'Укажите причину отсутствия биоэквивалентности (например, класс растворимости/проницаемости BCS).',
          undefined,
          'Решение Совета ЕЭК № 85'
        )
      );
    }
    if (justified && normalize(justified) !== 'да') {
      findings.push(
        createFinding(
          'serious',
          'Биоэквивалентность',
          'Обоснование отсутствия биоэквивалентности не признано достаточным',
          'В документе отмечено, что обоснование недостаточно.',
          [getDocName('doc-bioequivalence-waiver')],
          'Дополните обоснование или предоставьте отчёт об исследовании биоэквивалентности.',
          undefined,
          'Решение Совета ЕЭК № 85'
        )
      );
    }
    if (waiverDosageForm && appDosageForm && normalize(waiverDosageForm) !== normalize(appDosageForm)) {
      findings.push(
        createFinding(
          'serious',
          'Биоэквивалентность',
          'Лекарственная форма в биовейвере не совпадает с заявлением',
          `В заявлении: «${appDosageForm}». В обосновании: «${waiverDosageForm}».`,
          [getDocName('doc-bioequivalence-waiver'), 'Заявление'],
          'Проверьте, что биовейвер относится к заявленной лекарственной форме.',
          [
            { source: 'Заявление', text: appDosageForm },
            { source: getDocName('doc-bioequivalence-waiver'), text: waiverDosageForm },
          ],
          'Решение Совета ЕЭК № 85'
        )
      );
    }
  }

  // 13. File size / corruption sanity check
  for (const file of app.files) {
    if (file.size < 512) {
      findings.push(
        createFinding(
          'warning',
          'Файлы и форматы',
          `Файл слишком маленький: ${file.name}`,
          `Размер файла ${file.name} составляет ${file.size} байт, что нетипично для полноценного документа.`,
          [getDocName(file.documentTypeId)],
          'Проверьте файл на целостность и загрузите полную версию.',
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 3'
        )
      );
    }
  }

  // 14. Labeling text vs mockup / application
  const labelingText = findFile(app, 'doc-labeling-text');
  if (labelingText) {
    const textContent = extract(labelingText, 'textContent') || '';
    const appTrade = values['param-trade-name'] as string;
    const appInn = values['param-inn'] as string;
    const appDosage = values['param-dosage'] as string;
    const missing: string[] = [];
    if (appTrade && !normalize(textContent).includes(normalize(appTrade))) missing.push('торговое наименование');
    if (appInn && !normalize(textContent).includes(normalize(appInn))) missing.push('МНН');
    if (appDosage && !normalize(textContent).includes(normalize(appDosage))) missing.push('дозировку');
    if (missing.length > 0) {
      findings.push(
        createFinding(
          'warning',
          'Маркировка',
          'Текст маркировки не содержит обязательные элементы',
          `В тексте маркировки не найдены: ${missing.join(', ')}.`,
          [getDocName('doc-labeling-text')],
          'Дополните текст маркировки недостающими обязательными элементами.',
          [{ source: getDocName('doc-labeling-text'), text: textContent }],
          'Решение Совета ЕЭК № 88, п. 102'
        )
      );
    }
  }

  // 15. CPP issue date not too old
  if (cpp) {
    const cppIssue = extract(cpp, 'issueDate');
    const issueDate = cppIssue ? parseDate(cppIssue) : null;
    if (issueDate) {
      const years = (Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (years > 5) {
        findings.push(
          createFinding(
            'warning',
            'CPP / регистрация',
            'CPP выдан более 5 лет назад',
            `Дата выдачи CPP: ${cppIssue}. Убедитесь, что сертификат всё ещё действителен и отражает актуальную регистрацию.`,
            [getDocName('doc-cpp')],
            'Проверьте актуальность CPP или предоставьте более свежий документ.',
            [{ source: getDocName('doc-cpp'), text: cppIssue! }],
            'Решение Совета ЕЭК № 78'
          )
        );
      }
    }
  }

  // 16. CPP country vs manufacturer country
  if (cpp && gmp) {
    const cppCountry = extract(cpp, 'country');
    const gmpAddress = extract(gmp, 'address') || (values['param-manufacturer-address'] as string);
    if (cppCountry && gmpAddress && !normalize(gmpAddress).includes(normalize(cppCountry))) {
      findings.push(
        createFinding(
          'warning',
          'CPP / регистрация',
          'Страна CPP не совпадает со страной производства',
          `CPP выдан в: «${cppCountry}». Адрес производства: «${gmpAddress}».`,
          [getDocName('doc-cpp'), getDocName('doc-gmp')],
          'Убедитесь, что CPP соответствует стране производства, или предоставьте обоснование.',
          [
            { source: getDocName('doc-cpp'), text: cppCountry },
            { source: getDocName('doc-gmp'), text: gmpAddress },
          ],
          'Решение Совета ЕЭК № 78'
        )
      );
    }
  }

  // 17. Stability data supports SPC shelf life
  const stability = findFile(app, 'doc-stability');
  if (stability && spcRu) {
    const stabilityShelf = extract(stability, 'shelfLife');
    const spcShelf = extract(spcRu, 'shelfLife');
    if (stabilityShelf && spcShelf && normalize(stabilityShelf) !== normalize(spcShelf)) {
      findings.push(
        createFinding(
          'serious',
          'Стабильность',
          'Срок годности в данных по стабильности не совпадает с ОХЛП',
          `В ОХЛП: «${spcShelf}». В данных по стабильности: «${stabilityShelf}».`,
          [getDocName('doc-spc-ru'), getDocName('doc-stability')],
          'Приведите срок годности в данных по стабильности в соответствие с ОХЛП.',
          [
            { source: getDocName('doc-spc-ru'), text: spcShelf },
            { source: getDocName('doc-stability'), text: stabilityShelf },
          ],
          'Решение Совета ЕЭК № 88, раздел 6.3'
        )
      );
    }
  }

  // 18. Module 3 required sections
  const module3 = findFile(app, 'doc-module3');
  if (module3) {
    const requiredSections = [
      { key: 'hasSpecification', label: 'спецификация' },
      { key: 'hasValidation', label: 'валидация методов' },
      { key: 'hasStability', label: 'данные стабильности' },
    ];
    for (const section of requiredSections) {
      const val = extract(module3, section.key);
      if (!val || normalize(val) !== 'да') {
        findings.push(
          createFinding(
            'warning',
            'Качество',
            `В Модуле 3 не подтвержден раздел: ${section.label}`,
            `В Модуле 3 отсутствует или не подтвержден раздел «${section.label}».`,
            [getDocName('doc-module3')],
            `Дополните Модуль 3 разделом «${section.label}».`,
            undefined,
            'Приказ ҚР ДСМ-10, Приложение 4'
          )
        );
      }
    }
  }

  // 19. Foreign registrations include manufacturer country
  const foreign = findFile(app, 'doc-foreign-registrations');
  if (foreign && gmp) {
    const countries = extract(foreign, 'countries') || '';
    const gmpAddress = extract(gmp, 'address') || (values['param-manufacturer-address'] as string);
    const manufacturerCountry = gmpAddress?.split(',').pop()?.trim();
    if (manufacturerCountry && !normalize(countries).includes(normalize(manufacturerCountry))) {
      findings.push(
        createFinding(
          'warning',
          'Регистрация в других странах',
          'Регистрации не включают страну производства',
          `Страна производства: «${manufacturerCountry}». Зарегистрировано в: «${countries}».`,
          [getDocName('doc-foreign-registrations'), getDocName('doc-gmp')],
          'Предоставьте регистрацию в стране производства или обоснование отсутствия таковой.',
          [
            { source: 'Страна производства', text: manufacturerCountry },
            { source: getDocName('doc-foreign-registrations'), text: countries },
          ],
          'Решение Совета ЕЭК № 78'
        )
      );
    }
  }

  // 20. Sterile / aseptic validation if applicable
  if (values['param-sterile'] === 'yes' && module3) {
    const module3Text = extract(module3, 'hasValidation') || '';
    if (!/стерильн|steril/i.test(module3Text)) {
      findings.push(
        createFinding(
          'serious',
          'Стерильность',
          'Отсутствует подтверждение стерильности в Модуле 3',
          'Для стерильного препарата в Модуле 3 должны быть представлены данные валидации стерильности.',
          [getDocName('doc-module3')],
          'Добавьте в Модуль 3 валидацию стерильности.',
          undefined,
          'Решение Совета ЕЭК № 78; Приказ ҚР ДСМ-10, Приложение 4'
        )
      );
    }
  }

  // 21. Re-registration specific checks
  if (procedure === 're-registration') {
    const regCert = findFile(app, 'doc-registration-certificate');
    if (regCert) {
      const certNumber = extract(regCert, 'registrationNumber');
      const appRegNumber = values['param-registration-number'] as string;
      if (appRegNumber && certNumber && normalize(certNumber) !== normalize(appRegNumber)) {
        findings.push(
          createFinding(
            'serious',
            'Перерегистрация',
            'Номер регистрационного удостоверения не совпадает с заявлением',
            `В заявлении указан номер РУ: «${appRegNumber}», в регистрационном удостоверении: «${certNumber}».`,
            [getDocName('doc-registration-certificate'), 'Заявление'],
            'Проверьте, что приложено действующее регистрационное удостоверение на данный препарат.',
            [
              { source: 'Заявление', text: appRegNumber },
              { source: getDocName('doc-registration-certificate'), text: certNumber },
            ],
            'Приказ ҚР ДСМ-10, Приложение 2'
          )
        );
      }
      const certValid = extract(regCert, 'validUntil');
      if (certValid && isExpired(certValid)) {
        findings.push(
          createFinding(
            'critical',
            'Перерегистрация',
            'Регистрационное удостоверение просрочено',
            `Срок действия регистрационного удостоверения: ${certValid}.`,
            [getDocName('doc-registration-certificate')],
            'Предоставьте действующее регистрационное удостоверение.',
            [{ source: getDocName('doc-registration-certificate'), text: certValid }],
            'Приказ ҚР ДСМ-10, Приложение 2'
          )
        );
      }
      const certTrade = extract(regCert, 'tradeName');
      const appTrade = values['param-trade-name'] as string;
      if (certTrade && appTrade && normalize(certTrade) !== normalize(appTrade)) {
        findings.push(
          createFinding(
            'serious',
            'Перерегистрация',
            'Торговое наименование в регистрационном удостоверении отличается от заявления',
            `В заявлении: «${appTrade}». В регистрационном удостоверении: «${certTrade}».`,
            [getDocName('doc-registration-certificate'), 'Заявление'],
            'Приложите регистрационное удостоверение, соответствующее заявленному препарату.',
            [
              { source: 'Заявление', text: appTrade },
              { source: getDocName('doc-registration-certificate'), text: certTrade },
            ],
            'Приказ ҚР ДСМ-10, Приложение 2'
          )
        );
      }
    }

    const postMarketing = findFile(app, 'doc-post-marketing-data');
    if (postMarketing) {
      const reportDate = extract(postMarketing, 'reportDate');
      if (reportDate) {
        const parsed = parseDate(reportDate);
        if (parsed) {
          const years = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365);
          if (years > 5) {
            findings.push(
              createFinding(
                'warning',
                'Перерегистрация',
                'Пострегистрационные данные устарели',
                `Дата пострегистрационного отчёта: ${reportDate} (более 5 лет назад).`,
                [getDocName('doc-post-marketing-data')],
                'Предоставьте актуальные пострегистрационные данные по безопасности и эффективности.',
                [{ source: getDocName('doc-post-marketing-data'), text: reportDate }],
                'Приказ ҚР ДСМ-10, Приложение 2'
              )
            );
          }
        }
      }
    }
  }

  // 22. Variation specific checks
  if (procedure === 'variation') {
    const variationDesc = findFile(app, 'doc-variation-description');
    const variationJust = findFile(app, 'doc-variation-justification');
    const variationComparison = findFile(app, 'doc-variation-comparison');
    const currentSpc = findFile(app, 'doc-current-spc-ru');
    const updatedSpc = findFile(app, 'doc-updated-spc-ru');
    const updatedSpcKz = findFile(app, 'doc-updated-spc-kz');

    const appOldValue = values['param-variation-old-value'] as string;
    const appNewValue = values['param-variation-new-value'] as string;
    const appClass = values['param-variation-class'] as string;
    const appArea = values['param-variation-area'] as string;

    if (variationDesc) {
      const vClass = extract(variationDesc, 'variationClass');
      if (appClass && vClass && normalize(vClass) !== normalize(appClass)) {
        findings.push(
          createFinding(
            'serious',
            'Внесение изменений',
            'Класс изменения в описании не совпадает с заявлением',
            `В заявлении указан класс: «${appClass}», в описании изменений: «${vClass}».`,
            [getDocName('doc-variation-description'), 'Заявление'],
            'Приведите класс изменения в соответствие с классификатором Решения № 65.',
            [
              { source: 'Заявление', text: appClass },
              { source: getDocName('doc-variation-description'), text: vClass },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      const vArea = extract(variationDesc, 'variationArea');
      if (appArea && vArea && normalize(vArea) !== normalize(appArea)) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Область изменения в описании не совпадает с заявлением',
            `В заявлении область: «${appArea}», в описании изменений: «${vArea}».`,
            [getDocName('doc-variation-description'), 'Заявление'],
            'Уточните область изменений в описании или в параметрах заявки.',
            [
              { source: 'Заявление', text: appArea },
              { source: getDocName('doc-variation-description'), text: vArea },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      const oldValue = extract(variationDesc, 'oldValue');
      const newValue = extract(variationDesc, 'newValue');
      if (!oldValue || !newValue) {
        findings.push(
          createFinding(
            'serious',
            'Внесение изменений',
            'В описании изменений не указаны старое и/или новое значение',
            'Для внесения изменений необходимо чётко зафиксировать текущее и планируемое значение.',
            [getDocName('doc-variation-description')],
            'Дополните описание изменений полями «старое значение» и «новое значение».',
            undefined,
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      if (appOldValue && oldValue && normalize(appOldValue) !== normalize(oldValue)) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Старое значение в описании не совпадает с заявлением',
            `В заявлении: «${appOldValue}», в описании изменений: «${oldValue}».`,
            [getDocName('doc-variation-description'), 'Заявление'],
            'Приведите старое значение в описании в соответствие с заявкой.',
            [
              { source: 'Заявление', text: appOldValue },
              { source: getDocName('doc-variation-description'), text: oldValue },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      if (appNewValue && newValue && normalize(appNewValue) !== normalize(newValue)) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Новое значение в описании не совпадает с заявлением',
            `В заявлении: «${appNewValue}», в описании изменений: «${newValue}».`,
            [getDocName('doc-variation-description'), 'Заявление'],
            'Приведите новое значение в описании в соответствие с заявкой.',
            [
              { source: 'Заявление', text: appNewValue },
              { source: getDocName('doc-variation-description'), text: newValue },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
    }

    if (variationComparison) {
      const compOld = extract(variationComparison, 'oldValue');
      const compNew = extract(variationComparison, 'newValue');
      if (!compOld || !compNew) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Сравнительная таблица не содержит старое/новое значение',
            'В сравнительной таблице должны быть чётко указаны старое и новое значения изменения.',
            [getDocName('doc-variation-comparison')],
            'Дополните сравнительную таблицу недостающими значениями.',
            undefined,
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      if (appOldValue && compOld && normalize(appOldValue) !== normalize(compOld)) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Старое значение в сравнительной таблице не совпадает с заявлением',
            `В заявлении: «${appOldValue}», в таблице: «${compOld}».`,
            [getDocName('doc-variation-comparison'), 'Заявление'],
            'Приведите сравнительную таблицу в соответствие с заявленными значениями.',
            [
              { source: 'Заявление', text: appOldValue },
              { source: getDocName('doc-variation-comparison'), text: compOld },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      if (appNewValue && compNew && normalize(appNewValue) !== normalize(compNew)) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Новое значение в сравнительной таблице не совпадает с заявлением',
            `В заявлении: «${appNewValue}», в таблице: «${compNew}».`,
            [getDocName('doc-variation-comparison'), 'Заявление'],
            'Приведите сравнительную таблицу в соответствие с заявленными значениями.',
            [
              { source: 'Заявление', text: appNewValue },
              { source: getDocName('doc-variation-comparison'), text: compNew },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
    }

    if (!variationJust) {
      findings.push(
        createFinding(
          'serious',
          'Внесение изменений',
          'Отсутствует обоснование изменений',
          'Для изменений класса IB и II требуется обоснование.',
          [getDocName('doc-variation-justification')],
          'Загрузите обоснование изменений.',
          undefined,
          'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
        )
      );
    } else {
      const justification = extract(variationJust, 'justificationText');
      if (!justification) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Не удалось извлечь обоснование изменений',
            'В документе не найден текст обоснования.',
            [getDocName('doc-variation-justification')],
            'Проверьте, что обоснование изменений оформлено отдельным блоком текста.',
            undefined,
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
    }

    if (currentSpc && updatedSpc) {
      const currentTrade = extract(currentSpc, 'tradeName');
      const updatedTrade = extract(updatedSpc, 'tradeName');
      if (currentTrade && updatedTrade && normalize(currentTrade) !== normalize(updatedTrade)) {
        findings.push(
          createFinding(
            'serious',
            'Внесение изменений',
            'Торговое наименование изменено без обоснования',
            `В действующей ОХЛП: «${currentTrade}», в проекте ОХЛП: «${updatedTrade}».`,
            [getDocName('doc-current-spc-ru'), getDocName('doc-updated-spc-ru')],
            'Изменение торгового наименования требует отдельного обоснования и, как правило, относится к классу II.',
            [
              { source: getDocName('doc-current-spc-ru'), text: currentTrade },
              { source: getDocName('doc-updated-spc-ru'), text: updatedTrade },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      const currentInn = extract(currentSpc, 'inn');
      const updatedInn = extract(updatedSpc, 'inn');
      if (currentInn && updatedInn && normalize(currentInn) !== normalize(updatedInn)) {
        findings.push(
          createFinding(
            'serious',
            'Внесение изменений',
            'МНН изменено без обоснования',
            `В действующей ОХЛП: «${currentInn}», в проекте ОХЛП: «${updatedInn}».`,
            [getDocName('doc-current-spc-ru'), getDocName('doc-updated-spc-ru')],
            'Изменение МНН — существенное изменение, требует обоснования и, скорее всего, новой регистрации.',
            [
              { source: getDocName('doc-current-spc-ru'), text: currentInn },
              { source: getDocName('doc-updated-spc-ru'), text: updatedInn },
            ],
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      const updatedChanged = extract(updatedSpc, 'changedValue') || extract(updatedSpc, 'newValue');
      if (!updatedChanged) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'В проекте ОХЛП не выделено изменённое значение',
            'Убедитесь, что в проекте ОХЛП с изменениями указано, какой именно параметр изменён.',
            [getDocName('doc-updated-spc-ru')],
            'Добавьте в проект ОХЛП явное указание изменённого значения.',
            undefined,
            'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
          )
        );
      }
      if (appOldValue) {
        const currentText = extract(currentSpc, 'textContent') || '';
        if (currentText && !normalize(currentText).includes(normalize(appOldValue))) {
          findings.push(
            createFinding(
              'warning',
              'Внесение изменений',
              'Старое значение не найдено в действующей ОХЛП',
              `В заявлении старое значение: «${appOldValue}», но оно не обнаружено в тексте действующей ОХЛП.`,
              [getDocName('doc-current-spc-ru'), 'Заявление'],
              'Убедитесь, что старое значение действительно присутствует в текущей ОХЛП.',
              [
                { source: 'Заявление', text: appOldValue },
                { source: getDocName('doc-current-spc-ru'), text: currentText.slice(0, 200) },
              ],
              'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
            )
          );
        }
      }
      if (appNewValue) {
        const updatedText = extract(updatedSpc, 'textContent') || '';
        if (updatedText && !normalize(updatedText).includes(normalize(appNewValue))) {
          findings.push(
            createFinding(
              'warning',
              'Внесение изменений',
              'Новое значение не найдено в проекте ОХЛП',
              `В заявлении новое значение: «${appNewValue}», но оно не обнаружено в тексте проекта ОХЛП.`,
              [getDocName('doc-updated-spc-ru'), 'Заявление'],
              'Убедитесь, что новое значение отражено в проекте ОХЛП.',
              [
                { source: 'Заявление', text: appNewValue },
                { source: getDocName('doc-updated-spc-ru'), text: updatedText.slice(0, 200) },
              ],
              'Решение Совета ЕЭК № 65; Приказ ҚР ДСМ-10'
            )
          );
        }
      }
    }

    if (updatedSpc && updatedSpcKz) {
      const ruChanged = extract(updatedSpc, 'changedValue') || extract(updatedSpc, 'newValue');
      const kzChanged = extract(updatedSpcKz, 'changedValue') || extract(updatedSpcKz, 'newValue');
      if (ruChanged && kzChanged && normalize(ruChanged) !== normalize(kzChanged)) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Изменённое значение в RU и KZ версиях проекта ОХЛП не совпадает',
            `RU: «${ruChanged}», KZ: «${kzChanged}».`,
            [getDocName('doc-updated-spc-ru'), getDocName('doc-updated-spc-kz')],
            'Приведите RU и KZ версии проекта ОХЛП в соответствие.',
            [
              { source: getDocName('doc-updated-spc-ru'), text: ruChanged },
              { source: getDocName('doc-updated-spc-kz'), text: kzChanged },
            ],
            'Решение Совета ЕЭК № 88; Приказ ҚР ДСМ-10'
          )
        );
      }
    }

    if ((appArea === 'quality' || appArea === 'spc') && updatedSpc) {
      const stability = findFile(app, 'doc-stability');
      const updatedShelf = extract(updatedSpc, 'shelfLife');
      if (updatedShelf && stability) {
        const stabilityShelf = extract(stability, 'shelfLife');
        if (stabilityShelf && normalize(updatedShelf) !== normalize(stabilityShelf)) {
          findings.push(
            createFinding(
              'serious',
              'Внесение изменений',
              'Срок годности в проекте ОХЛП не согласован с данными стабильности',
              `В проекте ОХЛП: «${updatedShelf}». В данных стабильности: «${stabilityShelf}».`,
              [getDocName('doc-updated-spc-ru'), getDocName('doc-stability')],
              'Обеспечьте согласованность срока годности с данными стабильности.',
              [
                { source: getDocName('doc-updated-spc-ru'), text: updatedShelf },
                { source: getDocName('doc-stability'), text: stabilityShelf },
              ],
              'Решение Совета ЕЭК № 88'
            )
          );
        }
      }
    }

    if (appArea === 'manufacturing' && updatedSpc) {
      const gmp = findFile(app, 'doc-gmp');
      const updatedSpcManufacturer = extract(updatedSpc, 'manufacturer');
      if (gmp && updatedSpcManufacturer) {
        const gmpManufacturer = extract(gmp, 'manufacturer');
        if (gmpManufacturer && normalize(gmpManufacturer) !== normalize(updatedSpcManufacturer)) {
          findings.push(
            createFinding(
              'serious',
              'Внесение изменений',
              'Производитель в проекте ОХЛП не совпадает с GMP',
              `В проекте ОХЛП: «${updatedSpcManufacturer}». В GMP: «${gmpManufacturer}».`,
              [getDocName('doc-updated-spc-ru'), getDocName('doc-gmp')],
              'При изменении производителя предоставьте действующий GMP на обновлённую площадку.',
              [
                { source: getDocName('doc-updated-spc-ru'), text: updatedSpcManufacturer },
                { source: getDocName('doc-gmp'), text: gmpManufacturer },
              ],
              'Решение Совета ЕЭК № 77; Приказ ҚР ДСМ-10'
            )
          );
        }
      }
    }

    if (appArea === 'labeling' || appArea === 'spc') {
      const labelingText = findFile(app, 'doc-labeling-text');
      const mockup = findFile(app, 'doc-mockup');
      if (!labelingText) {
        findings.push(
          createFinding(
            'serious',
            'Внесение изменений',
            'Для изменения маркировки/ОХЛП отсутствует текст маркировки',
            'При изменении ОХЛП или маркировки необходимо предоставить обновлённый текст маркировки.',
            [getDocName('doc-labeling-text')],
            'Загрузите текст маркировки с внесёнными изменениями.',
            undefined,
            'Приказ ҚР ДСМ-11; Решение Совета ЕЭК № 88'
          )
        );
      } else if (appNewValue) {
        const labelContent = extract(labelingText, 'textContent') || labelingText.name;
        if (!normalize(labelContent).includes(normalize(appNewValue))) {
          findings.push(
            createFinding(
              'warning',
              'Внесение изменений',
              'Новое значение не отражено в тексте маркировки',
              `В заявлении новое значение: «${appNewValue}», но оно не найдено в тексте маркировки.`,
              [getDocName('doc-labeling-text'), 'Заявление'],
              'Убедитесь, что текст маркировки содержит обновлённое значение.',
              [
                { source: 'Заявление', text: appNewValue },
                { source: getDocName('doc-labeling-text'), text: labelContent.slice(0, 200) },
              ],
              'Приказ ҚР ДСМ-11; Решение Совета ЕЭК № 88'
            )
          );
        }
      }
      if (!mockup) {
        findings.push(
          createFinding(
            'warning',
            'Внесение изменений',
            'Для изменения маркировки рекомендуется обновлённый макет упаковки',
            'При изменении текста маркировки/ОХЛП макет упаковки помогает проверить корректность отображения.',
            [getDocName('doc-mockup')],
            'Загрузите обновлённый макет упаковки.',
            undefined,
            'Приказ ҚР ДСМ-11; Решение Совета ЕЭК № 88'
          )
        );
      }
    }
  }

  // 23. Medical device (MI) specific checks
  if (objectType === 'MI') {
    const miApplication = findFile(app, 'doc-mi-application');
    const miDossier = findFile(app, 'doc-mi-registration-dossier');
    const miInstructions = findFile(app, 'doc-mi-instructions');
    const miLabeling = findFile(app, 'doc-mi-labeling');
    const miQms = findFile(app, 'doc-mi-qms-certificate');
    const miCert = findFile(app, 'doc-mi-registration-certificate');
    const miRiskClass = values['param-mi-risk-class'] as string;
    const miType = values['param-mi-type'] as string;
    const isImplantable = values['param-mi-implantable'] === 'yes';

    if (miApplication) {
      const appTrade = values['param-trade-name'] as string;
      const docTrade = extract(miApplication, 'tradeName');
      if (appTrade && docTrade && normalize(appTrade) !== normalize(docTrade)) {
        findings.push(
          createFinding(
            'serious',
            'Медицинское изделие',
            'Наименование МИ в заявлении не совпадает с документом',
            `В заявлении: «${appTrade}», в заявлении на регистрацию МИ: «${docTrade}».`,
            [getDocName('doc-mi-application'), 'Заявление'],
            'Приведите наименование в документах к единому значению.',
            [
              { source: 'Заявление', text: appTrade },
              { source: getDocName('doc-mi-application'), text: docTrade },
            ],
            'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
          )
        );
      }
    }

    if (miDossier) {
      const dossierRisk = extract(miDossier, 'riskClass');
      if (miRiskClass && dossierRisk && normalize(dossierRisk) !== normalize(miRiskClass)) {
        findings.push(
          createFinding(
            'warning',
            'Медицинское изделие',
            'Класс риска в досье не совпадает с заявлением',
            `В заявлении: «${miRiskClass}», в досье: «${dossierRisk}».`,
            [getDocName('doc-mi-registration-dossier'), 'Заявление'],
            'Уточните класс риска в регистрационном досье.',
            [
              { source: 'Заявление', text: miRiskClass },
              { source: getDocName('doc-mi-registration-dossier'), text: dossierRisk },
            ],
            'Решение Совета ЕЭК № 46; Решение Совета ЕЭК № 173'
          )
        );
      }
    }

    if (procedure === 'registration') {
      if (['IIa', 'IIb', 'III'].includes(miRiskClass)) {
        const hasBiological = findFile(app, 'doc-mi-biological-studies');
        const hasClinical = findFile(app, 'doc-mi-clinical-trials');
        if (!hasBiological && !isImplantable) {
          findings.push(
            createFinding(
              'warning',
              'Медицинское изделие',
              `Для МИ класса ${miRiskClass} рекомендуются исследования биологического действия`,
              'Для МИ повышенного класса риска необходимо подтвердить биологическую безопасность.',
              [getDocName('doc-mi-biological-studies')],
              'Предоставьте протокол исследований биологического действия.',
              undefined,
              'Решение Совета ЕЭК № 38; Решение Совета ЕЭК № 46'
            )
          );
        }
        if (!hasClinical && (miType === 'ivd' || miType === 'implantable' || miRiskClass === 'III')) {
          findings.push(
            createFinding(
              'warning',
              'Медицинское изделие',
              `Для данного типа/класса МИ рекомендуются клинические испытания`,
              'Для IVD, имплантируемых и изделий класса III требуются клинические или клинико-лабораторные испытания.',
              [getDocName('doc-mi-clinical-trials')],
              'Предоставьте протокол клинических испытаний.',
              undefined,
              'Решение Совета ЕЭК № 29; Решение Совета ЕЭК № 46'
            )
          );
        }
      }
    }

    if (miQms) {
      const qmsValid = extract(miQms, 'validUntil');
      if (qmsValid && isExpired(qmsValid)) {
        findings.push(
          createFinding(
            'critical',
            'Медицинское изделие',
            'Сертификат СМК МИ просрочен',
            `Срок действия сертификата СМК: ${qmsValid}.`,
            [getDocName('doc-mi-qms-certificate')],
            'Предоставьте действующий сертификат СМК или декларацию соответствия.',
            [{ source: getDocName('doc-mi-qms-certificate'), text: qmsValid }],
            'Решение Совета ЕЭК № 106; Приказ ҚР ДСМ-315'
          )
        );
      }
    }

    if (procedure === 're-registration' || procedure === 'variation') {
      if (miCert) {
        const certNumber = extract(miCert, 'registrationNumber');
        const appNumber = values['param-mi-registration-number'] as string;
        if (appNumber && certNumber && normalize(certNumber) !== normalize(appNumber)) {
          findings.push(
            createFinding(
              'serious',
              'Медицинское изделие',
              'Номер регистрационного удостоверения МИ не совпадает с заявлением',
              `В заявлении: «${appNumber}», в удостоверении: «${certNumber}».`,
              [getDocName('doc-mi-registration-certificate'), 'Заявление'],
              'Проверьте, что приложено действующее регистрационное удостоверение на данное изделие.',
              [
                { source: 'Заявление', text: appNumber },
                { source: getDocName('doc-mi-registration-certificate'), text: certNumber },
              ],
              'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
            )
          );
        }
        const certValid = extract(miCert, 'validUntil');
        if (certValid && isExpired(certValid)) {
          findings.push(
            createFinding(
              'critical',
              'Медицинское изделие',
              'Регистрационное удостоверение МИ просрочено',
              `Срок действия регистрационного удостоверения: ${certValid}.`,
              [getDocName('doc-mi-registration-certificate')],
              'Предоставьте действующее регистрационное удостоверение МИ.',
              [{ source: getDocName('doc-mi-registration-certificate'), text: certValid }],
              'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
            )
          );
        }
      }
    }

    if (procedure === 'variation') {
      const miVariationDesc = findFile(app, 'doc-mi-variation-description');
      const miVariationJust = findFile(app, 'doc-mi-variation-justification');
      const miCurrentInstr = findFile(app, 'doc-mi-current-instructions');
      const miUpdatedInstr = findFile(app, 'doc-mi-updated-instructions');
      const miVariationClass = values['param-mi-variation-class'] as string;
      const miVariationArea = values['param-mi-variation-area'] as string;
      const miOldValue = values['param-mi-variation-old-value'] as string;
      const miNewValue = values['param-mi-variation-new-value'] as string;

      if (miVariationDesc) {
        const vClass = extract(miVariationDesc, 'variationClass');
        if (miVariationClass && vClass && normalize(vClass) !== normalize(miVariationClass)) {
          findings.push(
            createFinding(
              'serious',
              'Медицинское изделие',
              'Класс изменения МИ в описании не совпадает с заявлением',
              `В заявлении: «${miVariationClass}», в описании: «${vClass}».`,
              [getDocName('doc-mi-variation-description'), 'Заявление'],
              'Приведите класс изменения в соответствие с заявкой.',
              [
                { source: 'Заявление', text: miVariationClass },
                { source: getDocName('doc-mi-variation-description'), text: vClass },
              ],
              'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
            )
          );
        }
        const vArea = extract(miVariationDesc, 'variationArea');
        if (miVariationArea && vArea && normalize(vArea) !== normalize(miVariationArea)) {
          findings.push(
            createFinding(
              'warning',
              'Медицинское изделие',
              'Область изменения МИ в описании не совпадает с заявлением',
              `В заявлении: «${miVariationArea}», в описании: «${vArea}».`,
              [getDocName('doc-mi-variation-description'), 'Заявление'],
              'Уточните область изменений.',
              [
                { source: 'Заявление', text: miVariationArea },
                { source: getDocName('doc-mi-variation-description'), text: vArea },
              ],
              'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
            )
          );
        }
      }

      if (miCurrentInstr && miUpdatedInstr) {
        const currentTrade = extract(miCurrentInstr, 'tradeName');
        const updatedTrade = extract(miUpdatedInstr, 'tradeName');
        if (currentTrade && updatedTrade && normalize(currentTrade) !== normalize(updatedTrade)) {
          findings.push(
            createFinding(
              'serious',
              'Медицинское изделие',
              'Наименование МИ изменено без обоснования',
              `В действующей инструкции: «${currentTrade}», в проекте: «${updatedTrade}».`,
              [getDocName('doc-mi-current-instructions'), getDocName('doc-mi-updated-instructions')],
              'Изменение наименования МИ — существенное изменение, требует обоснования.',
              [
                { source: getDocName('doc-mi-current-instructions'), text: currentTrade },
                { source: getDocName('doc-mi-updated-instructions'), text: updatedTrade },
              ],
              'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
            )
          );
        }
        if (miNewValue) {
          const updatedText = extract(miUpdatedInstr, 'textContent') || '';
          if (updatedText && !normalize(updatedText).includes(normalize(miNewValue))) {
            findings.push(
              createFinding(
                'warning',
                'Медицинское изделие',
                'Новое значение не отражено в проекте инструкции МИ',
                `В заявлении новое значение: «${miNewValue}», но оно не найдено в проекте инструкции.`,
                [getDocName('doc-mi-updated-instructions'), 'Заявление'],
                'Убедитесь, что новое значение отражено в проекте инструкции.',
                [
                  { source: 'Заявление', text: miNewValue },
                  { source: getDocName('doc-mi-updated-instructions'), text: updatedText.slice(0, 200) },
                ],
                'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
              )
            );
          }
        }
      }

      if (!miVariationJust) {
        findings.push(
          createFinding(
            'serious',
            'Медицинское изделие',
            'Отсутствует обоснование изменений МИ',
            'Для изменений класса IB и II требуется обоснование.',
            [getDocName('doc-mi-variation-justification')],
            'Загрузите обоснование изменений МИ.',
            undefined,
            'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
          )
        );
      }

      if (miVariationArea === 'quality' || miVariationArea === 'labeling') {
        if (!miLabeling) {
          findings.push(
            createFinding(
              'serious',
              'Медицинское изделие',
              'Для изменения маркировки/инструкции МИ отсутствует текст маркировки',
              'При изменении маркировки или инструкции МИ необходимо предоставить обновлённый текст маркировки.',
              [getDocName('doc-mi-labeling')],
              'Загрузите текст маркировки МИ с внесёнными изменениями.',
              undefined,
              'Решение Совета ЕЭК № 27; Решение Совета ЕЭК № 46'
            )
          );
        } else if (miNewValue) {
          const labelText = extract(miLabeling, 'textContent') || '';
          if (labelText && !normalize(labelText).includes(normalize(miNewValue))) {
            findings.push(
              createFinding(
                'warning',
                'Медицинское изделие',
                'Новое значение не отражено в маркировке МИ',
                `В заявлении новое значение: «${miNewValue}», но оно не найдено в тексте маркировки.`,
                [getDocName('doc-mi-labeling'), 'Заявление'],
                'Убедитесь, что текст маркировки МИ содержит обновлённое значение.',
                [
                  { source: 'Заявление', text: miNewValue },
                  { source: getDocName('doc-mi-labeling'), text: labelText.slice(0, 200) },
                ],
                'Решение Совета ЕЭК № 27; Решение Совета ЕЭК № 46'
              )
            );
          }
        }
      }
    }
  }

  return findings;
}
