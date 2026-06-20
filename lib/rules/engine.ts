import { Application, ChecklistItem, DocumentType, Finding, RequiredDoc, RuleCondition } from '@/lib/types';
import { documentTypes, npas, rules as seedRules } from '@/lib/data/seed';
import {
  getLsDossierDocumentTypeById,
  getLsRequiredDossierDocuments,
  matchesLsRequirementTriggerExpression,
  type LsDossierSource,
} from '@/lib/data/ls-document-checks-mapping';
import { Rule } from '@/lib/types';
import { evaluateCondition, hasCondition } from '@/lib/rules/condition-evaluator';

export function getRequiredDocuments(
  app: Application,
  rules: Rule[] = seedRules,
  availableDocumentTypes?: DocumentType[],
): RequiredDoc[] {
  if (app.values['param-object-type'] === 'LS') {
    const adminConfigured = getAdminConfiguredLsRequiredDocuments(app.values, availableDocumentTypes);
    if (adminConfigured.length > 0) return adminConfigured;
    return filterByAvailableDocumentTypes(
      withoutWholeDossierDocuments(getLsRequiredDossierDocuments(app.values)),
      availableDocumentTypes,
    );
  }

  const result: RequiredDoc[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (rule.active === false) continue;
    if (!matchesConditions(app.values, rule.conditions)) continue;
    for (const req of rule.requiredDocuments) {
      if (isWholeDossierDocument(req.documentTypeId)) continue;
      if (seen.has(req.documentTypeId)) continue;
      seen.add(req.documentTypeId);
      result.push({
        documentTypeId: req.documentTypeId,
        severityIfMissing: req.severityIfMissing,
        alternativeDocumentTypeId: req.alternativeDocumentTypeId,
        checks: req.checks,
      });
    }
  }
  return filterByAvailableDocumentTypes(result, availableDocumentTypes);
}

function isWholeDossierDocument(documentTypeId: string) {
  return ['doc-registration-dossier', 'doc-mi-registration-dossier'].includes(documentTypeId);
}

function withoutWholeDossierDocuments(items: RequiredDoc[]) {
  return items.filter((item) => !isWholeDossierDocument(item.documentTypeId));
}

function filterByAvailableDocumentTypes(items: RequiredDoc[], availableDocumentTypes?: DocumentType[]) {
  if (!availableDocumentTypes?.length) return items;
  const availableIds = new Set(availableDocumentTypes.map((doc) => doc.id));
  return items.filter((item) => availableIds.has(item.documentTypeId) || !!item.alternativeDocumentTypeId && availableIds.has(item.alternativeDocumentTypeId));
}

function getAdminConfiguredLsRequiredDocuments(
  values: Application['values'],
  availableDocumentTypes?: DocumentType[],
): RequiredDoc[] {
  if (!availableDocumentTypes?.length) return [];

  const result: RequiredDoc[] = [];
  const seen = new Set<string>();

  for (const doc of availableDocumentTypes) {
    if (!isLsDossierDocumentTypeId(doc.id)) continue;
    if (doc.direction !== 'LS' && doc.direction !== 'both') continue;

    const source = inferLsDossierSourceFromDocumentTypeId(doc.id);
    const requirement = doc.importedRequirements?.[0];

    // Приоритет: структурированный предикат из condition_json (точный).
    // Fallback: устаревший текстовый триггер (хрупкий, оставлен для совместимости).
    if (hasCondition(doc.requiredWhenCondition)) {
      if (!evaluateCondition(doc.requiredWhenCondition, values)) continue;
    } else {
      const trigger = doc.requiredWhenExpression || requirement?.applicabilityCondition || '';
      if (!trigger) continue;
      if (!matchesLsRequirementTriggerExpression(trigger, values, source)) continue;
    }
    if (seen.has(doc.id)) continue;

    seen.add(doc.id);
    result.push({
      documentTypeId: doc.id,
      severityIfMissing: normalizeRequiredDocSeverity(doc.severityIfMissing || requirement?.criticality),
      checks: doc.checkIds?.length ? doc.checkIds : parseCheckIds(requirement?.checkType),
    });
  }

  return result;
}

