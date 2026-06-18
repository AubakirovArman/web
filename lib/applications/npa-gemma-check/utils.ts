import { checkDefinitions } from '@/lib/checks/registry';
import type { Application, DocumentType, DocumentTypeRequirement, Finding } from '@/lib/types';

export interface Candidate {
  applicationId?: string;
  applicationValues?: Application['values'];
  file: Application['files'][number];
  files?: Application['files'];
  bundleKey: string;
  dossierSectionCode?: string;
  docType: DocumentType;
  requirements: DocumentTypeRequirement[];
}

export function normalizeLimit(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function buildCandidates(app: Application, documentTypes: DocumentType[], maxFiles: number, maxTotalRequirements: number, skipCompleted: boolean): Candidate[] {
  const docTypesById = new Map(documentTypes.map((item) => [item.id, item]));
  const filesByBundleKey = new Map<string, Application['files']>();
  const filesByRelatedSectionKey = new Map<string, Application['files']>();
  for (const file of app.files) {
    const docType = docTypesById.get(file.documentTypeId);
    const key = bundleKeyForFile(file, docType);
    const bucket = filesByBundleKey.get(key) || [];
    bucket.push(file);
    filesByBundleKey.set(key, bucket);

    for (const sectionCode of sectionCodesForFile(file, docType)) {
      const relatedKey = `section:${sectionCode}`;
      const relatedBucket = filesByRelatedSectionKey.get(relatedKey) || [];
      relatedBucket.push(file);
      filesByRelatedSectionKey.set(relatedKey, relatedBucket);
    }
  }

  const candidates: Candidate[] = [];
  let requirementCount = 0;

  for (const [bundleKey, files] of filesByBundleKey.entries()) {
    if (candidates.length >= maxFiles || requirementCount >= maxTotalRequirements) break;
    const representativeFile = files[0];
    const docType = docTypesById.get(representativeFile.documentTypeId);
    const completedRequirementIds = new Set(files.flatMap((file) => file.npaRequirementResults || [])
      .filter((result) => result.status !== 'skipped')
      .map((result) => result.requirementId));
    const requirements = docType ? getDocumentRequirementsForGemma(docType).filter((requirement) => !skipCompleted || !completedRequirementIds.has(requirement.id)) : [];
    if (!docType || requirements.length === 0) continue;
    const selectedRequirements = requirements.slice(0, maxTotalRequirements - requirementCount);
    const relatedFiles = findRelatedFilesForRequirements(selectedRequirements, filesByRelatedSectionKey);
    const candidateFiles = uniqueFiles([...files, ...relatedFiles]);
    candidates.push({
      applicationId: app.id,
      applicationValues: app.values,
      file: representativeFile,
      files: candidateFiles,
      bundleKey,
      dossierSectionCode: normalizeDocumentCode(representativeFile.dossierSectionCode || docType.docCode || docType.importedRequirements?.[0]?.sourceDocumentCode),
      docType,
      requirements: selectedRequirements,
    });
    requirementCount += selectedRequirements.length;
  }
  return candidates;
}

function findRelatedFilesForRequirements(requirements: DocumentTypeRequirement[], filesByBundleKey: Map<string, Application['files']>): Application['files'] {
  const codes = new Set(requirements.flatMap((requirement) => requirement.relatedDocumentCodes || []).map(normalizeDocumentCode).filter(Boolean));
  const files: Application['files'] = [];
  for (const code of codes) {
    files.push(...(filesByBundleKey.get(`section:${code}`) || []));
  }
  return files;
}

function uniqueFiles(files: Application['files']): Application['files'] {
  return Array.from(new Map(files.map((file) => [file.id, file])).values());
}

function bundleKeyForFile(file: Application['files'][number], docType?: DocumentType): string {
  const code = normalizeDocumentCode(file.dossierSectionCode || docType?.docCode || docType?.importedRequirements?.[0]?.sourceDocumentCode);
  return code ? `section:${code}` : `document-type:${file.documentTypeId}`;
}

function sectionCodesForFile(file: Application['files'][number], docType?: DocumentType): string[] {
  return Array.from(new Set([
    normalizeDocumentCode(file.dossierSectionCode || docType?.docCode || docType?.importedRequirements?.[0]?.sourceDocumentCode),
    ...(file.dossierSectionCodeAliases || []).map(normalizeDocumentCode),
    ...extractDocumentCodes([
      file.name,
      file.originalName,
      file.relativePath,
      file.dossierFolderName,
      file.dossierSectionName,
    ].filter(Boolean).join(' ')),
  ].filter(Boolean)));
}

function extractDocumentCodes(value: string): string[] {
  const matches = value.match(/(^|[^A-ZА-Я0-9])([1-5](?:[.\s_-]+\d+)+(?:[.\s_-]+[SPР])?(?:[.\s_-]+\d+)*)(?=[^A-ZА-Я0-9]|$)/gi) || [];
  return Array.from(new Set(matches.map((match) => normalizeDocumentCode(match.replace(/^[^A-ZА-Я0-9]+/i, ''))).filter(Boolean)));
}

function normalizeDocumentCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

const nonSemanticCheckIds = new Set(['required_document_presence_check', 'file_format_check', 'ocr_quality_check', 'npa_imported_requirement_check']);

function getDocumentRequirementsForGemma(docType: DocumentType): DocumentTypeRequirement[] {
  const importedRequirements = (docType.importedRequirements || []).filter((requirement) => requirement.requirementText?.trim());
  if (importedRequirements.length > 0) return importedRequirements;
  if (docType.direction !== 'MI') return [];

  return (docType.checkIds || [])
    .filter((checkId) => !nonSemanticCheckIds.has(checkId))
    .map((checkId): DocumentTypeRequirement | null => {
      const definition = checkDefinitions.find((item) => item.id === checkId);
      if (!definition) return null;
      return {
        id: `fallback-${docType.id}-${checkId}`,
        source: 'manual',
        sourceDocumentName: 'Внутренняя матрица проверок МИ',
        checkSubject: docType.name,
        checkType: definition.method,
        requirementText: `${definition.name}: ${definition.description}`,
        criticality: definition.defaultSeverity,
        applicabilityCondition: 'Применяется, если данный тип документа загружен в заявке МИ.',
        sourcePoint: 'Матрица проверок МИ',
        quote: definition.description,
      };
    })
    .filter((item): item is DocumentTypeRequirement => Boolean(item));
}

export function shouldKeepExistingNpaFinding(finding: Finding, processedRequirementIds: Set<string>, processedEvidenceFields: Set<string>): boolean {
  if (finding.checkerId !== 'npa_imported_requirement_check') return true;
  const evidenceFields = (finding.evidence || []).map((evidence) => evidence.field).filter((field): field is string => Boolean(field));
  if (finding.id.startsWith('npa-gemma-')) return !evidenceFields.some((field) => processedEvidenceFields.has(field) || processedRequirementIds.has(field));
  if (evidenceFields.length === 0) return true;
  return !evidenceFields.every((field) => processedEvidenceFields.has(field) || processedRequirementIds.has(field));
}
