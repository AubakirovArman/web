import { getParameterLabelById } from '@/lib/data/seed';
import { getRequiredDossierSections } from '@/lib/dossier/sections';
import type { CheckRunContext } from '@/lib/checks/engine-context';
import {
  createFinding,
  extract,
  getAllowedFormats,
  getDocName,
  getDocType,
  getOptionLabel,
  hasFilledValue,
  hasRequiredApplicationValue,
  isDossierSectionApplicable,
  isExpired,
  normalize,
  parseJsonValue,
  stringValue,
} from '@/lib/checks/engine-utils';
import {
  checkDocxFormatting,
  fileMatchesDossierSection,
} from '@/lib/checks/engine-file-helpers';
export function runApplicationAndFileChecks(context: CheckRunContext) {
  const { app, findings, values, objectType, procedure, isLS, requiredFieldIds } = context;
  // 1. Application completeness
  for (const fieldId of requiredFieldIds) {
    if (!hasRequiredApplicationValue(values, fieldId)) {
      findings.push(
        createFinding(
          'critical',
          'Заявление',
          `Не заполнено поле заявления: ${getParameterLabelById(fieldId)}`,
          `В заявлении отсутствует обязательное поле «${getParameterLabelById(fieldId)}».`,
          ['Заявление'],
          `Заполните поле «${getParameterLabelById(fieldId)}» в параметрах заявки.`,
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 2'
        )
      );
    }
  }
  if (isLS) {
    const conditionalFieldIds: string[] = [];
    if (stringValue(values['param-orphan-status']) === 'yes') {
      conditionalFieldIds.push('param-orphan-status-state');
      if (stringValue(values['param-orphan-status-state']) === 'yes') {
        conditionalFieldIds.push('param-orphan-assigned-date', 'param-orphan-registration-number');
      }
      if (stringValue(values['param-orphan-refusal-flag']) === 'yes') {
        conditionalFieldIds.push('param-orphan-refusal-date', 'param-orphan-decision-number');
      }
    }
    if (stringValue(values['param-transfer-enabled']) === 'yes') {
      conditionalFieldIds.push('param-transfer-site');
    }
    if (stringValue(values['param-atc-enabled']) === 'yes') {
      conditionalFieldIds.push('param-atc-code', 'param-atc-name-ru');
    }

    for (const fieldId of conditionalFieldIds) {
      if (hasRequiredApplicationValue(values, fieldId)) continue;
      findings.push(
        createFinding(
          'critical',
          'Заявление',
          `Не заполнено условное поле заявления: ${getParameterLabelById(fieldId)}`,
          `Поле «${getParameterLabelById(fieldId)}» стало обязательным из-за выбранных параметров заявки.`,
          ['Заявление'],
          `Заполните поле «${getParameterLabelById(fieldId)}» или отключите связанный флаг, если требование неприменимо.`,
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 1'
        )
      );
    }

    const qcLabFields = ['param-qc-lab-name', 'param-qc-lab-address', 'param-qc-lab-country', 'param-qc-lab-phone', 'param-qc-lab-email'];
    const hasAnyQcLabField = qcLabFields.some((fieldId) => hasFilledValue(values[fieldId]));
    if (hasAnyQcLabField) {
      for (const fieldId of qcLabFields) {
        if (hasFilledValue(values[fieldId])) continue;
        findings.push(
          createFinding(
            'warning',
            'Заявление',
            `Неполные сведения о лаборатории: ${getParameterLabelById(fieldId)}`,
            'Если указывается лаборатория по контролю качества, желательно заполнить всю структурированную группу полей.',
            ['Заявление'],
            `Заполните поле «${getParameterLabelById(fieldId)}» или очистите блок лаборатории, если он неприменим.`,
            undefined,
            'Приказ ҚР ДСМ-10, Приложение 1'
          )
        );
      }
    }

    const dosageAmount = stringValue(values['param-dosage-amount']).trim();
    if (dosageAmount && Number.isNaN(Number(dosageAmount.replace(',', '.')))) {
      findings.push(
        createFinding(
          'warning',
          'Заявление',
          'Дозировка указана нечисловым значением',
          `Поле «Дозировка: количество» должно быть числовым. Сейчас указано: «${dosageAmount}».`,
          ['Заявление'],
          'Укажите количество дозировки числом, а единицу измерения выберите из списка.',
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 1'
        )
      );
    }

    const exportNames = parseJsonValue<Array<Record<string, string>>>(values['param-export-trade-names'], []);
    exportNames.forEach((row, index) => {
      const filled = ['country', 'nameKz', 'nameRu', 'nameEn'].filter((key) => hasFilledValue(row[key]));
      if (filled.length > 0 && filled.length < 4) {
        findings.push(
          createFinding(
            'warning',
            'Заявление',
            `Неполная строка экспортного наименования №${index + 1}`,
            'Если экспортное наименование добавлено, желательно заполнить страну и наименования на всех языках.',
            ['Заявление'],
            'Заполните все колонки строки или удалите строку, если экспортное наименование неприменимо.',
            undefined,
            'Приказ ҚР ДСМ-10, Приложение 1'
          )
        );
      }
    });

    const compositionRows = parseJsonValue<Array<Record<string, string>>>(values['param-composition-table'], []);
    compositionRows.forEach((row, index) => {
      const requiredKeys = ['substanceType', 'name', 'quantity', 'unit', 'normativeDocument', 'manufacturer'];
      const missing = requiredKeys.filter((key) => !hasFilledValue(row[key]));
      if (missing.length > 0 && missing.length < requiredKeys.length) {
        findings.push(
          createFinding(
            'warning',
            'Заявление',
            `Неполная строка состава №${index + 1}`,
            `В строке состава не заполнены поля: ${missing.join(', ')}.`,
            ['Заявление'],
            'Заполните строку состава полностью: тип вещества, наименование, количество, единицу, НД и производителя.',
            undefined,
            'Приказ ҚР ДСМ-10, Приложение 1'
          )
        );
      }
    });

    if (procedure === 'variation') {
      const variationRows = parseJsonValue<Array<Record<string, string>>>(values['param-variation-changes-table'], []);
      variationRows.forEach((row, index) => {
        const missing = ['changeType', 'before', 'after'].filter((key) => !hasFilledValue(row[key]));
        if (missing.length > 0 && missing.length < 3) {
          findings.push(
            createFinding(
              'warning',
              'Заявление',
              `Неполная строка изменения №${index + 1}`,
              `В строке изменения не заполнены поля: ${missing.join(', ')}.`,
              ['Заявление'],
              'Выберите изменение из справочника и заполните редакцию до внесения изменений и предлагаемую редакцию.',
              undefined,
              'Приказ ҚР ДСМ-10, Приложение 1'
            )
          );
        }
      });
    }
  }

  // 2. File format validation for all uploaded documents
  for (const file of app.files) {
    const docType = getDocType(file.documentTypeId);
    if (!docType) continue;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedFormats = getAllowedFormats(file, docType.acceptedFormats);
    if (!allowedFormats.includes(ext)) {
      findings.push(
        createFinding(
          'serious',
          'Файлы и форматы',
          `Неверный формат файла: ${docType.name}`,
          `Для документа «${docType.name}» допустимы форматы: ${allowedFormats.join(', ')}. Загружен: ${file.name}.`,
          [docType.name],
          `Переведите файл в один из допустимых форматов и загрузите повторно.`,
          undefined,
          'Приказ ҚР ДСМ-10, Приложение 3'
        )
      );
    }
    if (docType.importedRequirements?.length) {
      const acceptedRequirements = docType.importedRequirements.filter((requirement) => requirement.requirementText?.trim());
      if (acceptedRequirements.length > 0) {
        const preview = acceptedRequirements
          .slice(0, 5)
          .map((requirement, index) => {
            const point = requirement.sourcePoint ? `${requirement.sourcePoint}: ` : '';
            return `${index + 1}. ${point}${requirement.requirementText}`;
          })
          .join('\n');
        findings.push({
          ...createFinding(
            'unknown',
            'НПА / ручная проверка',
            `Требования НПА к документу: ${docType.name}`,
            `К типу документа привязано требований НПА: ${acceptedRequirements.length}. Требуется экспертная или гибридная проверка содержимого файла.\n${preview}`,
            [docType.name],
            'Откройте документ в карточке эксперта и проверьте выполнение требований НПА. При необходимости запустите смысловую проверку через Gemma.',
            acceptedRequirements.slice(0, 5).map((requirement) => ({
              source: requirement.sourcePoint || requirement.sourceDocumentName || 'НПА',
              text: requirement.quote || requirement.requirementText,
            })),
            docType.npaReferences?.[0] || acceptedRequirements[0]?.sourcePoint
          ),
          checkerId: 'npa_imported_requirement_check',
          confidence: 0.7,
          evidence: acceptedRequirements.slice(0, 8).map((requirement) => ({
            source: requirement.sourcePoint || requirement.sourceDocumentName || 'НПА',
            text: requirement.requirementText,
            field: requirement.id,
            documentTypeId: docType.id,
          })),
        });
      }
    }

    if (
      isLS &&
      ext === 'docx' &&
      docType.canCheckFont &&
      !['doc-spc-ru', 'doc-instruction-ru'].includes(file.documentTypeId)
    ) {
      checkDocxFormatting(file, docType.name, findings, 'Решение Совета ЕЭК № 88');
    }
  }

  const dossierFiles = app.files.filter((file) => file.source === 'dossier-folder' || file.dossierSectionId);
  if (dossierFiles.length > 0) {
    for (const section of getRequiredDossierSections(objectType, procedure).filter((item) => isDossierSectionApplicable(app, item.id))) {
      const hasSectionFile = dossierFiles.some((file) => fileMatchesDossierSection(file, section));
      const hasMappedDocType = app.files.some((file) => fileMatchesDossierSection(file, section));
      if (!hasSectionFile && !hasMappedDocType) {
        findings.push({
          ...createFinding(
            'serious',
            'Регистрационное досье',
            `Не найден раздел досье: ${section.title}`,
            `Для процедуры «${getOptionLabel('param-procedure', procedure)}» должен быть представлен раздел «${section.title}».`,
            [section.title],
            'Добавьте файл в соответствующий раздел досье или вручную сопоставьте загруженный файл с этим разделом.',
            [{ source: section.npaReference, text: section.description }],
            section.npaReference
          ),
          checkerId: 'dossier_section_presence_check',
          confidence: 0.82,
          evidence: [{ source: section.npaReference, text: section.description, documentTypeId: section.documentTypeId }],
        });
      }
    }

    for (const file of dossierFiles) {
      if ((file.dossierMappingConfidence || 0) >= 0.45) continue;
      findings.push({
        ...createFinding(
          'warning',
          'Регистрационное досье',
          `Низкая уверенность авто-сопоставления: ${file.name}`,
          file.dossierMappingReason || 'Файл автоматически отнесен к разделу с низкой уверенностью.',
          [file.dossierSectionName || file.name],
          'Проверьте раздел файла вручную в карточке досье перед экспертной оценкой.',
          undefined,
          'Внутреннее правило классификации досье'
        ),
        checkerId: 'dossier_mapping_quality_check',
        confidence: 0.65,
        evidence: [
          {
            source: file.relativePath || file.name,
            text: file.dossierMappingReason || 'Низкая уверенность классификации',
            documentTypeId: file.documentTypeId,
          },
        ],
      });
    }
  }

}
