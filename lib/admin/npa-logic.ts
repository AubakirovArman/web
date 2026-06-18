import { npas } from '@/lib/data/seed';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import type { DocumentType, DocumentTypeRequirement, Severity } from '@/lib/types';
import { npaActTypeOptions, type AdminNpaDraft, type AdminNpaRecord, type AdminNpaRequirement, type NpaGemmaPreview } from '@/lib/admin/admin-page-types';
import { mergeImportedRequirements, parseListInput, renderGemmaValue, uniqueList } from '@/lib/admin/document-type-logic';

export function createBlankNpaDraft(): AdminNpaDraft {
  return {
    name: '',
    actType: npaActTypeOptions[0],
    number: '',
    date: '',
    revision: '',
    file: null,
    requirements: [],
  };
}

export function buildInitialNpaRegistry(): AdminNpaRecord[] {
  return npas.map((npa) => ({
    id: npa.id,
    name: npa.name,
    actType: inferActTypeFromNpaName(npa.name),
    number: npa.number || '',
    date: npa.date || '',
    revision: '',
    area: npa.direction,
    requirements: [],
    createdAt: new Date().toISOString(),
  }));
}

export function inferActTypeFromNpaName(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('решение совета')) return 'Решение Совета ЕЭК';
  if (lower.includes('решение коллегии')) return 'Решение Коллегии ЕЭК';
  if (lower.includes('кодекс')) return 'Кодекс РК';
  if (lower.includes('приказ')) return 'Приказ';
  return 'Иное';
}

export function normalizeNpaRequirementsFromPreview(preview: NpaGemmaPreview): AdminNpaRequirement[] {
  const sourceItems = preview.extraction.requirements.length
    ? preview.extraction.requirements
    : preview.extraction.document_types.map((item) => ({
      ...item,
      document_code: item.code,
      document_name: item.name,
      requirement_text: [
        renderGemmaValue(item.requiredness),
        renderGemmaValue(item.applicability_condition),
      ].filter(Boolean).join('. '),
      check_type: 'обязательность документа',
    }));

  return sourceItems.map((item, index) => {
    const requirement = pickGemmaString(item, [
      'requirement_text',
      'requirement',
      'text',
      'description',
      'check_subject',
    ]);
    return {
      id: makeClientId(`req-${index + 1}`),
      code: pickGemmaString(item, ['code', 'requirement_code', 'id']) || `REQ-${index + 1}`,
      point: pickGemmaString(item, ['source_point', 'point', 'section', 'paragraph']),
      requirement: requirement || `Требование ${index + 1}`,
      criticality: pickGemmaString(item, ['criticality', 'severity']) || 'неясно',
      action: 'accepted',
      documentCode: pickGemmaString(item, ['document_code', 'doc_code']),
      documentName: pickGemmaString(item, ['document_name', 'document', 'document_type']),
      checkType: pickGemmaString(item, ['check_type', 'check_subject', 'type']),
      condition: pickGemmaString(item, ['applicability_condition', 'condition', 'when']),
      quote: pickGemmaString(item, ['quote', 'source_quote']),
      targetDocumentTypeId: pickGemmaString(item, ['target_document_type_id', 'document_type_id']),
    };
  });
}

export function guessRequirementTargetDocumentType(requirement: AdminNpaRequirement, documentTypes: DocumentType[]): DocumentType | undefined {
  const requirementCode = normalizeNpaMatchValue(requirement.documentCode || requirement.code);
  const requirementName = normalizeNpaMatchValue(requirement.documentName || requirement.requirement);

  if (requirementCode) {
    const exactCode = documentTypes.find((doc) =>
      normalizeNpaMatchValue(doc.importedRequirements?.[0]?.sourceDocumentCode).includes(requirementCode) ||
      normalizeNpaMatchValue(doc.id).includes(requirementCode)
    );
    if (exactCode) return exactCode;
  }

  if (requirementName) {
    const exactName = documentTypes.find((doc) => normalizeNpaMatchValue(doc.name).includes(requirementName));
    if (exactName) return exactName;

    const tokens = requirementName.split(' ').filter((token) => token.length > 3).slice(0, 6);
    if (tokens.length) {
      const scored = documentTypes
        .map((doc) => ({
          doc,
          score: tokens.filter((token) => normalizeNpaMatchValue(doc.name).includes(token)).length,
        }))
        .filter((item) => item.score >= Math.min(2, tokens.length))
        .sort((a, b) => b.score - a.score);
      return scored[0]?.doc;
    }
  }

  return undefined;
}

