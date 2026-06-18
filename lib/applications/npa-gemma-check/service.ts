import { readAdminRuntimeConfig } from '@/lib/admin/server-store';
import { readApplications, upsertApplication } from '@/lib/applications/server-store';
import { loadDocumentTypesForApplication, runDocumentCheckCandidate } from '@/lib/document-checker';
import { buildCandidates, normalizeLimit, shouldKeepExistingNpaFinding } from './utils';
import type { Application, DocumentRequirementCheckResult, DocumentType, DocumentTypeRequirement, Finding, Severity, UploadedFile } from '@/lib/types';

export async function runNpaGemmaCheck(applicationId: string, body: any, userId: string) {
  const dryRun = body?.dryRun === true;
  const skipCompleted = body?.skipCompleted === true;
  const maxFiles = normalizeLimit(body?.maxFiles, 200, 1, 500);
  const maxRequirementsPerFile = normalizeLimit(body?.maxRequirementsPerFile, 12, 1, 40);
  const maxTotalRequirements = normalizeLimit(body?.maxTotalRequirements, 5000, 1, 10000);
  const maxTextCharsPerChunk = normalizeLimit(body?.maxTextCharsPerChunk, 45000, 4000, 60000);

  const applications = await readApplications();
  const app = applications.find((item) => item.id === applicationId);
  if (!app) return { status: 404 as const, payload: { error: 'Application not found' } };

  const adminConfig = await readAdminRuntimeConfig();
  const documentTypesLoad = await loadDocumentTypesForApplication({ app, adminDocumentTypes: adminConfig.documentTypes });
  const documentTypes = documentTypesLoad.documentTypes;
  const candidates = buildCandidates(app, documentTypes, maxFiles, maxTotalRequirements, skipCompleted);
  const totalRequirements = candidates.reduce((sum, candidate) => sum + candidate.requirements.length, 0);

  if (dryRun) {
    return { status: 200 as const, payload: { dryRun: true, skipCompleted, candidates: candidates.length, totalRequirements, files: candidates.map((candidate) => ({ bundleKey: candidate.bundleKey, fileIds: (candidate.files || [candidate.file]).map((file) => file.id), fileNames: (candidate.files || [candidate.file]).map((file) => file.name), documentTypeId: candidate.docType.id, documentTypeName: candidate.docType.name, requirements: candidate.requirements.length })) } };
  }

  const stats = { files: candidates.length, requirements: totalRequirements, passed: 0, failed: 0, uncertain: 0, notApplicable: 0, skipped: 0 };
  const findings: Finding[] = [];
  const resultsByFileId = new Map<string, DocumentRequirementCheckResult[]>();
  const clearAllNpaResultsForFileIds = new Set<string>();
  const processedRequirementIds = new Set<string>();
  const processedEvidenceFields = new Set<string>();
  let workingApp: Application = { ...app, status: 'checking' };

  for (const candidate of candidates) {
    console.log('[npa-gemma:candidate-start]', JSON.stringify({
      applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      documentTypeId: candidate.docType.id,
      files: (candidate.files || [candidate.file]).map((file) => file.name),
      requirements: candidate.requirements.length,
    }));
    const pipelineResult = await runDocumentCheckCandidate(candidate, {
      maxRequirementsPerChunk: maxRequirementsPerFile,
      maxTextCharsPerChunk,
    });
    const targetFiles = candidate.files?.length ? candidate.files : [candidate.file];
    const evidenceFieldPrefix = candidate.bundleKey;
    const fileResults = pipelineResult.results.map((result) => decorateBundleResult(result, candidate.docType, candidate.bundleKey, candidate.dossierSectionCode, targetFiles));

    for (const result of fileResults) {
      processedRequirementIds.add(result.requirementId);
      processedEvidenceFields.add(`${evidenceFieldPrefix}:${result.requirementId}`);
      if (result.status === 'passed') stats.passed += 1;
      else if (result.status === 'failed') stats.failed += 1;
      else if (result.status === 'not_applicable') stats.notApplicable += 1;
      else if (result.status === 'skipped') stats.skipped += 1;
      else stats.uncertain += 1;

      const requirement = candidate.requirements.find((item) => item.id === result.requirementId);
      if (!requirement) continue;
      const finding = buildFinding(candidate.docType, requirement, result, targetFiles, evidenceFieldPrefix);
      if (finding) findings.push(finding);
    }
    for (const targetFile of targetFiles) {
      clearAllNpaResultsForFileIds.add(targetFile.id);
    }
    if (targetFiles[0]) resultsByFileId.set(targetFiles[0].id, fileResults);

    workingApp = applyNpaProgress(workingApp, app.findings || [], resultsByFileId, clearAllNpaResultsForFileIds, findings, processedRequirementIds, processedEvidenceFields);
    await upsertApplication(workingApp, userId);
    console.log('[npa-gemma:candidate-done]', JSON.stringify({
      applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      results: fileResults.length,
      passed: fileResults.filter((result) => result.status === 'passed').length,
      failed: fileResults.filter((result) => result.status === 'failed').length,
      uncertain: fileResults.filter((result) => result.status === 'uncertain').length,
      notApplicable: fileResults.filter((result) => result.status === 'not_applicable').length,
    }));
  }

  workingApp = {
    ...applyNpaProgress(workingApp, app.findings || [], resultsByFileId, clearAllNpaResultsForFileIds, findings, processedRequirementIds, processedEvidenceFields),
    status: finalNpaCheckStatus(app.status),
  };
  const nextApplications = await upsertApplication(workingApp, userId);
  return { status: 200 as const, payload: { application: nextApplications.find((item) => item.id === applicationId) || workingApp, stats, findings, documentTypesSource: documentTypesLoad.source, adminConfigUpdatedAt: adminConfig.updatedAt } };
}

