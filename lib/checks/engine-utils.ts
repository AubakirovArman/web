import { Application, DocumentType, Finding, Rule, RuleCondition, Severity, UploadedFile } from '@/lib/types';
import { documentTypes, parameters } from '@/lib/data/seed';
import { enrichFinding } from '@/lib/checks/registry';
import { matchesLsRegistrationLegacyDocumentType } from '@/lib/document-requirements/ls-registration-check-mapping';

export type CheckScope = 'all' | 'params' | 'documents';

let runtimeDocumentTypesCatalog: DocumentType[] | null = null;

export function getDocumentTypesCatalog(): DocumentType[] {
  return runtimeDocumentTypesCatalog?.length ? runtimeDocumentTypesCatalog : documentTypes;
}

export function withDocumentTypesCatalog<T>(catalog: DocumentType[] | undefined, run: () => T): T {
  const previous = runtimeDocumentTypesCatalog;
  runtimeDocumentTypesCatalog = catalog?.length ? catalog : null;
  try {
    return run();
  } finally {
    runtimeDocumentTypesCatalog = previous;
  }
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDocName(id: string) {
  return getDocumentTypesCatalog().find((d) => d.id === id)?.name || id;
}

export function getDocType(id: string) {
  return getDocumentTypesCatalog().find((d) => d.id === id);
}

export function getOptionLabel(parameterId: string, value: string): string {
  const param = parameters.find((p) => p.id === parameterId);
  return param?.options?.find((option) => option.value === value)?.label || value;
}

export function normalize(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^\w\u0400-\u04ff\d]/g, '')
    .trim();
}

export function createFinding(
  severity: Severity,
  category: string,
  title: string,
  description: string,
  documents: string[],
  recommendation: string,
  quotes?: { source: string; text: string }[],
  npaReference?: string
): Finding {
  return {
    id: uid(),
    severity,
    category,
    title,
    description,
    documents,
    recommendation,
    quotes,
    npaReference,
  };
}

export function extract(file: UploadedFile, key: string): string | undefined {
  return file.extracted?.[key];
}

export function hasExtractedFieldValue(file: UploadedFile, fieldId: string): boolean {
  const value = file.extracted?.[fieldId];
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  if (!text) return false;
  const normalized = text.toLowerCase();
  if (['-', '—', 'нет', 'no', 'n/a', 'null', 'undefined', 'не указано', 'не найдено'].includes(normalized)) return false;
  if (fieldId === 'textContent') return text.length >= 20;
  if (fieldId === 'textLength') return Number(text) > 0;
  return true;
}

export function getMissingExpectedExtractedFields(file: UploadedFile, expectedFields: string[]): string[] {
  return expectedFields.filter((fieldId) => !hasExtractedFieldValue(file, fieldId));
}

export function findFile(app: Application, docTypeId: string): UploadedFile | undefined {
  const catalog = getDocumentTypesCatalog();
  return app.files.find((file) => {
    if (file.documentTypeId === docTypeId) return true;
    const docType = catalog.find((item) => item.id === file.documentTypeId);
    return matchesLsRegistrationLegacyDocumentType(docType, docTypeId);
  });
}

export function normalizeLoose(value: unknown): string {
  return normalize(String(value || ''));
}

export function stringValue(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(stringValue(value) || '') ?? fallback;
  } catch {
    return fallback;
  }
}

export function hasFilledValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

export function hasRequiredApplicationValue(values: Application['values'], fieldId: string): boolean {
  if (fieldId === 'param-atc-code' || fieldId === 'param-atc-name-ru') {
    return stringValue(values['param-atc-enabled']) !== 'yes' || hasFilledValue(values[fieldId]);
  }

  if (fieldId === 'param-administration-routes') {
    const routes = parseJsonValue<string[]>(values[fieldId], []);
    return routes.length > 0;
  }

  if (fieldId === 'param-composition-table') {
    const rows = parseJsonValue<Array<Record<string, string>>>(values[fieldId], []);
    return rows.some((row) => hasFilledValue(row.name) && hasFilledValue(row.quantity) && hasFilledValue(row.unit));
  }

  if (fieldId === 'param-variation-changes-table') {
    const rows = parseJsonValue<Array<Record<string, string>>>(values[fieldId], []);
    return rows.some((row) => hasFilledValue(row.changeType) && hasFilledValue(row.before) && hasFilledValue(row.after));
  }

  return hasFilledValue(values[fieldId]);
}

export function getApplicationTradeName(values: Application['values']): string {
  return stringValue(values['param-trade-name-ru']).trim() ||
    stringValue(values['param-trade-name-kz']).trim() ||
    stringValue(values['param-trade-name-en']).trim() ||
    stringValue(values['param-trade-name']).trim();
}

