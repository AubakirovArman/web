import { checkDefinitions } from '@/lib/checks/registry';
import type { Application, DocumentRequirementCheckResult, DocumentType, DocumentTypeRequirement, Finding, Severity, UploadedFile } from '@/lib/types';

const nonSemanticCheckIds = new Set([
  'required_document_presence_check',
  'file_format_check',
  'ocr_quality_check',
  'npa_imported_requirement_check',
]);

function severityFromCriticality(value?: string): Severity {
  const text = String(value || '').toLowerCase();
  if (text.includes('крит') || text.includes('critical')) return 'critical';
  if (text.includes('знач') || text.includes('serious') || text.includes('significant')) return 'serious';
  if (text.includes('неяс') || text.includes('unknown')) return 'unknown';
  return 'warning';
}

function getDocumentRequirementsForSavedResults(docType: DocumentType): DocumentTypeRequirement[] {
  const importedRequirements = (docType.importedRequirements || []).filter((requirement) => requirement.requirementText?.trim());
  if (importedRequirements.length > 0) return importedRequirements;
  if (docType.direction !== 'MI') return [];

  const checkRequirements = (docType.checkIds || [])
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

  return checkRequirements;
}

function buildSavedFinding(
  file: UploadedFile,
  docType: DocumentType,
  result: DocumentRequirementCheckResult,
  requirement?: DocumentTypeRequirement
): Finding | null {
  if (result.status === 'passed' || result.status === 'not_applicable') return null;

  const isFailed = result.status === 'failed';
  const source = result.sourcePoint || requirement?.sourcePoint || requirement?.sourceDocumentName || 'НПА';
  const requirementText = result.requirementText || requirement?.requirementText || 'Требование не найдено в текущем справочнике.';
  const bundleKey = result.bundleKey || file.id;
  const fileNames = result.fileNames?.length ? result.fileNames : [file.name];

  return {
    id: `npa-gemma-saved-${bundleKey}-${result.requirementId}`,
    severity: isFailed ? severityFromCriticality(requirement?.criticality) : 'unknown',
    category: isFailed ? 'НПА / несоответствие' : 'НПА / требуется уточнение',
    title: isFailed
      ? `Требование НПА не подтверждено: ${docType.name}`
      : `Автоматическая проверка не смогла однозначно проверить требование НПА: ${docType.name}`,
    description: [
      result.comment || (isFailed ? 'В тексте документа не найдено подтверждение выполнения требования.' : 'Недостаточно текста или контекста для уверенной оценки.'),
      `Требование: ${requirementText}`,
      result.evidence ? `Фрагмент/основание: ${result.evidence}` : '',
    ].filter(Boolean).join('\n'),
    documents: [docType.name, ...fileNames],
    recommendation: isFailed
      ? 'Проверьте документ вручную, запросите корректировку или дополнительное обоснование у заявителя.'
      : 'Откройте документ и проверьте требование вручную; при необходимости улучшите OCR/текстовый слой.',
    npaReference: source,
    checkerId: 'npa_imported_requirement_check',
    confidence: result.confidence,
    status: 'open',
    quotes: [
      {
        source,
        text: result.evidence || requirement?.quote || requirementText,
      },
    ],
    evidence: [
      {
        source,
        text: result.evidence || requirementText,
        field: `${bundleKey}:${result.requirementId}`,
        documentTypeId: docType.id,
      },
    ],
  };
}

export function buildNpaGemmaFindingsFromSavedResults(app: Application, documentTypes: DocumentType[]): Finding[] {
  const docTypesById = new Map(documentTypes.map((item) => [item.id, item]));
  const findings: Finding[] = [];
  const seenResults = new Set<string>();

  for (const file of app.files) {
    const results = file.npaRequirementResults || [];
    if (results.length === 0) continue;
    const docType = docTypesById.get(file.documentTypeId);
    if (!docType) continue;

    const requirements = getDocumentRequirementsForSavedResults(docType);
    const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    for (const result of results) {
      const dedupeKey = `${result.bundleKey || file.id}:${result.requirementId}`;
      if (seenResults.has(dedupeKey)) continue;
      seenResults.add(dedupeKey);
      const finding = buildSavedFinding(file, docType, result, requirementsById.get(result.requirementId));
      if (finding) findings.push(finding);
    }
  }

  return findings;
}
