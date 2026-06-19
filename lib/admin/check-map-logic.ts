import { getParameterLabelById, getRequiredParameterIds, parameters } from '@/lib/data/seed';
import type { CheckDefinition, DocumentType, ObjectType, Procedure, RequiredDoc, Rule } from '@/lib/types';
import { formatRuleConditions } from '@/lib/admin/document-type-logic';

export function buildApplicationCheckMapRows(rules: Rule[], documentTypes: DocumentType[]) {
  return rules.flatMap((rule) => {
    const objectType = getConditionValue(rule.conditions, 'param-object-type') as ObjectType | undefined;
    const procedure = getConditionValue(rule.conditions, 'param-procedure') as Procedure | undefined;

    return rule.requiredDocuments.map((req) => {
      const document = documentTypes.find((doc) => doc.id === req.documentTypeId);
      const alternativeDocument = req.alternativeDocumentTypeId
        ? documentTypes.find((doc) => doc.id === req.alternativeDocumentTypeId)
        : undefined;
      const checkIds = Array.from(
        new Set([
          'required_document_presence_check',
          ...(req.checks || []),
          ...((document?.checkIds || []).filter((checkId) => checkId !== 'required_document_presence_check')),
        ])
      );

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        objectType: objectType || 'LS',
        objectLabel: objectType === 'MI' ? 'МИ' : objectType === 'LS' ? 'ЛС' : 'Любой объект',
        procedure: procedure || 'registration',
        procedureLabel: procedure ? procedureLabel(procedure) : 'Любая процедура',
        document,
        documentTypeId: req.documentTypeId,
        alternativeDocumentName: alternativeDocument?.name,
        formats: document?.acceptedFormats || ['—'],
        severity: req.severityIfMissing,
        checkIds,
        conditions: formatRuleConditions(rule),
      };
    });
  });
}

export function getConditionValue(conditions: Rule['conditions'], parameterId: string) {
  return conditions.find((condition) => condition.parameterId === parameterId && condition.operator === 'equals')?.value;
}

