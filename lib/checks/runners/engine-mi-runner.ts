import type { CheckRunContext } from '@/lib/checks/engine-context';
import {
  createFinding,
  extract,
  findFile,
  getApplicationTradeName,
  getDocName,
  isExpired,
  normalize,
} from '@/lib/checks/engine-utils';

export function runMiChecks(context: CheckRunContext) {
  const { app, findings, values, procedure } = context;
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
      const appTrade = getApplicationTradeName(values);
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
        findings.push({
          ...createFinding(
            'critical',
            'Медицинское изделие',
            'Сертификат СМК МИ просрочен',
            `Срок действия сертификата СМК: ${qmsValid}.`,
            [getDocName('doc-mi-qms-certificate')],
            'Предоставьте действующий сертификат СМК или декларацию соответствия.',
            [{ source: getDocName('doc-mi-qms-certificate'), text: qmsValid }],
            'Решение Совета ЕЭК № 106; Приказ ҚР ДСМ-315'
          ),
          checkerId: 'document_expiry_check',
          confidence: 0.95,
        });
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
          findings.push({
            ...createFinding(
              'critical',
              'Медицинское изделие',
              'Регистрационное удостоверение МИ просрочено',
              `Срок действия регистрационного удостоверения: ${certValid}.`,
              [getDocName('doc-mi-registration-certificate')],
              'Предоставьте действующее регистрационное удостоверение МИ.',
              [{ source: getDocName('doc-mi-registration-certificate'), text: certValid }],
              'Решение Совета ЕЭК № 46; Приказ ҚР ДСМ-10'
            ),
            checkerId: 'document_expiry_check',
            confidence: 0.95,
          });
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
