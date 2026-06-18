import type { DocumentRequirementCheckResult, DocumentTypeRequirement } from '@/lib/types';

export function reduceChunkResults(
  requirements: DocumentTypeRequirement[],
  results: DocumentRequirementCheckResult[],
): DocumentRequirementCheckResult[] {
  const byRequirement = new Map<string, DocumentRequirementCheckResult[]>();
  for (const result of results) {
    const bucket = byRequirement.get(result.requirementId) || [];
    bucket.push(result);
    byRequirement.set(result.requirementId, bucket);
  }

  return requirements.map((requirement) => {
    const requirementResults = byRequirement.get(requirement.id) || [];
    if (requirementResults.length === 0) return buildSkipped(requirement, 'Проверка не запускалась.');
    return reduceRequirement(requirement, requirementResults);
  });
}

export function buildSkippedResults(
  requirements: DocumentTypeRequirement[],
  reason: string,
): DocumentRequirementCheckResult[] {
  return requirements.map((requirement) => buildSkipped(requirement, reason));
}

function reduceRequirement(
  requirement: DocumentTypeRequirement,
  results: DocumentRequirementCheckResult[],
): DocumentRequirementCheckResult {
  const checkedAt = new Date().toISOString();
  const passed = results.filter((result) => result.status === 'passed');
  const failed = results.filter((result) => result.status === 'failed');
  const uncertain = results.filter((result) => result.status === 'uncertain');
  const notApplicable = results.filter((result) => result.status === 'not_applicable');
  const skipped = results.filter((result) => result.status === 'skipped');

  if (passed.length > 0) return buildReduced(requirement, 'passed', passed, checkedAt);
  if (notApplicable.length === results.length) return buildReduced(requirement, 'not_applicable', notApplicable, checkedAt);
  if (failed.length === results.length) return buildReduced(requirement, 'failed', failed, checkedAt);
  if (uncertain.length > 0 || failed.length > 0) return buildReduced(requirement, 'uncertain', [...uncertain, ...failed], checkedAt);
  if (skipped.length === results.length) return buildReduced(requirement, 'skipped', skipped, checkedAt);
  return buildReduced(requirement, 'uncertain', results, checkedAt);
}

function buildReduced(
  requirement: DocumentTypeRequirement,
  status: DocumentRequirementCheckResult['status'],
  sourceResults: DocumentRequirementCheckResult[],
  checkedAt: string,
): DocumentRequirementCheckResult {
  const best = pickBestEvidence(sourceResults);
  return {
    requirementId: requirement.id,
    status,
    requirementText: requirement.requirementText,
    evidence: best?.evidence,
    comment: summarizeComments(sourceResults),
    confidence: averageConfidence(sourceResults),
    checkedAt,
    provider: best?.provider,
    sourcePoint: requirement.sourcePoint,
  };
}

function buildSkipped(requirement: DocumentTypeRequirement, reason: string): DocumentRequirementCheckResult {
  return {
    requirementId: requirement.id,
    status: 'skipped',
    requirementText: requirement.requirementText,
    comment: reason,
    confidence: 0,
    checkedAt: new Date().toISOString(),
    provider: 'document-checker',
    sourcePoint: requirement.sourcePoint,
  };
}

function pickBestEvidence(results: DocumentRequirementCheckResult[]) {
  return [...results]
    .filter((result) => result.evidence || result.comment)
    .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))[0];
}

function summarizeComments(results: DocumentRequirementCheckResult[]): string {
  const comments = results.map((result) => result.comment).filter(Boolean) as string[];
  return Array.from(new Set(comments)).slice(0, 3).join('\n');
}

function averageConfidence(results: DocumentRequirementCheckResult[]): number {
  const values = results.map((result) => result.confidence).filter((value): value is number => typeof value === 'number');
  if (!values.length) return 0.5;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