function inferLsDossierSourceFromDocumentTypeId(documentTypeId: string): LsDossierSource | undefined {
  if (documentTypeId.includes('appendix-2')) return 'appendix-2';
  if (documentTypeId.includes('appendix-3')) return 'appendix-3';
  return undefined;
}

function isLsDossierDocumentTypeId(documentTypeId: string) {
  return documentTypeId.startsWith('new-ls-') || documentTypeId.startsWith('memo-ls-');
}

function normalizeRequiredDocSeverity(value: unknown): RequiredDoc['severityIfMissing'] {
  const text = String(value || '').toLowerCase();
  if (text.includes('critical') || text.includes('крит')) return 'critical';
  if (text.includes('serious') || text.includes('significant') || text.includes('знач')) return 'serious';
  if (text.includes('unknown') || text.includes('неиз')) return 'unknown';
  return 'warning';
}

function parseCheckIds(value: unknown): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((c) => {
    const v = values[c.parameterId];
    const target = c.value;
    switch (c.operator) {
      case 'equals':
        return v === target;
      case 'notEquals':
        return v !== target;
      case 'notEmpty':
        return typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;
      case 'includes':
        if (typeof v === 'string') return v.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(v)) return v.some((x) => x.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

export function buildChecklist(app: Application, rules: Rule[] = seedRules): ChecklistItem[] {
  const required = getRequiredDocuments(app, rules);
  return required.map((req) => {
    const file = findUploadedRequiredFile(app, req);
    return {
      documentTypeId: req.documentTypeId,
      required: true,
      uploaded: !!file,
      fileId: file?.id,
      severityIfMissing: req.severityIfMissing,
      alternativeDocumentTypeId: req.alternativeDocumentTypeId,
      matchedDocumentTypeId: file?.documentTypeId,
      checks: req.checks,
    };
  });
}

export function findUploadedRequiredFile(app: Application, req: RequiredDoc) {
  return app.files.find((file) => fileMatchesRequiredDocument(app, file, req));
}

function fileMatchesRequiredDocument(app: Application, file: Application['files'][number], req: RequiredDoc): boolean {
  if (file.documentTypeId === req.documentTypeId || file.documentTypeId === req.alternativeDocumentTypeId) return true;

  if (app.values['param-object-type'] !== 'LS') return false;
  if (!isLsDossierDocumentTypeId(req.documentTypeId)) return false;

  const requiredItem = getLsDossierDocumentTypeById(req.documentTypeId);
  if (!requiredItem) return false;

  const requiredCode = normalizeCtdCode(requiredItem.code);
  const requiredName = normalizeText(requiredItem.name);
  const fileCodes = extractFileCtdCodes(file);
  const fileText = normalizeText([
    file.name,
    file.originalName,
    file.relativePath,
    file.dossierFolderName,
    file.dossierSectionName,
    file.dossierSectionCode,
  ].filter(Boolean).join(' '));

  if (requiredCode) return fileCodes.some((code) => ctdCodeCoversRequired(requiredCode, code));
  if (requiredName) {
    const exactSectionName = normalizeText(file.dossierSectionName);
    const exactFolderName = normalizeText(file.dossierFolderName);
    return exactSectionName === requiredName || exactFolderName === requiredName;
  }

  if (requiredCode === '2.1') {
    return fileCodes.some((code) => /^(2|3|4|5)\./.test(code));
  }

  return false;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\w\u0400-\u04ff\d.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCtdCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function ctdSummaryToDetailedPrefix(code: string): string {
  if (code.startsWith('2.3.P')) return code.replace(/^2\.3\.P/, '3.2.P');
  if (code.startsWith('2.3.S')) return code.replace(/^2\.3\.S/, '3.2.S');
  if (code === '2.3') return '3.2';
  return code;
}

function ctdCodeCoversRequired(requiredCode: string, fileCode: string): boolean {
  if (!requiredCode || !fileCode) return false;
  return normalizeCtdCode(requiredCode) === normalizeCtdCode(fileCode);
}

function extractFileCtdCodes(file: Application['files'][number]): string[] {
  const source = [
    file.name,
    file.originalName,
    file.relativePath,
    file.dossierFolderName,
    file.dossierSectionName,
    file.dossierSectionCode,
    getLsDossierDocumentTypeById(file.documentTypeId)?.code,
  ].filter(Boolean).join(' ');

  const matches = source.match(/\b[1-5](?:\.\d+)+(?:\.[SPР])?(?:\.\d+)*\.?/gi) || [];
  return Array.from(new Set(matches.map(normalizeCtdCode).filter(Boolean))).sort((a, b) => b.length - a.length);
}

export function evaluateMissingDocuments(
  app: Application,
  rules: Rule[] = seedRules,
  availableDocumentTypes?: DocumentType[],
): Finding[] {
  return evaluateMissingRequiredDocuments(app, getRequiredDocuments(app, rules, availableDocumentTypes), availableDocumentTypes, rules);
}

export function evaluateMissingRequiredDocuments(
  app: Application,
  requiredDocuments: RequiredDoc[],
  availableDocumentTypes?: DocumentType[],
  rules: Rule[] = [],
): Finding[] {
  const checklist = requiredDocuments.map((req) => {
    const file = findUploadedRequiredFile(app, req);
    return {
      documentTypeId: req.documentTypeId,
      required: true,
      uploaded: !!file,
      fileId: file?.id,
      severityIfMissing: req.severityIfMissing,
      alternativeDocumentTypeId: req.alternativeDocumentTypeId,
      matchedDocumentTypeId: file?.documentTypeId,
      checks: req.checks,
    } satisfies ChecklistItem;
  });
  const findings: Finding[] = [];
  const documentTypesCatalog = availableDocumentTypes?.length ? availableDocumentTypes : documentTypes;
  for (const item of checklist) {
    if (item.uploaded) continue;
    const docType = documentTypesCatalog.find((d) => d.id === item.documentTypeId);
    const altDocType = item.alternativeDocumentTypeId
      ? documentTypesCatalog.find((d) => d.id === item.alternativeDocumentTypeId)
      : undefined;
    const rule = rules.find((r) => r.requiredDocuments.some((d) => d.documentTypeId === item.documentTypeId));
    const npa = rule?.sourceNpaId ? npas.find((n) => n.id === rule.sourceNpaId) : undefined;
    const alternatives = altDocType ? ` Допустимая альтернатива: «${altDocType.name}».` : '';
    const formats = [
      docType?.acceptedFormats.join(', '),
      altDocType ? `${altDocType.name}: ${altDocType.acceptedFormats.join(', ')}` : undefined,
    ]
      .filter(Boolean)
      .join('; ');

    findings.push({
      id: `missing-${item.documentTypeId}-${Date.now()}`,
      severity: item.severityIfMissing,
      category: 'Комплектность',
      title: `Отсутствует документ: ${docType?.name || item.documentTypeId}`,
      description: `Документ «${docType?.name || item.documentTypeId}» отмечен как обязательный для данного типа заявки, но не загружен.${alternatives}`,
      documents: [docType?.name || item.documentTypeId, altDocType?.name].filter(Boolean) as string[],
      recommendation: `Загрузите ${docType?.name || item.documentTypeId}${altDocType ? ` или ${altDocType.name}` : ''} в формате ${formats || 'PDF'}.`,
      npaReference: npa ? `${npa.number} от ${npa.date}` : undefined,
      checkerId: 'required_document_presence_check',
      confidence: 1,
      status: 'open',
    });
  }
  return findings;
}
