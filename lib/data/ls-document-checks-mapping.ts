import type { Application, DocumentType, RequiredDoc, Severity } from '@/lib/types';
import { lsDossierDocumentTypesNew, type NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import lsDocumentRequirementRulesData from '@/lib/data/generated/ls-document-requirement-rules.json';
import lsVariationChecklistRulesData from '@/lib/data/generated/ls-variation-checklist-rules.json';
import recommendedMissingApplicationParametersData from '@/lib/data/generated/recommended-missing-application-parameters.json';

export type LsDossierSource = 'appendix-2' | 'appendix-3';

export interface LsDocumentRequirementRule {
  sourceStructure: string;
  modulePart: string;
  docCode: string;
  domesticEquivalent: string;
  documentName: string;
  rowType: string;
  requiredDocument: string;
  whenRequired: string;
  triggerExpression: string;
  applicationParams: string[];
  applicationParamsWithTitles: string[];
  validationChecks: string;
  sourceReference: string;
  confidence: string;
  notes: string;
}

export interface LsVariationChecklistRule {
  variationCode: string;
  variationName: string;
  variationClass: string;
  variationArea: string;
  applicationParams: string[];
  applicationParamsWithTitles: string[];
  triggerExpression: string;
  documentsToUpload: string;
  linkedDocCodesDetected: string[];
  validationChecks: string;
  sourceReference: string;
  confidence: string;
}

export interface RecommendedMissingApplicationParameter {
  param: string;
  why: string;
  documents: string;
}

export const lsDocumentRequirementRules = lsDocumentRequirementRulesData as LsDocumentRequirementRule[];
export const lsVariationChecklistRules = lsVariationChecklistRulesData as LsVariationChecklistRule[];
export const recommendedMissingApplicationParameters = recommendedMissingApplicationParametersData as RecommendedMissingApplicationParameter[];

const SOURCE_STRUCTURE_BY_DOSSIER_SOURCE: Record<LsDossierSource, string> = {
  'appendix-2': 'Нац. производители РК / Приложение 2',
  'appendix-3': 'CTD / Приложение 3',
};

const clinicalDataProductTypes = new Set(['biological', 'biosimilar', 'vaccine', 'hybrid', 'advanced-therapy']);
const genericLikeProductTypes = new Set(['generic', 'hybrid', 'biosimilar']);
const biologicalProductTypes = new Set(['biological', 'biosimilar', 'vaccine', 'advanced-therapy']);

export function getSelectedDossierSource(values: Application['values'] | Record<string, string | string[]>): LsDossierSource {
  return String(values['param-dossier-type'] || 'ctd') === 'domestic' ? 'appendix-2' : 'appendix-3';
}

export function getLsDossierDocumentTypesAsDocumentTypes(items: NewDossierDocumentType[] = lsDossierDocumentTypesNew): DocumentType[] {
  return items
    .filter((item) => item.kind === 'document' && item.active)
    .map((item) => {
      const rule = getLsDocumentRequirementForItem(item);
      const checks = inferCheckIds(item, rule);
      const checkIds = item.checkIds?.length ? item.checkIds : checks;
      const requirementText =
        item.validationChecks ||
        rule?.validationChecks ||
        rule?.requiredDocument ||
        `Проверить наличие и применимость документа «${item.name}».`;
      const criticality = item.severityIfMissing || (rule ? severityForRule(rule) : 'warning');
      const applicabilityCondition = item.requiredWhenExpression || rule?.triggerExpression;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        acceptedFormats: item.acceptedFormats.length ? item.acceptedFormats : ['pdf'],
        direction: item.direction,
        needsOcr: item.acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format)),
        canCheckFont: item.acceptedFormats.some((format) => ['doc', 'docx'].includes(format)),
        canCheckSignature: item.acceptedFormats.includes('pdf'),
        canCheckSeal: item.acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format)),
        checkIds,
        npaReferences: rule?.sourceReference ? [rule.sourceReference] : [],
        requirednessExplanation: item.requirednessExplanation || buildRequirednessExplanation(item, rule),
        requiredWhenExpression: applicabilityCondition,
        linkedApplicationParams: item.linkedApplicationParams?.length ? item.linkedApplicationParams : rule?.applicationParams,
        severityIfMissing: item.severityIfMissing || (rule ? severityForRule(rule) : undefined),
        validationChecksText: item.validationChecks || rule?.validationChecks,
        importedRequirements: rule || item.validationChecks || item.requiredWhenExpression
          ? [
              {
                id: `matrix-${item.id}`,
                source: 'manual' as const,
                sourceDocumentCode: rule?.docCode || item.code,
                sourceDocumentName: rule?.documentName || item.name,
                checkSubject: item.name,
                checkType: checkIds.join(', '),
                requirementText,
                criticality,
                applicabilityCondition,
                sourcePoint: rule?.sourceReference,
                quote: item.requirednessExplanation || rule?.whenRequired || rule?.requiredDocument,
                importedAt: '2026-06-16T00:00:00.000Z',
              },
            ]
          : [],
      } satisfies DocumentType;
    });
}

