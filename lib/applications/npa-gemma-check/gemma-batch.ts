import type { DocumentRequirementCheckResult, DocumentRequirementCheckStatus, DocumentType, DocumentTypeRequirement, UploadedFile } from '@/lib/types';
import type { DocumentCheckCandidate, DocumentImagePage } from '@/lib/document-checker/types';

export function chunkRequirements(requirements: DocumentTypeRequirement[], chunkSize: number): DocumentTypeRequirement[][] {
  const chunks: DocumentTypeRequirement[][] = [];
  for (let index = 0; index < requirements.length; index += chunkSize) chunks.push(requirements.slice(index, index + chunkSize));
  return chunks;
}

export async function evaluateBatch(
  docType: DocumentType,
  file: UploadedFile,
  text: string,
  requirements: DocumentTypeRequirement[],
  candidate?: DocumentCheckCandidate,
  imagePages: DocumentImagePage[] = [],
): Promise<DocumentRequirementCheckResult[]> {
  const checkerUrl = process.env.GEMMA_CHECKER_URL || process.env.NDDA_GEMMA_CHECKER_URL;
  if (!checkerUrl) throw new Error('GEMMA_CHECKER_URL is required. Direct/local Gemma fallback is disabled.');
  return evaluateViaCheckerService(checkerUrl, docType, file, text, requirements, candidate, imagePages);
}

async function evaluateViaCheckerService(
  checkerUrl: string,
  docType: DocumentType,
  file: UploadedFile,
  text: string,
  requirements: DocumentTypeRequirement[],
  candidate?: DocumentCheckCandidate,
  imagePages: DocumentImagePage[] = [],
): Promise<DocumentRequirementCheckResult[]> {
  const checkedAt = new Date().toISOString();
  const url = `${checkerUrl.replace(/\/+$/, '')}/check`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      applicationId: candidate?.applicationId || '',
      bundleKey: candidate?.bundleKey || '',
      dossierSectionCode: candidate?.dossierSectionCode || file.dossierSectionCode || docType.docCode || '',
      documentTypeId: docType.id,
      documentTypeName: docType.name,
      applicationFieldValues: buildApplicationFieldValues(candidate?.applicationValues, requirements),
      requirements: requirements.map((requirement) => ({
        id: requirement.id,
        requirementText: requirement.requirementText,
        sourcePoint: requirement.sourcePoint,
        criticality: requirement.criticality,
        applicabilityCondition: requirement.applicabilityCondition,
        quote: requirement.quote,
        checkerMode: requirement.checkerMode,
        checkTarget: requirement.checkTarget,
        linkedApplicationFields: requirement.linkedApplicationFields,
        missingApplicationFields: requirement.missingApplicationFields,
        relatedDocumentCodes: requirement.relatedDocumentCodes,
        expectedCheckerInputs: requirement.expectedCheckerInputs,
        applicabilityGateRequired: requirement.applicabilityGateRequired,
        aggregateByDossierSectionCode: requirement.aggregateByDossierSectionCode,
        decisionLogic: requirement.decisionLogic,
      })),
      textChunks: text.trim() ? [{ id: 'chunk', text, sourceLabel: file.name }] : [],
      imagePages: imagePages.map((page) => ({
        id: page.id,
        page: page.page,
        sourceLabel: page.sourceLabel,
        imageMime: page.imageMime,
        imageBase64: page.imageBase64,
      })),
      maxRequirementsPerCall: requirements.length,
      maxTokens: 4096,
      timeoutSeconds: 240,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.detail || payload?.error || `Gemma checker service failed: ${response.status}`;
    throw new Error(String(message));
  }

  const byId = new Map((payload.results || []).map((item: any) => [String(item.requirementId || item.id || ''), item]));
  return requirements.map((requirement) => {
    const item: any = byId.get(requirement.id);
    return {
      requirementId: requirement.id,
      status: normalizeStatus(item?.status),
      requirementText: requirement.requirementText,
      evidence: item?.evidence,
      comment: item?.comment,
      confidence: normalizeConfidence(item?.confidence),
      checkedAt,
      provider: item?.provider || 'gemma-checker-service',
      sourcePoint: requirement.sourcePoint,
    };
  });
}

function buildApplicationFieldValues(values: DocumentCheckCandidate['applicationValues'] | undefined, requirements: DocumentTypeRequirement[]) {
  if (!values) return [];
  const fieldIds = Array.from(new Set(requirements.flatMap((requirement) => requirement.linkedApplicationFields || []).filter(Boolean)));
  return fieldIds.map((fieldId) => ({
    id: fieldId,
    value: values[fieldId],
    present: hasValue(values[fieldId]),
  }));
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function normalizeStatus(value: unknown): DocumentRequirementCheckStatus {
  const text = String(value || '').toLowerCase();
  if (['passed', 'pass', 'yes', 'ok', 'выполнено', 'соответствует'].includes(text)) return 'passed';
  if (['failed', 'fail', 'no', 'не выполнено', 'не соответствует'].includes(text)) return 'failed';
  if (['not_applicable', 'not applicable', 'na', 'n/a', 'не применимо'].includes(text)) return 'not_applicable';
  if (['skipped', 'skip', 'пропущено'].includes(text)) return 'skipped';
  return 'uncertain';
}

function normalizeConfidence(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  if (parsed > 1) return Math.min(1, Math.max(0, parsed / 100));
  return Math.min(1, Math.max(0, parsed));
}
