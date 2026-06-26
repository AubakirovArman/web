import type { AdminNpaRecord, AdminNpaRequirement, NpaGemmaPreview } from '@/lib/admin/admin-page-types';
import { getGemmaDocumentKey, requirementBelongsToGemmaDocument } from '@/lib/admin/document-type-logic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function recordIdFrom(preview: NpaGemmaPreview): string {
  const base = str(preview.document?.number) || str(preview.document?.title) || preview.previewId;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug && /[0-9]/.test(slug) ? `npa-${slug}` : `npa-upload-${Date.now().toString(36)}`;
}

/**
 * Собирает запись реестра НПА из результата Gemma-превью.
 * Привязки типов документов (mappings: ключ gemma-документа → documentTypeId) проставляются
 * в targetDocumentTypeId у соответствующих требований. Без маппингов запись всё равно валидна.
 */
export function buildNpaRecordFromPreview(
  preview: NpaGemmaPreview,
  mappings: Record<string, string> = {},
): AdminNpaRecord {
  const extraction = (preview.extraction || {}) as Record<string, unknown>;
  const docTypes = Array.isArray(extraction.document_types)
    ? (extraction.document_types as Record<string, unknown>[])
    : [];
  const rawReqs = Array.isArray(extraction.requirements)
    ? (extraction.requirements as Record<string, unknown>[])
    : [];
  const recordId = recordIdFrom(preview);

  const requirements: AdminNpaRequirement[] = rawReqs.map((r, index): AdminNpaRequirement => {
    let target: string | undefined;
    const docIndex = docTypes.findIndex((d) => requirementBelongsToGemmaDocument(r, d));
    if (docIndex >= 0) {
      const key = getGemmaDocumentKey(docTypes[docIndex], docIndex);
      if (mappings[key]) target = mappings[key];
    }
    return {
      id: `${recordId}-req-${index + 1}`,
      code: str(r.document_code),
      point: str(r.source_point),
      requirement: str(r.requirement_text) || `Требование ${index + 1}`,
      criticality: str(r.criticality) || 'неясно',
      action: 'accepted',
      documentCode: str(r.document_code),
      documentName: str(r.document_name),
      checkType: str(r.check_type),
      condition: str(r.applicability_condition),
      quote: str(r.quote),
      targetDocumentTypeId: target,
    };
  });

  const doc = preview.document || ({} as NpaGemmaPreview['document']);
  const act = (extraction.act || {}) as Record<string, unknown>;
  return {
    id: recordId,
    name: str(doc.title) || 'НПА',
    actType: str(act.type) || str(act.actType) || '',
    number: str(doc.number),
    date: str(doc.date),
    revision: '',
    fileName: str(doc.fileName) || undefined,
    area: str(extraction.area) || str(doc.domain) || undefined,
    requirements,
    createdAt: new Date().toISOString(),
  };
}
