import { parameters } from '@/lib/data/seed';
import type { DocumentType, DocumentTypeRequirement, Rule, RuleSource } from '@/lib/types';
import type { NpaGemmaPreview } from '@/lib/admin/admin-page-types';

export function createBlankDocumentType(existing: DocumentType[]): DocumentType {
  const base = `doc-custom-${Date.now().toString(36)}`;
  let id = base;
  let index = 2;
  while (existing.some((doc) => doc.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return {
    id,
    name: '',
    description: '',
    acceptedFormats: ['pdf', 'docx'],
    direction: 'both',
    requiredLanguages: [],
    expectedExtractedFields: [],
    checkIds: ['required_document_presence_check', 'file_format_check'],
    npaReferences: [],
    importedRequirements: [],
    needsOcr: true,
    canCheckFont: true,
    canCheckExpiry: false,
    canCheckSignature: true,
    canCheckSeal: true,
    isPhysicalSample: false,
    requirednessExplanation: '',
  };
}

export function cloneDocumentType(doc: DocumentType): DocumentType {
  return {
    ...doc,
    acceptedFormats: [...(doc.acceptedFormats || [])],
    requiredLanguages: [...(doc.requiredLanguages || [])],
    expectedExtractedFields: [...(doc.expectedExtractedFields || [])],
    checkIds: [...(doc.checkIds || [])],
    npaReferences: [...(doc.npaReferences || [])],
    importedRequirements: [...(doc.importedRequirements || [])],
  };
}

export function normalizeDocumentType(doc: DocumentType): DocumentType {
  const acceptedFormats = uniqueList(doc.acceptedFormats || []).map((item) => item.toLowerCase());
  return {
    ...doc,
    id: slugifyDocumentTypeId(doc.id),
    name: doc.name.trim(),
    description: doc.description?.trim() || undefined,
    acceptedFormats,
    requiredLanguages: uniqueList(doc.requiredLanguages || []),
    expectedExtractedFields: uniqueList(doc.expectedExtractedFields || []),
    checkIds: uniqueList(doc.checkIds || []),
    npaReferences: uniqueList(doc.npaReferences || []),
    requirednessExplanation: doc.requirednessExplanation?.trim() || undefined,
    needsOcr: doc.needsOcr ?? acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format)),
    canCheckFont: doc.canCheckFont ?? acceptedFormats.some((format) => ['doc', 'docx'].includes(format)),
    canCheckSignature: doc.canCheckSignature ?? acceptedFormats.includes('pdf'),
    canCheckSeal: doc.canCheckSeal ?? acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format)),
  };
}

export function countDocumentTypeRuleReferences(rules: Rule[], documentTypeId: string) {
  return rules.filter((rule) =>
    rule.requiredDocuments.some(
      (req) => req.documentTypeId === documentTypeId || req.alternativeDocumentTypeId === documentTypeId,
    ),
  ).length;
}

export function parseListInput(value: string) {
  return uniqueList(value.split(/[\n,;]/));
}

export function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function slugifyDocumentTypeId(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.startsWith('doc-') || !cleaned ? cleaned || 'doc-custom' : `doc-${cleaned}`;
}

export function getGemmaDocumentKey(item: Record<string, unknown>, index: number) {
  const code = renderGemmaValue(item.code);
  const name = renderGemmaValue(item.name);
  return `${code || 'no-code'}::${name || `doc-${index}`}`;
}

export function requirementBelongsToGemmaDocument(requirement: Record<string, unknown>, gemmaDoc: Record<string, unknown>) {
  const docCode = normalizeGemmaCompareValue(requirement.document_code);
  const gemmaCode = normalizeGemmaCompareValue(gemmaDoc.code);
  if (docCode && gemmaCode && docCode === gemmaCode) return true;

  const docName = normalizeGemmaCompareValue(requirement.document_name);
  const gemmaName = normalizeGemmaCompareValue(gemmaDoc.name);
  if (!docName || !gemmaName) return false;
  return docName.includes(gemmaName) || gemmaName.includes(docName);
}