export function getLsRequiredDossierDocuments(
  values: Application['values'] | Record<string, string | string[]>,
  items: NewDossierDocumentType[] = lsDossierDocumentTypesNew,
): RequiredDoc[] {
  const source = getSelectedDossierSource(values);
  const result: RequiredDoc[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (item.kind !== 'document' || !item.active || item.source !== source) continue;
    const rule = getLsDocumentRequirementForItem(item);
    const triggerExpression = item.requiredWhenExpression || rule?.triggerExpression;
    if (!rule && !triggerExpression) continue;
    if (!matchesLsRequirementTriggerExpression(triggerExpression || '', values, item.source)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push({
      documentTypeId: item.id,
      severityIfMissing: item.severityIfMissing || (rule ? severityForRule(rule) : 'warning'),
      checks: item.checkIds?.length ? item.checkIds : inferCheckIds(item, rule),
    });
  }

  return result;
}

export function getLsDocumentRequirementForItem(item: NewDossierDocumentType): LsDocumentRequirementRule | undefined {
  return findRuleBySourceCodeAndName(item.source, item.code, item.name);
}

export function getLsDocumentRequirementByDocumentTypeId(documentTypeId: string): LsDocumentRequirementRule | undefined {
  const item = lsDossierDocumentTypesNew.find((entry) => entry.id === documentTypeId);
  return item ? getLsDocumentRequirementForItem(item) : undefined;
}

export function getLsDossierDocumentTypeById(documentTypeId: string): NewDossierDocumentType | undefined {
  return lsDossierDocumentTypesNew.find((entry) => entry.id === documentTypeId);
}

export function getLsRequirednessText(item: NewDossierDocumentType): string {
  const rule = getLsDocumentRequirementForItem(item);
  return buildRequirednessExplanation(item, rule);
}

export function getLsValidationChecksText(item: NewDossierDocumentType): string {
  const rule = getLsDocumentRequirementForItem(item);
  return rule?.validationChecks || 'Проверки пока не нормализованы для этого типа документа.';
}

export function getLsRequirementSourceStructure(source: LsDossierSource): string {
  return SOURCE_STRUCTURE_BY_DOSSIER_SOURCE[source];
}

function findRuleBySourceCodeAndName(source: LsDossierSource, code: string, name: string): LsDocumentRequirementRule | undefined {
  const structure = SOURCE_STRUCTURE_BY_DOSSIER_SOURCE[source];
  const normalizedCode = normalizeToken(code);
  const normalizedName = normalizeToken(name);
  return (
    lsDocumentRequirementRules.find((rule) => rule.sourceStructure === structure && normalizeToken(rule.docCode) === normalizedCode) ||
    lsDocumentRequirementRules.find((rule) => rule.sourceStructure === structure && normalizeToken(rule.documentName) === normalizedName)
  );
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRequirednessExplanation(item: NewDossierDocumentType, rule?: LsDocumentRequirementRule): string {
  if (!rule) return item.kind === 'section' ? 'Структурный раздел досье.' : 'Правило обязательности пока не найдено в матрице.';
  const parts = [rule.triggerExpression, rule.whenRequired, rule.requiredDocument].filter(Boolean);
  return parts.join(' | ') || 'Требуется по выбранной структуре регистрационного досье.';
}

function severityForRule(rule: LsDocumentRequirementRule): Severity {
  const text = `${rule.documentName} ${rule.requiredDocument} ${rule.whenRequired} ${rule.triggerExpression}`.toLowerCase();
  if (text.includes('если применимо') || text.includes('при наличии') || text.includes('при необходимости')) return 'warning';
  if (text.includes('обоснование') || text.includes('поясн')) return 'serious';
  return 'critical';
}

function inferCheckIds(item: NewDossierDocumentType, rule?: LsDocumentRequirementRule): string[] {
  const text = `${item.code} ${item.name} ${item.description} ${rule?.validationChecks || ''} ${rule?.requiredDocument || ''}`.toLowerCase();
  const checks = new Set<string>(['required_document_presence_check', 'file_format_check']);
  if (item.acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format))) checks.add('ocr_quality_check');
  if (text.includes('gmp')) checks.add('gmp_certificate_check');
  if (text.includes('сертификат на фармацевтический продукт') || text.includes('cpp')) checks.add('cpp_certificate_check');
  if (text.includes('биоэквивалент')) checks.add('bioequivalence_report_check');
  if (text.includes('биовейвер')) checks.add('bioequivalence_waiver_check');
  if (text.includes('стабильн') || text.includes('срок год')) checks.add('shelf_life_consistency_check');
  if (text.includes('хранен') || text.includes('транспорт')) checks.add('storage_consistency_check');
  if (text.includes('охлп') || text.includes('инструкц') || text.includes('маркиров')) checks.add('core_field_consistency_check');
  if (text.includes('фармаконадзор') || text.includes('пур') || text.includes('управления рисками')) checks.add('pharmacovigilance_contact_check');
  if (text.includes('стерил')) checks.add('sterility_validation_check');
  if (text.includes('модуль 3') || text.includes('качество')) checks.add('module3_content_check');
  return Array.from(checks);
}