export function getDocumentsForCheck(check: CheckDefinition, documentTypes: DocumentType[], rules: Rule[]) {
  const byId = new Map<string, DocumentType>();

  documentTypes.forEach((doc) => {
    const explicit = check.documentTypeIds?.includes(doc.id);
    const documentHasCheck = doc.checkIds?.includes(check.id);
    const applicationFieldCheck =
      check.id === 'required_fields_check' && ['doc-application', 'doc-mi-application'].includes(doc.id);

    if (explicit || documentHasCheck || applicationFieldCheck) byId.set(doc.id, doc);
  });

  rules.forEach((rule) => {
    rule.requiredDocuments.forEach((req) => {
      const doc = documentTypes.find((item) => item.id === req.documentTypeId);
      if (doc && doesCheckApplyToRequiredDoc(check, req, doc)) byId.set(doc.id, doc);
      const alternative = req.alternativeDocumentTypeId
        ? documentTypes.find((item) => item.id === req.alternativeDocumentTypeId)
        : undefined;
      if (alternative && doesCheckApplyToRequiredDoc(check, req, alternative)) byId.set(alternative.id, alternative);
    });
  });

  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export function getRulesForCheck(check: CheckDefinition, documentTypes: DocumentType[], rules: Rule[]) {
  return rules.filter((rule) => getRequiredDocsForCheck(check, documentTypes, rule).length > 0);
}

export function getRequiredDocsForCheck(check: CheckDefinition, documentTypes: DocumentType[], rule: Rule): RequiredDoc[] {
  return rule.requiredDocuments.filter((req) => {
    const doc = documentTypes.find((item) => item.id === req.documentTypeId);
    if (!doc) return false;
    return doesCheckApplyToRequiredDoc(check, req, doc);
  });
}

export function doesCheckApplyToRequiredDoc(check: CheckDefinition, req: RequiredDoc, doc: DocumentType) {
  if (check.id === 'required_document_presence_check') return true;
  if (req.checks?.includes(check.id)) return true;
  if (doc.checkIds?.includes(check.id)) return true;
  if (check.documentTypeIds?.includes(doc.id)) return true;
  return false;
}

export function buildRequiredFieldRows() {
  const objectTypes: ObjectType[] = ['LS', 'MI'];
  const procedures: Procedure[] = ['registration', 're-registration', 'variation'];

  return objectTypes.flatMap((objectType) =>
    procedures.flatMap((procedure) =>
      getRequiredParameterIds(objectType, procedure).map((fieldId) => ({
        objectType,
        objectLabel: objectType === 'LS' ? 'ЛС' : 'МИ',
        procedure,
        procedureLabel: procedureLabel(procedure),
        fieldId,
        fieldLabel: getParameterLabelById(fieldId),
        source:
          objectType === 'LS'
            ? 'Приказ ҚР ДСМ-10, форма заявления ЛС'
            : 'Приказ ҚР ДСМ-10, форма заявления МИ',
      }))
    )
  );
}

export function getConsistencyMatrix(checkId: string) {
  const matrices: Record<string, Array<{ subject: string; source: string; compareWith: string; failure: string }>> = {
    core_field_consistency_check: [
      {
        subject: 'Торговое наименование',
        source: 'Параметры заявки / заявление',
        compareWith: 'ОХЛП, инструкция/ЛВ, макет, досье, CPP при наличии',
        failure: 'Название отличается между заявкой и документами.',
      },
      {
        subject: 'МНН',
        source: 'Параметры заявки / заявление',
        compareWith: 'ОХЛП, инструкция/ЛВ, досье',
        failure: 'МНН отсутствует или указан по-разному.',
      },
      {
        subject: 'Дозировка и лекарственная форма',
        source: 'Параметры заявки / заявление',
        compareWith: 'ОХЛП, инструкция, модуль 3, НД качества, стабильность',
        failure: 'Форма/дозировка не совпадает в ключевых документах.',
      },
      {
        subject: 'Производитель и площадка',
        source: 'Заявление',
        compareWith: 'GMP, регистрационное досье, CPP, производственная лицензия',
        failure: 'Адрес или роль производителя расходится с подтверждающими документами.',
      },
    ],
    shelf_life_consistency_check: [
      {
        subject: 'Срок годности',
        source: 'Заявление / ОХЛП / инструкция',
        compareWith: 'НД качества, модуль 3, данные стабильности',
        failure: 'Срок годности не подтвержден стабильностью или указан по-разному.',
      },
      {
        subject: 'Период после вскрытия/разведения',
        source: 'Заявление / ОХЛП / инструкция',
        compareWith: 'Данные стабильности и качество',
        failure: 'Период применения после вскрытия не подтвержден или расходится.',
      },
    ],
    storage_consistency_check: [
      {
        subject: 'Условия хранения',
        source: 'Заявление / ОХЛП / инструкция',
        compareWith: 'Макет, НД качества, модуль 3, стабильность',
        failure: 'Условия хранения отличаются между документами.',
      },
    ],
    ls_variation_consistency_check: [
      {
        subject: 'Тип изменения',
        source: 'Параметры заявки / заявление',
        compareWith: 'Описание изменения, обоснование, сравнительная таблица',
        failure: 'Тип IA/IB/II или область изменения не подтверждена комплектом документов.',
      },
      {
        subject: 'Редакция до и после',
        source: 'Заявление / таблица изменений',
        compareWith: 'Текущая и предлагаемая ОХЛП/ИМП/НД/маркировка',
        failure: 'Нет построчного сравнения или изменение не отражено в проектах документов.',
      },
    ],
    undocumented_variation_check: [
      {
        subject: 'Фактические отличия в документах',
        source: 'Текущая и новая версия документа',
        compareWith: 'Описание изменения и сравнительная таблица',
        failure: 'Найдено изменение, которое не заявлено в ведомости изменений.',
      },
    ],
  };

  return matrices[checkId] || [];
}

export function getCheckImplementationBlueprint(check: CheckDefinition) {
  const generic = {
    goal: check.description,
    input: 'Значения заявки, загруженные документы, результаты извлечения текста и метаданные файла.',
    output: 'Finding с уровнем критичности, документами, объяснением, рекомендацией и ссылкой на НПА.',
    method: `${check.method}: ${methodExplanation(check.method)}`,
    algorithm: 'Запустить runner по check.id, собрать evidence, вернуть структурированный результат проверки.',
    gemma: 'Gemma 4 используется, когда parser/OCR не может надежно извлечь смысловое требование или нужно сравнить свободный текст.',
    failure: 'Нарушение условия проверки, отсутствие обязательного значения или расхождение между документами.',
  };

  const overrides: Record<string, Partial<typeof generic>> = {
    required_fields_check: {
      input: 'Цифровые параметры заявки; позже также Word/PDF-заявление после parser/OCR/Gemma-извлечения.',
      algorithm: 'Для выбранных objectType/procedure взять getRequiredParameterIds и проверить, что каждое поле заполнено.',
      gemma: 'Нужна только для PDF/Word-заявления, если поля не заполнены в цифровой форме и нужно извлечь их из файла.',
      failure: 'Обязательное поле пустое или невозможно сопоставить извлеченное поле с параметром заявки.',
    },
    required_document_presence_check: {
      input: 'Параметры заявки, активные rules и список загруженных файлов.',
      algorithm: 'Отфильтровать rules по условиям, построить requiredDocuments, проверить наличие файла или альтернативного документа.',
      gemma: 'Не нужна для факта наличия файла; может использоваться позже для определения типа неизвестного документа.',
      failure: 'Обязательный документ отсутствует, не загружена альтернатива или документ не распознан как нужный тип.',
    },
    file_format_check: {
      input: 'Тип документа и расширение/ MIME загруженного файла.',
      algorithm: 'Сравнить расширение файла с documentType.acceptedFormats.',
      gemma: 'Не нужна.',
      failure: 'Формат файла не входит в допустимые форматы для выбранного типа документа.',
    },
    docx_format_check: {
      input: 'DOCX-файл и XML-структура word/document.xml, styles.xml.',
      algorithm: 'Мини-скрипт разбирает DOCX, проверяет шрифт, размер, цвет, интервалы и проблемные run/paragraph.',
      gemma: 'Не нужна для технической проверки шрифта; может помочь сформулировать объяснение для заявителя.',
      failure: 'Найдены фрагменты с недопустимым шрифтом/размером/цветом или файл не DOCX.',
    },
    ocr_quality_check: {
      input: 'PDF/изображение, текстовый слой, OCR-метаданные, процент извлеченного текста.',
      algorithm: 'Проверить наличие текстового слоя, статус OCR, ошибки парсинга и минимальную плотность текста.',
      gemma: 'Не нужна для статуса OCR; нужна только для смысловой проверки после извлечения текста.',
      failure: 'Нет текстового слоя, OCR не выполнен, извлечение частичное или качество ниже порога.',
    },
    core_field_consistency_check: {
      input: 'Поля заявки и извлеченные поля из ОХЛП, инструкции, макета, досье, GMP/CPP.',
      algorithm: 'Нормализовать значения и сравнить ключевые поля по матрице документов.',
      gemma: 'Нужна, если значение находится в свободном тексте и parser не смог выделить поле.',
      failure: 'Одно и то же поле имеет разные значения в разных документах.',
    },
  };

  return { ...generic, ...overrides[check.id] };
}

export function methodExplanation(method: CheckDefinition['method']) {
  const labels: Record<CheckDefinition['method'], string> = {
    rule: 'детерминированная проверка по параметрам заявки и правилам',
    parser: 'технический parser файла без LLM',
    ocr: 'проверка текстового слоя/OCR и качества извлечения',
    llm: 'смысловая автоматическая проверка',
    manual: 'ручная экспертная проверка',
    hybrid: 'комбинация rules/parser/OCR/Gemma',
  };
  return labels[method];
}

export function procedureLabel(procedure: Procedure) {
  const labels: Record<Procedure, string> = {
    registration: 'Регистрация',
    're-registration': 'Перерегистрация',
    variation: 'Внесение изменений',
  };
  return labels[procedure];
}
