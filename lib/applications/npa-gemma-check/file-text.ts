import { promises as fs } from 'fs';
import { extractPlainTextFromBuffer } from '@/lib/ai/extract';
import { readRuntimeUpload, readRuntimeUploadText, writeRuntimeUploadText } from '@/lib/files/runtime-upload-store';
import type { UploadedFile } from '@/lib/types';

function getEmbeddedText(file: UploadedFile): string {
  const extracted = file.extracted || {};
  return [extracted.textContent, extracted.rawText, extracted.aiRaw, extracted.tradeName, extracted.inn, extracted.dosage, extracted.dosageForm, extracted.manufacturer, extracted.storage, extracted.shelfLife].filter(Boolean).join('\n');
}

export async function getFileText(file: UploadedFile): Promise<string> {
  const embeddedText = getEmbeddedText(file);
  if (embeddedText.trim().length >= 500) return embeddedText;

  try {
    const cached = await readRuntimeUploadText(file.id);
    if (cached?.trim()) return cached;
  } catch {
    // fall through to binary extraction
  }

  const { metadata, filePath } = await readRuntimeUpload(file.id);
  const buffer = await fs.readFile(filePath);
  const text = await extractPlainTextFromBuffer(buffer, metadata.fileName, metadata.contentType);
  if (text.trim()) await writeRuntimeUploadText(file.id, text);
  return [embeddedText, text].filter(Boolean).join('\n').trim();
}