export function buildRequirementsFromGemma(
  preview: NpaGemmaPreview,
  gemmaDoc: Record<string, unknown>,
  requirements: Record<string, unknown>[],
  importedAt: string,
): DocumentTypeRequirement[] {
  const sourceDocumentCode = renderGemmaValue(gemmaDoc.code);
  const sourceDocumentName = renderGemmaValue(gemmaDoc.name);
  const rows = requirements.length
    ? requirements
    : [
        {
          document_code: sourceDocumentCode,
          document_name: sourceDocumentName,
          procedure: renderGemmaValue(gemmaDoc.procedure),
          requirement_text: [
            renderGemmaValue(gemmaDoc.requiredness),
            renderGemmaValue(gemmaDoc.applicability_condition),
          ].filter(Boolean).join(': '),
          source_point: renderGemmaValue(gemmaDoc.source_point),
          quote: renderGemmaValue(gemmaDoc.quote),
        },
      ];

  const result: DocumentTypeRequirement[] = [];
  rows.forEach((row, index) => {
    const requirementText = renderGemmaValue(row['requirement_text']) || renderGemmaValue(row['check_subject']);
    if (!requirementText) return;
    result.push({
        id: `gemma-${preview.previewId}-${sourceDocumentCode || sourceDocumentName || 'doc'}-${index}`,
        source: 'gemma' as const,
        previewId: preview.previewId,
        sourceDocumentCode: renderGemmaValue(row['document_code']) || sourceDocumentCode,
        sourceDocumentName: renderGemmaValue(row['document_name']) || sourceDocumentName,
        procedure: renderGemmaValue(row['procedure']),
        checkSubject: renderGemmaValue(row['check_subject']),
        checkType: renderGemmaValue(row['check_type']),
        requirementText,
        criticality: renderGemmaValue(row['criticality']),
        applicabilityCondition: renderGemmaValue(row['applicability_condition']),
        sourcePoint: renderGemmaValue(row['source_point']),
        quote: renderGemmaValue(row['quote']),
        importedAt,
    });
  });
  return result;
}

export function mergeImportedRequirements(existing: DocumentTypeRequirement[], incoming: DocumentTypeRequirement[]) {
  const map = new Map<string, DocumentTypeRequirement>();
  for (const requirement of [...existing, ...incoming]) {
    const key = [
      requirement.sourceDocumentCode || '',
      requirement.sourceDocumentName || '',
      requirement.sourcePoint || '',
      requirement.requirementText,
    ].join('|');
    if (!map.has(key)) map.set(key, requirement);
  }
  return Array.from(map.values());
}

export function buildGemmaSourceReference(preview: NpaGemmaPreview) {
  const act = preview.extraction.act || {};
  const actTitle = renderGemmaValue(act.title);
  const actNumber = renderGemmaValue(act.number);
  const actDate = renderGemmaValue(act.date);
  return ['Gemma', actTitle || preview.document.title, actNumber, actDate].filter(Boolean).join(' · ');
}

export function normalizeGemmaCompareValue(value: unknown) {
  return renderGemmaValue(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactGemmaPreview(preview: NpaGemmaPreview): NpaGemmaPreview {
  return {
    ...preview,
    document: {
      ...preview.document,
      sampleSections: preview.document.sampleSections.slice(0, 30).map((section) => ({
        ...section,
        text: section.text.slice(0, 350),
      })),
    },
  };
}

export function findDocumentRequirement(rule: Rule, documentTypeId: string) {
  return rule.requiredDocuments.find(
    (req) => req.documentTypeId === documentTypeId || req.alternativeDocumentTypeId === documentTypeId,
  );
}

export function formatRuleConditions(rule: Rule) {
  if (!rule.conditions.length) return 'всегда';
  return rule.conditions
    .map((condition) => {
      const param = parameters.find((item) => item.id === condition.parameterId);
      return `${param?.label || condition.parameterId} ${condition.operator} ${condition.value || ''}`.trim();
    })
    .join(' AND ');
}

export function uniqueRuleSources(sources: RuleSource[]) {
  const map = new Map<string, RuleSource>();
  for (const source of sources) {
    const key = [
      source.npaId || '',
      source.sourceDocumentId || '',
      source.sourceSection || '',
      source.sourceQuote || '',
    ].join('|');
    if (!map.has(key)) map.set(key, source);
  }
  return Array.from(map.values());
}

export function renderGemmaValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(renderGemmaValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}


export function buildReferenceHref(source: RuleSource) {
  const params = new URLSearchParams();
  if (source.sourceDocumentId) params.set('doc', source.sourceDocumentId);
  const query = source.sourceQuote || source.sourceSection || '';
  if (query) params.set('q', query);
  const base = `/reference${params.toString() ? `?${params.toString()}` : ''}`;
  return source.sourceAnchor ? `${base}#${source.sourceAnchor}` : base;
}
