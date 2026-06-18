import type { DocumentContentChunk, ExtractedDocumentContent } from './types';

const DEFAULT_MAX_CHARS = 12000;
const OVERLAP_CHARS = 800;

export function chunkExtractedContent(content: ExtractedDocumentContent, maxChars = DEFAULT_MAX_CHARS): DocumentContentChunk[] {
  const text = content.text.trim();
  if (!text) return [];
  if (text.length <= maxChars) return [buildChunk(content, text, 0, 1)];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const hardEnd = Math.min(text.length, cursor + maxChars);
    const softEnd = findSoftBoundary(text, cursor, hardEnd);
    chunks.push(text.slice(cursor, softEnd).trim());
    if (softEnd >= text.length) break;
    cursor = Math.max(softEnd - OVERLAP_CHARS, cursor + 1);
  }

  return chunks.filter(Boolean).map((chunk, index) => buildChunk(content, chunk, index, chunks.length));
}

function buildChunk(content: ExtractedDocumentContent, text: string, index: number, total: number): DocumentContentChunk {
  return {
    id: `${content.file.id}:chunk:${index + 1}`,
    text,
    sourceLabel: `${content.file.name}, фрагмент ${index + 1}/${total}`,
    index,
    total,
  };
}

function findSoftBoundary(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length;
  const windowStart = Math.max(start + Math.floor((hardEnd - start) * 0.65), start);
  const window = text.slice(windowStart, hardEnd);
  const paragraphBreak = window.lastIndexOf('\n\n');
  if (paragraphBreak > 0) return windowStart + paragraphBreak;
  const lineBreak = window.lastIndexOf('\n');
  if (lineBreak > 0) return windowStart + lineBreak;
  const sentenceBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '));
  if (sentenceBreak > 0) return windowStart + sentenceBreak + 1;
  return hardEnd;
}
