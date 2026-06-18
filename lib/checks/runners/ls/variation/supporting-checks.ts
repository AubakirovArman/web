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

export function runLsVariationSupportingChecks(context: CheckRunContext) {
  const { app, findings, values } = context;
  const updatedSpc = findFile(app, 'doc-updated-spc-ru');
  const appArea = values['param-variation-area'] as string;
  const appNewValue = values['param-variation-new-value'] as string;
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
