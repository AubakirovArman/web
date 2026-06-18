import type { UploadedFile } from '@/lib/types';
import type { CheckRunContext } from '@/lib/checks/engine-context';
import {
  createFinding,
  daysUntil,
  extract,
  findFile,
  getApplicationDosage,
  getApplicationInn,
  getApplicationTradeName,
  getDocName,
  getDocType,
  getOptionLabel,
  hasFilledValue,
  isExpired,
  isKazakhstanManufacturer,
  normalize,
  normalizeLoose,
  parseDate,
  parseJsonValue,
  stringValue,
  unitLabel,
} from '@/lib/checks/engine-utils';
import {
  checkBlackTriangle,
  checkDocxFormatting,
  checkRequiredSections,
  fileEvidenceText,
  getModule3EvidenceFiles,
  hasModule3Evidence,
  INSTRUCTION_REQUIRED_SECTIONS,
  SPC_REQUIRED_SECTIONS,
} from '@/lib/checks/engine-file-helpers';

export function runLsConsistencyChecks(context: CheckRunContext) {
  const { app, findings, values } = context;
  const gmp = findFile(app, 'doc-gmp');
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
    const rawAppValue =
      field.key === 'tradeName'
        ? getApplicationTradeName(appData)
        : field.key === 'inn'
          ? getApplicationInn(appData)
          : field.key === 'dosage'
            ? getApplicationDosage(appData)
            : stringValue(appData['param-dosage-form']);
    const appValue = field.key === 'dosageForm' ? getOptionLabel('param-dosage-form', rawAppValue) : rawAppValue;
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

}
