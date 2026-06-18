import type { DocumentType } from '@/lib/types';

interface RuleLike {
  doc_code?: string | null;
  document_name?: string | null;
  required_document?: string | null;
  validation_checks?: unknown;
}

const baseDocumentCheckIds = [
  'file_format_check',
  'ocr_quality_check',
  'expected_extracted_fields_check',
  'npa_imported_requirement_check',
];

export function inferLsRegistrationCheckIds(rule: RuleLike): string[] {
  const text = ruleSearchText(rule);
  const code = normalizeCode(rule.doc_code);
  const checks = new Set<string>(baseDocumentCheckIds);

  if (isGmp(text)) add(checks, 'gmp_certificate_check', 'document_expiry_check', 'core_field_consistency_check');
  if (isCpp(text, code)) add(checks, 'cpp_certificate_check', 'document_expiry_check', 'core_field_consistency_check');
  if (isSpc(text, code)) add(checks, 'required_sections_check', 'docx_format_check', 'core_field_consistency_check', 'shelf_life_consistency_check', 'storage_consistency_check', 'translation_length_check');
  if (isInstruction(text, code)) add(checks, 'required_sections_check', 'docx_format_check', 'core_field_consistency_check', 'shelf_life_consistency_check', 'storage_consistency_check', 'translation_length_check', 'black_triangle_check');
  if (isLabeling(text, code)) add(checks, 'core_field_consistency_check', 'storage_consistency_check');
  if (isMockup(text, code)) add(checks, 'core_field_consistency_check', 'storage_consistency_check', 'file_format_check');
  if (isPharmacovigilance(text, code)) add(checks, 'pharmacovigilance_contact_check');
  if (isRiskManagement(text, code)) add(checks, 'pharmacovigilance_contact_check', 'black_triangle_check');
  if (isBioequivalenceReport(text)) add(checks, 'bioequivalence_report_check', 'core_field_consistency_check');
  if (isBioequivalenceWaiver(text)) add(checks, 'bioequivalence_waiver_check', 'core_field_consistency_check');
  if (isModule3(text, code)) add(checks, 'module3_content_check', 'core_field_consistency_check');
  if (isStability(text, code)) add(checks, 'shelf_life_consistency_check', 'module3_content_check');
  if (isSterility(text)) add(checks, 'sterility_validation_check');
  if (hasExpiryRequirement(text)) checks.add('document_expiry_check');
  if (hasFormattingRequirement(text)) checks.add('docx_format_check');
  if (hasLanguageRequirement(text)) checks.add('translation_length_check');
  if (hasConsistencyRequirement(text)) checks.add('core_field_consistency_check');

  return Array.from(checks);
}

export function inferLsRegistrationExpectedFields(rule: RuleLike, checkIds = inferLsRegistrationCheckIds(rule)): string[] {
  const text = ruleSearchText(rule);
  const code = normalizeCode(rule.doc_code);
  const fields = new Set<string>(['textContent', 'textLength']);

  if (checkIds.includes('document_expiry_check')) add(fields, 'validUntil', 'issueDate');
  if (checkIds.includes('gmp_certificate_check')) add(fields, 'validUntil', 'manufacturer', 'address', 'scope');
  if (checkIds.includes('cpp_certificate_check')) add(fields, 'validUntil', 'issueDate', 'country', 'tradeName', 'dosage', 'dosageForm', 'manufacturer');
  if (isSpc(text, code) || isInstruction(text, code)) add(fields, 'tradeName', 'inn', 'dosage', 'dosageForm', 'shelfLife', 'storage', 'fonts', 'sizes', 'colors');
  if (isLabeling(text, code) || isMockup(text, code)) add(fields, 'tradeName', 'inn', 'dosage', 'storage');
  if (checkIds.includes('shelf_life_consistency_check')) fields.add('shelfLife');
  if (checkIds.includes('storage_consistency_check')) fields.add('storage');
  if (checkIds.includes('bioequivalence_report_check')) add(fields, 'referenceProduct', 'dosage', 'dosageForm', 'conclusion');
  if (checkIds.includes('bioequivalence_waiver_check')) add(fields, 'waiverReason', 'justified', 'dosageForm');
  if (checkIds.includes('module3_content_check')) add(fields, 'hasSpecification', 'hasValidation', 'hasStability');
  if (checkIds.includes('sterility_validation_check')) add(fields, 'hasValidation');
  if (checkIds.includes('black_triangle_check')) fields.add('hasBlackTriangle');

  return Array.from(fields);
}