export function normalizeNpaMatchValue(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\w\u0400-\u04ff\d.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyNpaRequirementsToDocumentTypes(record: AdminNpaRecord, catalog: DocumentType[]) {
  const incomingByDocumentTypeId = new Map<string, DocumentTypeRequirement[]>();
  for (const requirement of record.requirements) {
    if (requirement.action !== 'accepted' || !requirement.targetDocumentTypeId) continue;
    const incoming = buildDocumentTypeRequirementFromNpa(record, requirement);
    incomingByDocumentTypeId.set(requirement.targetDocumentTypeId, [
      ...(incomingByDocumentTypeId.get(requirement.targetDocumentTypeId) || []),
      incoming,
    ]);
  }

  let count = 0;
  const documentTypes = catalog.map((doc) => {
    const incoming = incomingByDocumentTypeId.get(doc.id);
    if (!incoming?.length) return doc;
    count += incoming.length;
    const mergedChecks = uniqueList([...(doc.checkIds || []), ...incoming.flatMap((requirement) => parseListInput(requirement.checkType || ''))]);
    const firstIncoming = incoming[0];
    return {
      ...doc,
      checkIds: mergedChecks.length ? mergedChecks : doc.checkIds,
      requiredWhenExpression: doc.requiredWhenExpression || firstIncoming.applicabilityCondition,
      severityIfMissing: doc.severityIfMissing || normalizeNpaCriticality(firstIncoming.criticality),
      validationChecksText: mergeTextValues(doc.validationChecksText, incoming.map((requirement) => requirement.requirementText)),
      linkedApplicationParams: uniqueList([
        ...(doc.linkedApplicationParams || []),
        ...incoming.flatMap((requirement) => extractParamIds(requirement.applicabilityCondition || '')),
      ]),
      npaReferences: uniqueList([...(doc.npaReferences || []), buildNpaRecordReference(record)]),
      importedRequirements: mergeImportedRequirements(doc.importedRequirements || [], incoming),
    } satisfies DocumentType;
  });

  return { count, documentTypes };
}

export function applyNpaRequirementsToNewDossierTypes(record: AdminNpaRecord, items: NewDossierDocumentType[]) {
  const incomingById = new Map<string, AdminNpaRequirement[]>();
  for (const requirement of record.requirements) {
    const targetDocumentTypeId = requirement.targetDocumentTypeId;
    if (requirement.action !== 'accepted' || !isLsDossierDocumentTypeId(targetDocumentTypeId)) continue;
    incomingById.set(targetDocumentTypeId, [
      ...(incomingById.get(targetDocumentTypeId) || []),
      requirement,
    ]);
  }

  if (incomingById.size === 0) return { changed: false, items };

  return {
    changed: true,
    items: items.map((item) => {
      const incoming = incomingById.get(item.id);
      if (!incoming?.length) return item;
      const first = incoming[0];
      return {
        ...item,
        requiredWhenExpression: item.requiredWhenExpression || first.condition || undefined,
        requirednessExplanation: item.requirednessExplanation || first.requirement || undefined,
        validationChecks: mergeTextValues(item.validationChecks, incoming.map((requirement) => requirement.requirement)),
        severityIfMissing: item.severityIfMissing || normalizeNpaCriticality(first.criticality),
        checkIds: uniqueList([...(item.checkIds || []), ...incoming.flatMap((requirement) => inferCheckIdsFromNpaRequirement(requirement))]),
        linkedApplicationParams: uniqueList([
          ...(item.linkedApplicationParams || []),
          ...incoming.flatMap((requirement) => extractParamIds(requirement.condition)),
        ]),
      } satisfies NewDossierDocumentType;
    }),
  };
}

function isLsDossierDocumentTypeId(documentTypeId?: string): documentTypeId is string {
  return Boolean(documentTypeId?.startsWith('new-ls-') || documentTypeId?.startsWith('memo-ls-'));
}

export function buildDocumentTypeRequirementFromNpa(record: AdminNpaRecord, requirement: AdminNpaRequirement): DocumentTypeRequirement {
  return {
    id: `npa-${record.id}-${requirement.id}`,
    source: 'manual',
    sourceDocumentCode: requirement.documentCode || requirement.code,
    sourceDocumentName: requirement.documentName,
    checkSubject: requirement.documentName || requirement.requirement,
    checkType: inferCheckIdsFromNpaRequirement(requirement).join(', '),
    requirementText: requirement.requirement,
    criticality: requirement.criticality,
    applicabilityCondition: requirement.condition,
    sourcePoint: requirement.point,
    quote: requirement.quote,
    importedAt: new Date().toISOString(),
  };
}

export function buildNpaRecordReference(record: AdminNpaRecord) {
  return [record.actType, record.name, record.number, record.date].filter(Boolean).join(' · ');
}

export function normalizeNpaCriticality(value: unknown): Severity {
  const text = String(value || '').toLowerCase();
  if (text.includes('крит') || text.includes('critical')) return 'critical';
  if (text.includes('знач') || text.includes('serious') || text.includes('significant')) return 'serious';
  if (text.includes('неяс') || text.includes('unknown')) return 'unknown';
  return 'warning';
}

export function inferCheckIdsFromNpaRequirement(requirement: AdminNpaRequirement): string[] {
  const text = `${requirement.checkType} ${requirement.requirement} ${requirement.documentName}`.toLowerCase();
  const checks = new Set<string>(['required_document_presence_check']);
  if (text.includes('формат') || text.includes('pdf') || text.includes('word')) checks.add('file_format_check');
  if (text.includes('ocr') || text.includes('распозна')) checks.add('ocr_quality_check');
  if (text.includes('свер') || text.includes('соответств') || text.includes('заяв')) checks.add('core_field_consistency_check');
  if (text.includes('gmp')) checks.add('gmp_certificate_check');
  if (text.includes('cpp') || text.includes('сертификат фармацевтического продукта')) checks.add('cpp_certificate_check');
  if (text.includes('срок год') || text.includes('стабил')) checks.add('shelf_life_consistency_check');
  if (text.includes('хранен') || text.includes('транспорт')) checks.add('storage_consistency_check');
  if (text.includes('стерил')) checks.add('sterility_validation_check');
  if (text.includes('биоэквивалент')) checks.add('bioequivalence_report_check');
  if (text.includes('фармаконадзор') || text.includes('пур')) checks.add('pharmacovigilance_contact_check');
  if (text.includes('модуль 3') || text.includes('качество')) checks.add('module3_content_check');
  return Array.from(checks);
}

export function mergeTextValues(existing: string | undefined, incoming: string[]) {
  const parts = uniqueList([
    ...(existing || '').split('|'),
    ...incoming,
  ]);
  return parts.join(' | ') || undefined;
}

export function extractParamIds(value: string) {
  return Array.from(new Set((value.match(/param-[a-z0-9-]+/gi) || []).map((item) => item.trim())));
}

export function pickGemmaString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const rendered = renderGemmaValue(item[key]);
    if (rendered) return rendered;
  }
  return '';
}

export function makeClientId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}
