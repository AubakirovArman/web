import { writeSectionCheckArtifact } from '@/lib/applications/processing-artifacts';
import { chunkExtractedContent } from './chunker';
import { evaluateCandidateChunks } from './gemma-evaluator';
import { extractDocumentContent } from './file-extractor';
import { buildSkippedResults, reduceChunkResults } from './result-reducer';
import type { DocumentCheckCandidate, DocumentCheckPipelineOptions, DocumentCheckPipelineResult, ExtractedDocumentContent } from './types';

export async function runDocumentCheckCandidate(
  candidate: DocumentCheckCandidate,
  options: DocumentCheckPipelineOptions,
): Promise<DocumentCheckPipelineResult> {
  console.log('[document-checker:bundle-start]', JSON.stringify({
    appId: candidate.applicationId,
    bundleKey: candidate.bundleKey,
    dossierSectionCode: candidate.dossierSectionCode,
    files: (candidate.files?.length ? candidate.files : [candidate.file]).map((file) => ({ id: file.id, name: file.name, code: file.dossierSectionCode })),
    requirements: candidate.requirements.length,
  }));
  const extraction = await extractCandidateContent(candidate);
  const chunks = chunkExtractedContent(extraction, options.maxTextCharsPerChunk);
  console.log('[document-checker:bundle-extracted]', JSON.stringify({
    appId: candidate.applicationId,
    bundleKey: candidate.bundleKey,
    dossierSectionCode: candidate.dossierSectionCode,
    textLength: extraction.quality.textLength,
    hasText: extraction.quality.hasText,
    imagePages: extraction.quality.imagePages || 0,
    extractionMethod: extraction.quality.extractionMethod,
    chunks: chunks.length,
  }));

  if (!extraction.quality.hasText || (chunks.length === 0 && !(extraction.imagePages || []).length)) {
    const pipelineResult = {
      file: candidate.file,
      docType: candidate.docType,
      requirements: candidate.requirements,
      extraction,
      chunks,
      results: buildSkippedResults(candidate.requirements, 'Не удалось получить текст/OCR для смысловой проверки.'),
    };
    await writePipelineArtifact(candidate, pipelineResult);
    return pipelineResult;
  }

  const chunkResults = await evaluateCandidateChunks(candidate, chunks, options.maxRequirementsPerChunk, extraction.imagePages || []);
  const pipelineResult = {
    file: candidate.file,
    docType: candidate.docType,
    requirements: candidate.requirements,
    extraction,
    chunks,
    results: reduceChunkResults(candidate.requirements, chunkResults),
  };
  await writePipelineArtifact(candidate, pipelineResult);
  console.log('[document-checker:bundle-done]', JSON.stringify({
    appId: candidate.applicationId,
    bundleKey: candidate.bundleKey,
    dossierSectionCode: candidate.dossierSectionCode,
    results: pipelineResult.results.reduce<Record<string, number>>((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {}),
  }));
  return pipelineResult;
}

async function writePipelineArtifact(candidate: DocumentCheckCandidate, result: DocumentCheckPipelineResult) {
  if (!candidate.applicationId) return;
  try {
    await writeSectionCheckArtifact({
      appId: candidate.applicationId,
      bundleKey: candidate.bundleKey,
      dossierSectionCode: candidate.dossierSectionCode,
      files: candidate.files?.length ? candidate.files : [candidate.file],
      extraction: result.extraction,
      chunks: result.chunks,
      requirements: result.requirements,
      results: result.results,
    });
  } catch (error) {
    console.warn('[document-checker:artifact-failed]', error instanceof Error ? error.message : error);
  }
}

async function extractCandidateContent(candidate: DocumentCheckCandidate): Promise<ExtractedDocumentContent> {
  const files = candidate.files?.length ? candidate.files : [candidate.file];
  if (files.length === 1) return extractDocumentContent(files[0]);

  const extracted = await Promise.all(files.map((file) => extractDocumentContent(file)));
  const text = extracted
    .map((item, index) => [
      `Файл ${index + 1}/${extracted.length}: ${item.file.name}`,
      `Код раздела: ${item.file.dossierSectionCode || 'не указан'}`,
      item.text,
    ].filter(Boolean).join('\n'))
    .join('\n\n--- КОНЕЦ ФАЙЛА ---\n\n')
    .trim();
  const imagePages = extracted.flatMap((item, fileIndex) => (item.imagePages || []).map((page) => ({
    ...page,
    sourceLabel: `Файл ${fileIndex + 1}/${extracted.length}: ${page.sourceLabel}`,
  })));

  return {
    file: candidate.file,
    format: 'txt',
    text,
    imagePages,
    quality: {
      hasText: extracted.some((item) => item.quality.hasText) || imagePages.length > 0,
      textLength: text.length,
      imagePages: imagePages.length,
      extractionMethod: `bundle:${Array.from(new Set(extracted.map((item) => item.quality.extractionMethod))).join(',')}`,
    },
  };
}
