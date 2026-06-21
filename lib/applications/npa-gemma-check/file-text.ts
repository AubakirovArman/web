import { promises as fs } from 'fs';
import { extractPlainTextFromBuffer } from '@/lib/ai/extract';
import { readRuntimeUpload, readRuntimeUploadText, writeRuntimeUploadText } from '@/lib/files/runtime-upload-store';
import type { UploadedFile } from '@/lib/types';

function getEmbeddedText(file: UploadedFile): string {
  const extracted = file.extracted || {};
  return [extracted.textContent, extracted.rawText, extracted.aiRaw, extracted.tradeName, extracted.inn, extracted.dosage, extracted.dosageForm, extracted.manufacturer, extracted.storage, extracted.shelfLife].filter(Boolean).join('\n');
}

const PLACEHOLDER_RE = /подготовлена parser-service|изображени[ея][^.]{0,40}для ocr|страница-изображение|текстовый слой отсутствует/i;

/**
 * Текст непригоден для смысловой проверки (пустой, плейсхолдер «страница-картинка»
 * или мусорный OCR с низкой долей букв) — значит документ это скан и нужен vision-OCR.
 */
export function isUnusableText(text: string): boolean {
  const t = (text || '').trim();
  if (t.length < 60) return true;
  let body = t;
  if (PLACEHOLDER_RE.test(t)) {
    body = t.replace(new RegExp(PLACEHOLDER_RE, 'gi'), '').replace(/---\s*Страница\s*\d+[^\n]*---/gi, '');
  }
  const letters = (body.match(/[А-Яа-яA-Za-z]/g) || []).length;
  if (letters < 200) return true;
  if (letters / Math.max(t.length, 1) < 0.4) return true; // мусорный OCR
  return false;
}

export async function getFileText(file: UploadedFile): Promise<string> {
  const embeddedText = getEmbeddedText(file);
  if (embeddedText.trim().length >= 500 && !isUnusableText(embeddedText)) return embeddedText;

  try {
    const cached = await readRuntimeUploadText(file.id);
    // переизвлекаем (с vision-OCR), если в кэше плейсхолдер/мусор от прошлой обработки
    if (cached?.trim() && !isUnusableText(cached)) return cached;
  } catch {
    // fall through to binary extraction
  }

  const { metadata, filePath } = await readRuntimeUpload(file.id);
  const buffer = await fs.readFile(filePath);
  const text = await extractPlainTextFromBuffer(buffer, metadata.fileName, metadata.contentType);
  if (text.trim() && !isUnusableText(text)) await writeRuntimeUploadText(file.id, text);
  return [embeddedText, text].filter(Boolean).join('\n').trim();
}
