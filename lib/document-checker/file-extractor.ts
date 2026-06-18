import { getFileText } from '@/lib/applications/npa-gemma-check/file-text';
import type { DocumentImagePage, ExtractedDocumentContent, SupportedDocumentFormat } from './types';
import type { UploadedFile } from '@/lib/types';

export async function extractDocumentContent(file: UploadedFile): Promise<ExtractedDocumentContent> {
  const format = detectDocumentFormat(file);
  const parserContent = await extractWithParserServiceIfUseful(file, format);
  const text = parserContent ? parserContent.text : await getFileText(file);
  const imagePages = parserContent?.imagePages || [];
  const trimmed = text.trim();

  return {
    file,
    format,
    text: trimmed,
    imagePages,
    quality: {
      hasText: trimmed.length > 0 || imagePages.length > 0,
      textLength: trimmed.length,
      imagePages: imagePages.length,
      extractionMethod: parserContent ? `parser-service:${format}` : extractionMethodForFormat(format),
    },
  };
}

interface ParserServicePage {
  page: number;
  text?: string;
  textLength?: number;
  imageBase64?: string;
  imageMime?: string;
}

interface ParserServiceResponse {
  textContent?: string;
  textChars?: number;
  imagePages?: number;
  pages?: ParserServicePage[];
}

async function extractWithParserServiceIfUseful(file: UploadedFile, format: SupportedDocumentFormat): Promise<{ text: string; imagePages: DocumentImagePage[] } | null> {
  const requiresParserService = ['pdf', 'jpg', 'jpeg', 'png'].includes(format);
  if (!requiresParserService) return null;
  const parserUrl = process.env.DOCUMENT_PARSER_URL || process.env.NDDA_DOCUMENT_PARSER_URL;
  if (!parserUrl) throw new Error('DOCUMENT_PARSER_URL is required for PDF/image extraction. Local fallback is disabled.');

  try {
    const { metadata, filePath } = await import('@/lib/files/runtime-upload-store').then((mod) => mod.readRuntimeUpload(file.id));
    const { promises: fs } = await import('fs');
    const buffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: metadata.contentType || file.contentType || 'application/octet-stream' }), metadata.fileName || file.name);
    form.append('min_text_chars', '80');
    form.append('zoom', '2.4');
    form.append('include_images', 'true');

    const response = await fetch(`${parserUrl.replace(/\/+$/, '')}/parse`, { method: 'POST', body: form });
    const payload = await response.json().catch(() => null) as ParserServiceResponse | null;
    if (!response.ok || !payload) throw new Error(`document parser service failed: ${response.status}`);

    const text = String(payload.textContent || buildTextFromParserPages(payload.pages || '')).trim();
    const imagePages = (payload.pages || [])
      .filter((page) => page.imageBase64)
      .map((page): DocumentImagePage => ({
        id: `${file.id}:page:${page.page}`,
        page: page.page,
        imageBase64: String(page.imageBase64),
        imageMime: page.imageMime || 'image/png',
        sourceLabel: `${file.name}, страница ${page.page}`,
      }));

    return { text, imagePages };
  } catch (error) {
    throw new Error(`[document-checker:parser-service-failed] ${file.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildTextFromParserPages(pages: ParserServicePage[] | string) {
  if (!Array.isArray(pages)) return '';
  return pages
    .map((page) => String(page.text || '').trim() ? `--- Страница ${page.page} ---\n${String(page.text || '').trim()}` : '')
    .filter(Boolean)
    .join('\n\n');
}

export function detectDocumentFormat(file: UploadedFile): SupportedDocumentFormat {
  const extension = String(file.extension || file.name.split('.').pop() || '').toLowerCase();
  if (isSupportedFormat(extension)) return extension;

  const contentType = String(file.contentType || file.mime || '').toLowerCase();
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('wordprocessingml')) return 'docx';
  if (contentType.includes('msword')) return 'doc';
  if (contentType.includes('spreadsheetml')) return 'xlsx';
  if (contentType.includes('excel')) return 'xls';
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('text')) return 'txt';
  return 'unknown';
}

function isSupportedFormat(value: string): value is SupportedDocumentFormat {
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'txt'].includes(value);
}

function extractionMethodForFormat(format: SupportedDocumentFormat): string {
  if (format === 'pdf') return 'pdf-text-or-ocr';
  if (format === 'doc' || format === 'docx') return 'word-parser';
  if (format === 'xls' || format === 'xlsx') return 'spreadsheet-parser';
  if (format === 'jpg' || format === 'png') return 'vision-ocr';
  if (format === 'txt') return 'plain-text';
  return 'generic-extraction';
}
