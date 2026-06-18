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
  checkRequiredSections,
  fileEvidenceText,
  getModule3EvidenceFiles,
  hasModule3Evidence,
  INSTRUCTION_REQUIRED_SECTIONS,
  SPC_REQUIRED_SECTIONS,
} from '@/lib/checks/engine-file-helpers';

export function runLsQualitySupportChecks(context: CheckRunContext) {
  const { app, findings, values } = context;
  const spcRu = findFile(app, 'doc-spc-ru');
  const instrRu = findFile(app, 'doc-instruction-ru');
  const qualityNd = findFile(app, 'doc-quality-nd');
  const cpp = findFile(app, 'doc-cpp');
  const gmp = findFile(app, 'doc-gmp');
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
    const appTrade = getApplicationTradeName(values);
    const appInn = getApplicationInn(values);
    const appDosage = getApplicationDosage(values);
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
      { key: 'hasSpecification', label: 'спецификация', evidence: hasModule3Evidence(app, 'specification') },
      { key: 'hasValidation', label: 'валидация методов', evidence: hasModule3Evidence(app, 'validation') },
      { key: 'hasStability', label: 'данные стабильности', evidence: hasModule3Evidence(app, 'stability') },
    ];
    for (const section of requiredSections) {
      const val = extract(module3, section.key);
      if (normalize(val) !== 'да' && !section.evidence) {
        findings.push({
          ...createFinding(
            'warning',
            'Качество',
            `В Модуле 3 не подтвержден раздел: ${section.label}`,
            `В Модуле 3 отсутствует или не подтвержден раздел «${section.label}».`,
            [getDocName('doc-module3')],
            `Дополните Модуль 3 разделом «${section.label}».`,
            undefined,
            'Приказ ҚР ДСМ-10, Приложение 4'
          ),
          checkerId: 'module3_content_check',
          confidence: 0.7,
        });
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
    const module3Text = [extract(module3, 'hasValidation'), extract(module3, 'textContent')].filter(Boolean).join(' ');
    if (!/стерильн|steril|асепт/i.test(module3Text) && !hasModule3Evidence(app, 'sterility')) {
      findings.push({
        ...createFinding(
          'serious',
          'Стерильность',
          'Отсутствует подтверждение стерильности в Модуле 3',
          'Для стерильного препарата в Модуле 3 должны быть представлены данные валидации стерильности.',
          [getDocName('doc-module3')],
          'Добавьте в Модуль 3 валидацию стерильности.',
          undefined,
          'Решение Совета ЕЭК № 78; Приказ ҚР ДСМ-10, Приложение 4'
        ),
        checkerId: 'sterility_validation_check',
        confidence: 0.78,
      });
    }
  }

}