export function matchesLsRegistrationLegacyDocumentType(docType: DocumentType | undefined, targetId: string): boolean {
  if (!docType) return false;
  if (docType.id === targetId) return true;

  const text = documentTypeSearchText(docType);
  const code = normalizeCode(getDocumentTypeCode(docType));
  const checkIds = new Set(docType.checkIds || []);

  switch (targetId) {
    case 'doc-gmp':
      return checkIds.has('gmp_certificate_check') || isGmp(text);
    case 'doc-cpp':
      return checkIds.has('cpp_certificate_check') || isCpp(text, code);
    case 'doc-spc-ru':
    case 'doc-spc-kz':
      return checkIds.has('required_sections_check') && isSpc(text, code);
    case 'doc-instruction-ru':
    case 'doc-instruction-kz':
      return checkIds.has('required_sections_check') && isInstruction(text, code);
    case 'doc-labeling-text':
      return isLabeling(text, code);
    case 'doc-mockup':
      return isMockup(text, code);
    case 'doc-quality-nd':
      return isQualityDocument(text, code);
    case 'doc-module3':
      return checkIds.has('module3_content_check') || isModule3(text, code);
    case 'doc-stability':
      return isStability(text, code);
    case 'doc-foreign-registrations':
      return code === '1.2.3' || text.includes('регистрац') && text.includes('других стран');
    case 'doc-risk-management':
      return isRiskManagement(text, code);
    case 'doc-pharmacovigilance-master':
      return code === '1.6.1' || text.includes('мастер файл') || text.includes('фармаконадзор');
    case 'doc-pharmacovigilance-contact':
      return code === '1.6.4' || text.includes('контактное лицо') && text.includes('фармаконадзор');
    case 'doc-bioequivalence-report':
      return checkIds.has('bioequivalence_report_check') || isBioequivalenceReport(text);
    case 'doc-bioequivalence-waiver':
      return checkIds.has('bioequivalence_waiver_check') || isBioequivalenceWaiver(text);
    case 'doc-spc-comparison':
      return code === '1.3.6' || code === '1.3.7' || text.includes('построч') || text.includes('сравнен');
    default:
      return false;
  }
}

export function describeLsRegistrationCheckCoverage(rule: RuleLike) {
  const checkIds = inferLsRegistrationCheckIds(rule);
  const expectedFields = inferLsRegistrationExpectedFields(rule, checkIds);
  const semanticChecks = checkIds.filter((id) => !baseDocumentCheckIds.includes(id));
  return {
    checkIds,
    expectedFields,
    status: semanticChecks.length > 0 ? 'script_or_hybrid_mapped' : 'base_and_gemma_only',
  };
}

function add(target: Set<string>, ...values: string[]) {
  for (const value of values) target.add(value);
}

function getDocumentTypeCode(docType: DocumentType): string {
  return docType.importedRequirements?.find((item) => item.sourceDocumentCode)?.sourceDocumentCode || '';
}

function documentTypeSearchText(docType: DocumentType): string {
  return normalizeText([
    docType.id,
    docType.name,
    docType.description,
    docType.requirednessExplanation,
    docType.requiredWhenExpression,
    docType.validationChecksText,
    ...(docType.importedRequirements || []).flatMap((item) => [
      item.sourceDocumentCode,
      item.sourceDocumentName,
      item.requirementText,
      item.checkSubject,
      item.checkType,
    ]),
  ].filter(Boolean).join(' '));
}

function ruleSearchText(rule: RuleLike): string {
  const validationChecks = Array.isArray(rule.validation_checks) ? rule.validation_checks.join(' ') : '';
  return normalizeText([rule.doc_code, rule.document_name, rule.required_document, validationChecks].filter(Boolean).join(' '));
}

function normalizeCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/А/g, 'A')
    .replace(/\s+/g, '')
    .replace(/\.+$/g, '');
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\w\u0400-\u04ff\d.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGmp(text: string) {
  return text.includes('gmp') || text.includes('надлежащей производственной практики');
}

function isCpp(text: string, code: string) {
  return code === '1.2.1' || text.includes('сертификат на фармацевтический продукт') || text.includes('стране производител');
}

function isSpc(text: string, code: string) {
  return code === '1.3.1' || text.includes('общая характеристика лекарственного') || text.includes('охлп') || text.includes('охлс');
}

function isInstruction(text: string, code: string) {
  return code === '1.3.2' || code === '1.3.3' || text.includes('инструкция по медицинскому применению') || text.includes('листок вкладыш');
}

function isLabeling(text: string, code: string) {
  return code === '1.3.4' || text.includes('текст маркировк') || text.includes('маркировки первичной') || text.includes('маркировки вторичной');
}

function isMockup(text: string, code: string) {
  return code === '1.3.5' || text.includes('макет') || text.includes('этикет') || text.includes('стикер');
}

function isPharmacovigilance(text: string, code: string) {
  return code.startsWith('1.6') || text.includes('фармаконадзор');
}

function isRiskManagement(text: string, code: string) {
  return code === '1.6.3' || text.includes('план управления рисками');
}

function isBioequivalenceReport(text: string) {
  return text.includes('биоэквивалент') && !isBioequivalenceWaiver(text);
}

function isBioequivalenceWaiver(text: string) {
  return text.includes('биовейвер') || text.includes('обоснование отсутствия биоэквивалент');
}

function isModule3(text: string, code: string) {
  return code.startsWith('2.3') || code.startsWith('3.2') || text.includes('модуль 3') || text.includes('качество');
}

function isQualityDocument(text: string, code: string) {
  return isModule3(text, code) || text.includes('нормативный документ по качеству') || text.includes('спецификац');
}

function isStability(text: string, code: string) {
  return code.includes('P.8') || code.includes('S.7') || text.includes('стабильност') || text.includes('срок годности');
}

function isSterility(text: string) {
  return text.includes('стериль') || text.includes('асепт');
}

function hasExpiryRequirement(text: string) {
  return text.includes('срок действия') || text.includes('действующий сертификат') || text.includes('дата выдачи') || text.includes('дата инспекции');
}

function hasFormattingRequirement(text: string) {
  return text.includes('times new roman') || text.includes('шрифт') || text.includes('docx') || text.includes('doc ');
}

function hasLanguageRequirement(text: string) {
  return text.includes('казахск') && text.includes('русск');
}

function hasConsistencyRequirement(text: string) {
  return text.includes('сверить') || text.includes('соответствует') || text.includes('совпадает') || text.includes('адрес') || text.includes('состав') || text.includes('дозиров');
}
