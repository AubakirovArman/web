import type { DocumentType } from '@/lib/types';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { getLsDocumentRequirementForItem, getLsDossierDocumentTypesAsDocumentTypes } from '@/lib/data/ls-document-checks-mapping';

export function getRequirementSummary(
  item: NewDossierDocumentType,
  requirement: ReturnType<typeof getLsDocumentRequirementForItem>,
): string {
  if (!requirement) {
    if (item.kind === 'section') return 'Структурный раздел досье';
    if (item.kind === 'excluded') return 'Исключено из перечня';
    return item.validationChecks || item.requirednessExplanation || item.requiredWhenExpression || 'Правило пока не найдено';
  }
  const firstCheck = splitRequirementText(item.validationChecks || requirement.validationChecks)[0];
  return firstCheck || item.requirednessExplanation || requirement.requiredDocument || requirement.whenRequired || item.requiredWhenExpression || requirement.triggerExpression;
}

export function splitRequirementText(text: string): string[] {
  const normalized = text.trim();
  if (!normalized || normalized === 'Проверки пока не нормализованы для этого типа документа.') return [];
  return normalized
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractProcedureHint(trigger?: string): string {
  if (!trigger) return '—';
  if (trigger.includes('variation')) return 'Внесение изменений';
  if (trigger.includes('re-registration') || trigger.includes('reregistration')) return 'Перерегистрация';
  if (trigger.includes('registration')) return 'Регистрация';
  return 'Все процедуры / по структуре досье';
}

export function extractTypeHint(trigger?: string): string {
  if (!trigger) return '—';
  const productTypeMatch = trigger.match(/param-product-type\s*(?:=|in)\s*(.*?)(?:\s+AND|\s+OR|$)/);
  if (productTypeMatch?.[1]) return productTypeMatch[1].replace(/[\[\]"]/g, '').trim();
  if (trigger.includes('param-variation-class')) return 'Класс изменения';
  return 'По параметрам заявки';
}

export function formatNewDossierSection(item: NewDossierDocumentType): string {
  if (!item.group) return item.source === 'appendix-2' ? 'Приложение 2' : 'Приложение 3';
  return item.group.replace(/\*/g, '');
}

export function getNewDossierSections(items: NewDossierDocumentType[]): string[] {
  return Array.from(new Set(items.map((item) => item.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
}

export function mergeLsDossierDocumentTypesIntoCatalog(catalog: DocumentType[], items: NewDossierDocumentType[]): DocumentType[] {
  const converted = getLsDossierDocumentTypesAsDocumentTypes(items);
  const convertedById = new Map(converted.map((doc) => [doc.id, doc]));
  const withoutOldLsDossierTypes = catalog.filter((doc) => !doc.id.startsWith('new-ls-') || convertedById.has(doc.id));
  const mergedBase = withoutOldLsDossierTypes.map((doc) => convertedById.get(doc.id) || doc);
  const existingIds = new Set(mergedBase.map((doc) => doc.id));
  const newConverted = converted.filter((doc) => !existingIds.has(doc.id));
  return [...mergedBase, ...newConverted];
}

export function createBlankNewDossierDocumentType(items: NewDossierDocumentType[]): NewDossierDocumentType {
  const nextOrder = Math.max(0, ...items.map((item) => item.sortOrder)) + 1;
  return {
    id: `new-ls-custom-${Date.now()}`,
    source: 'appendix-3',
    sourceName: 'Приложение 3. Регистрационное досье ЛС по Модулям 1-5',
    group: 'Модуль 1',
    groupCode: 'CUSTOM',
    module: 'Модуль 1',
    code: '',
    name: '',
    description: '',
    kind: 'document',
    direction: 'LS',
    acceptedFormats: ['pdf', 'doc', 'docx'],
    active: true,
    sortOrder: nextOrder,
    requiredWhenExpression: 'param-object-type = "LS" AND param-procedure = "registration"',
    severityIfMissing: 'warning',
    checkIds: ['required_document_presence_check', 'file_format_check', 'ocr_quality_check'],
    linkedApplicationParams: ['param-object-type', 'param-procedure'],
    validationChecks: 'Проверить наличие документа | Проверить допустимый формат файла | Проверить возможность извлечения текста/OCR',
  };
}