function finalNpaCheckStatus(status: Application['status']): Application['status'] {
  if (status === 'submitted' || status === 'expert-review') return status;
  return 'checked';
}

function applyNpaProgress(
  app: Application,
  originalFindings: Finding[],
  resultsByFileId: Map<string, DocumentRequirementCheckResult[]>,
  clearAllNpaResultsForFileIds: Set<string>,
  findings: Finding[],
  processedRequirementIds: Set<string>,
  processedEvidenceFields: Set<string>,
): Application {
  const nextFiles = app.files.map((file) => {
    const nextResults = resultsByFileId.get(file.id);
    const shouldClearNpaResults = clearAllNpaResultsForFileIds.has(file.id);
    if (!nextResults && !shouldClearNpaResults) return file;
    const previousResults = shouldClearNpaResults
      ? []
      : (file.npaRequirementResults || []).filter((result) => !nextResults?.some((nextResult) => nextResult.requirementId === result.requirementId));
    return { ...file, npaRequirementResults: [...previousResults, ...(nextResults || [])] };
  });

  return {
    ...app,
    files: nextFiles,
    findings: [...originalFindings.filter((finding) => shouldKeepExistingNpaFinding(finding, processedRequirementIds, processedEvidenceFields)), ...findings],
  };
}

function decorateBundleResult(
  result: DocumentRequirementCheckResult,
  docType: DocumentType,
  bundleKey: string,
  dossierSectionCode: string | undefined,
  files: UploadedFile[],
): DocumentRequirementCheckResult {
  return {
    ...result,
    bundleKey,
    dossierSectionCode,
    documentTypeId: docType.id,
    fileIds: files.map((file) => file.id),
    fileNames: files.map((file) => file.name),
    coverage: files.length > 1 ? 'multi_file' : files.length === 1 ? 'single_file' : 'none',
  };
}

function severityFromCriticality(value?: string): Severity {
  const text = String(value || '').toLowerCase();
  if (text.includes('крит') || text.includes('critical')) return 'critical';
  if (text.includes('знач') || text.includes('serious') || text.includes('significant')) return 'serious';
  if (text.includes('неяс') || text.includes('unknown')) return 'unknown';
  return 'warning';
}

function buildFinding(docType: DocumentType, requirement: DocumentTypeRequirement, result: DocumentRequirementCheckResult, files: UploadedFile[], evidenceFieldPrefix: string): Finding | null {
  if (result.status === 'passed' || result.status === 'not_applicable') return null;
  const isFailed = result.status === 'failed';
  const source = requirement.sourcePoint || requirement.sourceDocumentName || 'НПА';
  const fileNames = files.map((file) => file.name);
  return {
    id: `npa-gemma-${evidenceFieldPrefix}-${requirement.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    severity: isFailed ? severityFromCriticality(requirement.criticality) : 'unknown',
    category: isFailed ? 'НПА / несоответствие' : 'НПА / требуется уточнение',
    title: isFailed ? `Требование НПА не подтверждено: ${docType.name}` : `Gemma не смогла однозначно проверить требование НПА: ${docType.name}`,
    description: [result.comment || (isFailed ? 'В тексте документа не найдено подтверждение выполнения требования.' : 'Недостаточно текста или контекста для уверенной оценки.'), `Требование: ${requirement.requirementText}`, result.evidence ? `Фрагмент/основание: ${result.evidence}` : ''].filter(Boolean).join('\n'),
    documents: [docType.name, ...fileNames],
    recommendation: isFailed ? 'Проверьте документ вручную, запросите корректировку или дополнительное обоснование у заявителя.' : 'Откройте документ и проверьте требование вручную; при необходимости улучшите OCR/текстовый слой.',
    npaReference: source,
    checkerId: 'npa_imported_requirement_check',
    confidence: result.confidence,
    status: 'open',
    quotes: [{ source, text: result.evidence || requirement.quote || requirement.requirementText }],
    evidence: [{ source, text: result.evidence || requirement.requirementText, field: `${evidenceFieldPrefix}:${requirement.id}`, documentTypeId: docType.id }],
  };
}
