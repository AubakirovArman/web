import { chunkRequirements, evaluateBatch } from '@/lib/applications/npa-gemma-check/gemma-batch';
import type { DocumentRequirementCheckResult } from '@/lib/types';
import type { DocumentCheckCandidate, DocumentContentChunk, DocumentImagePage } from './types';

export async function evaluateCandidateChunks(
  candidate: DocumentCheckCandidate,
  chunks: DocumentContentChunk[],
  maxRequirementsPerChunk: number,
  imagePages: DocumentImagePage[] = [],
): Promise<DocumentRequirementCheckResult[]> {
  const results: DocumentRequirementCheckResult[] = [];

  for (const contentChunk of chunks) {
    console.log('[document-checker:chunk-start]', JSON.stringify({
      appId: candidate.applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      chunk: `${contentChunk.index + 1}/${contentChunk.total}`,
      chars: contentChunk.text.length,
      requirements: candidate.requirements.length,
    }));
    for (const requirementChunk of chunkRequirements(candidate.requirements, maxRequirementsPerChunk)) {
      const chunkResults = await evaluateBatch(candidate.docType, candidate.file, contentChunk.text, requirementChunk, candidate);
      results.push(...chunkResults.map((result) => annotateChunkResult(result, contentChunk)));
    }
    console.log('[document-checker:chunk-done]', JSON.stringify({
      appId: candidate.applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      chunk: `${contentChunk.index + 1}/${contentChunk.total}`,
    }));
  }

  if (imagePages.length > 0) {
    console.log('[document-checker:image-batch-start]', JSON.stringify({
      appId: candidate.applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      imagePages: imagePages.length,
      requirements: candidate.requirements.length,
    }));
    for (const requirementChunk of chunkRequirements(candidate.requirements, maxRequirementsPerChunk)) {
      const imageResults = await evaluateBatch(candidate.docType, candidate.file, '', requirementChunk, candidate, imagePages);
      results.push(...imageResults.map((result) => ({
        ...result,
        comment: result.comment ? `${result.comment} (проверено по изображениям страниц пакета)` : 'Проверено по изображениям страниц пакета.',
      })));
    }
    console.log('[document-checker:image-batch-done]', JSON.stringify({
      appId: candidate.applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      imagePages: imagePages.length,
    }));
  }

  return results;
}

function annotateChunkResult(result: DocumentRequirementCheckResult, chunk: DocumentContentChunk): DocumentRequirementCheckResult {
  return {
    ...result,
    evidence: result.evidence ? `${chunk.sourceLabel}: ${result.evidence}` : result.evidence,
    comment: result.comment ? `${result.comment} (${chunk.sourceLabel})` : `Проверено по ${chunk.sourceLabel}.`,
  };
}
