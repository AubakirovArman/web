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

export function runLsVariationSpcProjectChecks(context: CheckRunContext) {
  const { app, findings, values } = context;
  const currentSpc = findFile(app, 'doc-current-spc-ru');
  const updatedSpc = findFile(app, 'doc-updated-spc-ru');
  const updatedSpcKz = findFile(app, 'doc-updated-spc-kz');
  const appOldValue = values['param-variation-old-value'] as string;
  const appNewValue = values['param-variation-new-value'] as string;
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

}
