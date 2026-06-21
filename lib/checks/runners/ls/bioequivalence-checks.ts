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

export function runLsBioequivalenceChecks(context: CheckRunContext) {
  const { app, findings, values, productType, productLabel } = context;
  // 10. Generic bioequivalence — только если исследование требуется по параметрам
  // заявки (для в/в водных растворов, газов и т.п. — биовейвер, отчёт не нужен).
  const bioeqFlag = values['param-bioequivalence-required'];
  const bioeqRequired = bioeqFlag === 'yes' || String(bioeqFlag) === 'true';
  if (productType === 'generic' && bioeqRequired) {
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
    const appDosage = getApplicationDosage(values);
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
    const appDosageForm = getOptionLabel('param-dosage-form', values['param-dosage-form'] as string);
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
    const appDosageForm = getOptionLabel('param-dosage-form', values['param-dosage-form'] as string);
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

}
