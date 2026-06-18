import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import type { StructuredNpaDocument, StructuredNpaSection, UploadedNpaMetadata } from './types';

export function stringFormValue(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function parseUploadedNpaFile(buffer: Buffer, fileName: string, metadata: UploadedNpaMetadata = {}): Promise<StructuredNpaDocument> {
  const safeName = path.basename(fileName || 'uploaded-npa.docx');
  const ext = path.extname(safeName).toLowerCase();
  if (!['.doc', '.docx', '.pdf'].includes(ext)) throw new Error('Поддерживаются только файлы .doc, .docx и .pdf');

  let text = '';
  if (ext === '.pdf') {
    const raw = await pdfParse(buffer);
    text = normalizeExtractedText(raw.text || '');
  } else {
    const docxBuffer = ext === '.doc' ? convertDocToDocx(buffer, safeName) : buffer;
    const raw = await mammoth.extractRawText({ buffer: docxBuffer });
    text = normalizeExtractedText(raw.value || '');
  }

  if (text.length < 100) throw new Error('Не удалось извлечь достаточно текста из документа');
  return {
    id: `upload-${Date.now()}`,
    title: metadata.name || inferUploadedTitle(text, safeName),
    domain: inferDomain(text),
    kind: metadata.actType || 'uploaded_npa',
    number: metadata.number || inferActNumber(text),
    date: metadata.date || inferActDate(text),
    fileName: safeName,
    sections: splitUploadedTextIntoSections(text),
  };
}

function convertDocToDocx(buffer: Buffer, fileName: string): Buffer {
  const dir = mkdtempSync(path.join(tmpdir(), 'ndda-npa-upload-'));
  try {
    const inputPath = path.join(dir, path.basename(fileName));
    writeFileSync(inputPath, buffer);
    execFileSync('soffice', ['--headless', '--convert-to', 'docx', '--outdir', dir, inputPath], { stdio: 'pipe', timeout: 120000 });
    const outputPath = path.join(dir, `${path.basename(fileName, path.extname(fileName))}.docx`);
    if (!existsSync(outputPath)) throw new Error('LibreOffice не смог конвертировать .doc в .docx');
    return readFileSync(outputPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+$/gm, '').replace(/\n{4,}/g, '\n\n\n').trim();
}

function splitUploadedTextIntoSections(text: string): StructuredNpaSection[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const sections: StructuredNpaSection[] = [];
  let current: StructuredNpaSection | null = null;
  const flush = () => {
    if (!current) return;
    current.text = current.text.trim();
    if (current.text) sections.push(current);
  };

  for (const line of lines) {
    const heading = classifyUploadedHeading(line);
    if (heading) {
      flush();
      current = { id: `upload-section-${sections.length + 1}`, sectionType: heading.type, headingNumber: heading.number, title: heading.title, text: line };
      continue;
    }
    if (!current) current = { id: `upload-section-${sections.length + 1}`, sectionType: 'preamble', headingNumber: null, title: 'Вводная часть', text: '' };
    current.text += `${current.text ? '\n' : ''}${line}`;
  }
  flush();

  if (sections.length <= 1) {
    return text.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean).map((chunk, index) => ({
      id: `upload-section-${index + 1}`,
      sectionType: index === 0 ? 'preamble' : 'fragment',
      headingNumber: null,
      title: index === 0 ? inferUploadedTitle(text, 'uploaded') : `Фрагмент ${index}`,
      text: chunk,
    }));
  }
  return sections;
}

function classifyUploadedHeading(line: string): { type: string; number: string | null; title: string } | null {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (/^(раздел|глава|параграф)\s+[IVXLCDM\d]+/i.test(normalized)) {
    const [, type, number = ''] = normalized.match(/^(раздел|глава|параграф)\s+([IVXLCDM\d]+)/i) || [];
    return { type: type?.toLowerCase() || 'heading', number, title: normalized };
  }
  const point = normalized.match(/^(\d+(?:-\d+)?(?:\.\d+)*)[.)]?\s+(.{8,})$/);
  if (point && normalized.length < 500) return { type: point[1].includes('.') ? 'subpoint' : 'point', number: point[1], title: point[2] };
  const appendix = normalized.match(/^приложение\s+([№N]?\s*\d+)?/i);
  if (appendix) return { type: 'appendix', number: appendix[1] || null, title: normalized };
  return null;
}

function inferUploadedTitle(text: string, fallback: string) {
  return text.split('\n').map((line) => line.trim()).find((line) => line.length > 12 && line.length < 260) || fallback;
}

function inferDomain(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('медицинск') && lower.includes('издел')) return 'МИ';
  if (lower.includes('лекарствен') || lower.includes('лекарств') || lower.includes('препарат')) return 'ЛС';
  return 'неясно';
}

function inferActNumber(text: string) {
  return text.match(/(?:№|N)\s*([A-Za-zА-Яа-я0-9\-\/]+)/)?.[1] || null;
}

function inferActDate(text: string) {
  return text.match(/от\s+(\d{1,2}\s+[а-яА-Я]+\s+\d{4}\s+года|\d{1,2}[./-]\d{1,2}[./-]\d{4})/)?.[1] || null;
}
