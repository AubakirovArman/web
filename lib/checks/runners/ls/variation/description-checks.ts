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

export function runLsVariationDescriptionChecks(context: CheckRunContext) {
  const { app, findings, values } = context;
  const variationDesc = findFile(app, 'doc-variation-description');
  const variationJust = findFile(app, 'doc-variation-justification');
  const variationComparison = findFile(app, 'doc-variation-comparison');
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

}
