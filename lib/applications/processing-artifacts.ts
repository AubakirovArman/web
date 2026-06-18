import { promises as fs } from 'fs';
import path from 'path';
import type { DocumentRequirementCheckResult, DocumentTypeRequirement, UploadedFile } from '@/lib/types';
import type { DocumentContentChunk, ExtractedDocumentContent } from '@/lib/document-checker/types';

const ROOT_DIR = path.join(process.cwd(), '.runtime', 'application-processing');

function safePathSegment(value: unknown): string {
  return String(value || 'unknown')
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'unknown';
}

export function normalizeDossierCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function sectionCodeForFile(file: UploadedFile): string {
  return normalizeDossierCode(file.dossierSectionCode || file.documentTypeId || file.id) || 'unknown-section';
}

function sectionDir(appId: string, code: string): string {
  return path.join(ROOT_DIR, safePathSegment(appId), 'sections', safePathSegment(code));
}

export async function writeApplicationManifest(appId: string, files: UploadedFile[]) {
  const root = path.join(ROOT_DIR, safePathSegment(appId));
  await fs.mkdir(root, { recursive: true });
  const sections = new Map<string, UploadedFile[]>();
  for (const file of files) {
    const code = sectionCodeForFile(file);
    const bucket = sections.get(code) || [];
    bucket.push(file);
    sections.set(code, bucket);
  }
  await fs.writeFile(
    path.join(root, 'manifest.json'),
    JSON.stringify({
      appId,
      files: files.length,
      sections: Array.from(sections.entries()).map(([code, sectionFiles]) => ({
        code,
        files: sectionFiles.map((file) => ({
          id: file.id,
          name: file.name,
          documentTypeId: file.documentTypeId,
          dossierSectionCode: file.dossierSectionCode,
          contentType: file.contentType,
          size: file.size,
        })),
      })),
      updatedAt: new Date().toISOString(),
    }, null, 2),
    'utf8',
  );
}

export async function writeExtractedFileArtifact(appId: string, file: UploadedFile) {
  const code = sectionCodeForFile(file);
  const dir = sectionDir(appId, code);
  await fs.mkdir(path.join(dir, 'extracted'), { recursive: true });
  await fs.mkdir(path.join(dir, 'files'), { recursive: true });

  await fs.writeFile(
    path.join(dir, 'files', `${safePathSegment(file.id)}.json`),
    JSON.stringify({
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      documentTypeId: file.documentTypeId,
      dossierSectionCode: file.dossierSectionCode,
      dossierSectionName: file.dossierSectionName,
      contentType: file.contentType,
      size: file.size,
      processing: file.processing,
      extractedKeys: Object.keys(file.extracted || {}),
      updatedAt: new Date().toISOString(),
    }, null, 2),
    'utf8',
  );

  const extracted = file.extracted || {};
  const text = String(extracted.textContent || extracted.rawText || extracted.aiRaw || '').trim();
  const md = [
    `# ${file.name}`,
    '',
    `- Код раздела: ${file.dossierSectionCode || 'не указан'}`,
    `- Тип документа: ${file.documentTypeId}`,
    `- MIME: ${file.contentType || file.mime || 'не указан'}`,
    `- Размер: ${file.size || 0}`,
    `- Статус извлечения: ${file.processing?.extractionStatus || 'unknown'}`,
    `- Provider: ${file.processing?.provider || extracted.extractionProvider || 'unknown'}`,
    `- Text layer: ${file.processing?.textLayer == null ? 'unknown' : file.processing.textLayer ? 'yes' : 'no'}`,
    '',
    '## Извлеченный текст',
    '',
    text || '_Текст не извлечен._',
  ].join('\n');
  await fs.writeFile(path.join(dir, 'extracted', `${safePathSegment(file.id)}.md`), md, 'utf8');
}

export async function writeSectionCheckArtifact(input: {
  appId: string;
  bundleKey?: string;
  dossierSectionCode?: string;
  files: UploadedFile[];
  extraction: ExtractedDocumentContent;
  chunks: DocumentContentChunk[];
  requirements: DocumentTypeRequirement[];
  results: DocumentRequirementCheckResult[];
}) {
  const code = normalizeDossierCode(input.dossierSectionCode || input.files[0]?.dossierSectionCode || input.bundleKey) || 'unknown-section';
  const dir = sectionDir(input.appId, code);
  await fs.mkdir(path.join(dir, 'checks'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'checks', 'result.json'),
    JSON.stringify({
      appId: input.appId,
      bundleKey: input.bundleKey,
      dossierSectionCode: code,
      files: input.files.map((file) => ({ id: file.id, name: file.name, documentTypeId: file.documentTypeId })),
      extraction: input.extraction.quality,
      chunks: input.chunks.map((chunk) => ({ id: chunk.id, index: chunk.index + 1, total: chunk.total, chars: chunk.text.length, sourceLabel: chunk.sourceLabel })),
      requirements: input.requirements.map((requirement) => ({ id: requirement.id, text: requirement.requirementText, sourcePoint: requirement.sourcePoint })),
      results: input.results,
      updatedAt: new Date().toISOString(),
    }, null, 2),
    'utf8',
  );

  const md = [
    `# Проверка раздела ${code}`,
    '',
    '## Файлы',
    ...input.files.map((file) => `- ${file.name} (${file.documentTypeId})`),
    '',
    '## Итоги по требованиям',
    ...input.results.map((result) => [
      `### ${result.status}: ${result.requirementText}`,
      result.evidence ? `Evidence: ${result.evidence}` : '',
      result.comment ? `Comment: ${result.comment}` : '',
    ].filter(Boolean).join('\n')),
  ].join('\n');
  await fs.writeFile(path.join(dir, 'checks', 'evidence.md'), md, 'utf8');
}