export function matchesLsRequirementTrigger(
  rule: LsDocumentRequirementRule,
  values: Application['values'] | Record<string, string | string[]>,
  item?: NewDossierDocumentType,
): boolean {
  return matchesLsRequirementTriggerExpression(rule.triggerExpression, values, item?.source);
}

export function matchesLsRequirementTriggerExpression(
  triggerExpression: string,
  values: Application['values'] | Record<string, string | string[]>,
  source?: LsDossierSource,
): boolean {
  const expression = normalizeExpression(triggerExpression);
  const objectType = stringValue(values['param-object-type']) || 'LS';
  if (objectType !== 'LS') return false;
  if (source && source !== getSelectedDossierSource(values)) return false;
  if (expression.includes('missing_param:')) return false;

  const procedure = normalizeProcedure(stringValue(values['param-procedure']) || 'registration');
  if (!matchesProcedure(expression, procedure)) return false;

  const productType = normalizeProductType(stringValue(values['param-product-type']) || '');
  if (!matchesProductType(expression, productType, values)) return false;

  if (!matchesExplicitValue(expression, values, 'param-payment-request')) return false;
  if (!matchesExplicitValue(expression, values, 'param-foreign-registrations')) return false;

  const booleanParams = [
    'param-bioequivalence-required',
    'param-clinical-studies',
    'param-transfer-enabled',
    'param-sterile',
    'param-api-special-status',
    'param-biological-flag',
    'param-immunobiological-flag',
    'param-new-api-flag',
    'param-additional-monitoring',
    'param-who-prequalification',
    'param-contains-gmo',
    'param-human-animal-origin',
  ];
  for (const param of booleanParams) {
    if (!matchesBooleanParam(expression, values, param)) return false;
  }

  if (expression.includes('manufacturer.country != "kz"') && stringValue(values['param-manufacturer-country']) === 'KZ') return false;
  if (expression.includes('manufacturer.country = "kz"') && stringValue(values['param-manufacturer-country']) !== 'KZ') return false;
  if (expression.includes('manufacturer.country in снг')) {
    const country = stringValue(values['param-manufacturer-country']);
    if (!['RU', 'BY', 'AM', 'KG', 'TJ', 'UZ', 'AZ', 'MD'].includes(country)) return false;
  }

  if (expression.includes('product type requires clinical data') && !clinicalDataProductTypes.has(productType) && stringValue(values['param-clinical-studies']) !== 'yes') return false;
  if (expression.includes('param-composition-table contains active substance') && !stringValue(values['param-composition-table']).trim()) return false;

  return true;
}