export function getApplicationInn(values: Application['values']): string {
  return stringValue(values['param-inn-ru']).trim() ||
    stringValue(values['param-inn-kz']).trim() ||
    stringValue(values['param-inn-en']).trim() ||
    stringValue(values['param-inn']).trim();
}

export function unitLabel(unit: string): string {
  const labels: Record<string, string> = {
    mg: 'мг',
    g: 'г',
    mcg: 'мкг',
    ml: 'мл',
    percent: '%',
    iu: 'МЕ',
    'mg-ml': 'мг/мл',
  };
  return labels[unit] || unit;
}

export function getApplicationDosage(values: Application['values']): string {
  const amount = stringValue(values['param-dosage-amount']).trim();
  const unit = stringValue(values['param-dosage-unit']).trim();
  return [amount, unit ? unitLabel(unit) : ''].filter(Boolean).join(' ') || stringValue(values['param-dosage']).trim();
}

export function isKazakhstanManufacturer(values: Application['values']): boolean {
  const country = normalizeLoose(values['param-manufacturer-country']);
  const address = normalizeLoose(values['param-manufacturer-address']);
  return ['kz', 'kazakhstan', 'казахстан', 'республикаказахстан', 'қазақстан'].includes(country) || address.includes('казахстан') || address.includes('kazakhstan');
}

export function isDossierSectionApplicable(app: Application, sectionId: string): boolean {
  if (sectionId === 'ls-country-registration' && isKazakhstanManufacturer(app.values)) {
    return false;
  }
  return true;
}

export const dossierEvidenceFormats = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

export function getAllowedFormats(file: UploadedFile, docTypeFormats: string[]): string[] {
  if (file.source === 'dossier-folder' || file.dossierSectionId) {
    return dossierEvidenceFormats;
  }
  return docTypeFormats;
}

export function matchesConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((condition) => {
    const value = values[condition.parameterId];
    const target = condition.value;
    switch (condition.operator) {
      case 'equals':
        return value === target;
      case 'notEquals':
        return value !== target;
      case 'notEmpty':
        return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : false;
      case 'includes':
        if (typeof value === 'string') return value.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(value)) return value.some((item) => item.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

export const alwaysEnabledCheckIds = new Set([
  'required_fields_check',
  'file_format_check',
  'ocr_quality_check',
  'expected_extracted_fields_check',
  'document_expiry_check',
  'required_document_presence_check',
  'npa_imported_requirement_check',
  'dossier_section_presence_check',
  'dossier_mapping_quality_check',
]);

export function getEnabledCheckIds(app: Application, rules: Rule[]): Set<string> {
  const enabled = new Set(alwaysEnabledCheckIds);
  for (const file of app.files) {
    const doc = getDocType(file.documentTypeId);
    for (const checkId of doc?.checkIds || []) enabled.add(checkId);
  }
  for (const rule of rules) {
    if (rule.active === false || !matchesConditions(app.values, rule.conditions)) continue;
    for (const req of rule.requiredDocuments) {
      for (const checkId of req.checks || []) enabled.add(checkId);
      const doc = getDocType(req.documentTypeId);
      for (const checkId of doc?.checkIds || []) enabled.add(checkId);
      if (req.alternativeDocumentTypeId) {
        const altDoc = getDocType(req.alternativeDocumentTypeId);
        for (const checkId of altDoc?.checkIds || []) enabled.add(checkId);
      }
    }
  }
  return enabled;
}

export function applyScopeAndRuleFilters(findings: Finding[], app: Application, rules: Rule[], scope: CheckScope): Finding[] {
  let scoped = findings;
  if (scope === 'params') {
    scoped = findings.filter((f) => f.category === 'Заявление');
  } else if (scope === 'documents') {
    scoped = findings.filter((f) => f.category !== 'Заявление');
  }

  const enriched = scoped.map(enrichFinding);
  if (!rules.length) return enriched;

  const enabledCheckIds = getEnabledCheckIds(app, rules);
  return enriched.filter((finding) => {
    const checkerId = finding.checkerId || '';
    return alwaysEnabledCheckIds.has(checkerId) || enabledCheckIds.has(checkerId);
  });
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!parts) return null;
  const date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T00:00:00`);
  return isNaN(date.getTime()) ? null : date;
}

export function isExpired(dateStr: string): boolean {
  const date = parseDate(dateStr);
  return !!date && date < new Date();
}

export function daysUntil(dateStr: string): number | null {
  const date = parseDate(dateStr);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