function matchesProcedure(expression: string, procedure: string): boolean {
  const inMatch = expression.match(/param-procedure\s+in\s+\[([^\]]+)\]/);
  if (inMatch) {
    const allowed = inMatch[1]
      .split(',')
      .map((value) => normalizeProcedure(value.replace(/["']/g, '').trim()))
      .filter(Boolean);
    if (!allowed.includes(procedure)) return false;
  }

  const equalsMatches = [...expression.matchAll(/param-procedure\s*=\s*"([^"]+)"/g)].map((match) => normalizeProcedure(match[1]));
  if (equalsMatches.length > 0 && !equalsMatches.includes(procedure)) return false;
  return true;
}

function matchesProductType(
  expression: string,
  productType: string,
  values: Application['values'] | Record<string, string | string[]>,
): boolean {
  const normalizedExpression = expression.replace(/bioanalog/g, 'biosimilar');
  const inMatch = normalizedExpression.match(/param-product-type\s+in\s+\[([^\]]+)\]/);
  if (inMatch) {
    const allowed = inMatch[1]
      .split(',')
      .map((value) => normalizeProductType(value.replace(/["']/g, '').trim()))
      .filter(Boolean);
    if (!allowed.includes(productType)) return false;
  }

  const equalsMatches = [...normalizedExpression.matchAll(/param-product-type\s*=\s*"([^"]+)"/g)].map((match) => normalizeProductType(match[1]));
  if (equalsMatches.length > 0 && !equalsMatches.includes(productType)) return false;

  if (normalizedExpression.includes('param-product-type requires nonclinical module')) {
    if (!biologicalProductTypes.has(productType) && stringValue(values['param-clinical-studies']) !== 'yes') return false;
  }

  if (normalizedExpression.includes('generic') && normalizedExpression.includes('reference') && !genericLikeProductTypes.has(productType)) return false;
  return true;
}

function matchesExplicitValue(
  expression: string,
  values: Application['values'] | Record<string, string | string[]>,
  param: string,
): boolean {
  const value = stringValue(values[param]);
  if (expression.includes(`${param} is filled`) && !value.trim()) return false;
  if (expression.includes(`${param} is not filled`) && value.trim()) return false;
  return true;
}

function matchesBooleanParam(
  expression: string,
  values: Application['values'] | Record<string, string | string[]>,
  param: string,
): boolean {
  const yesPattern = `${param} = yes`;
  const noPattern = `${param} = no`;
  const value = stringValue(values[param]) || 'no';
  if (expression.includes(yesPattern) && value !== 'yes') return false;
  if (expression.includes(noPattern) && value !== 'no') return false;
  return true;
}

function normalizeExpression(expression: string): string {
  return expression
    .replace(/reregistration/g, 're-registration')
    .replace(/bioanalog/g, 'biosimilar')
    .toLowerCase();
}

function normalizeProcedure(value: string): string {
  if (value === 'reregistration') return 're-registration';
  return value;
}

function normalizeProductType(value: string): string {
  if (value === 'bioanalog') return 'biosimilar';
  return value;
}

function stringValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(', ') : value || '';
}
