import fs from 'fs/promises';
import os from 'os';
import { execFile } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { callGemmaJson, GemmaVisionTextResult } from '@/lib/llm/gemma';

const execFileAsync = promisify(execFile);

function logExtractor(event: string, payload: Record<string, unknown>) {
  console.log(`[extractor:${event}] ${JSON.stringify(payload)}`);
}

const EXTRACTION_PROMPTS: Record<string, string> = {
  'doc-application': `Извлеки из текста заявления на экспертизу следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), manufacturer (производитель), manufacturerAddress (адрес производства), applicant (заявитель), holder (держатель РУ). Если поля нет, используй пустую строку.`,
  'doc-gmp': `Извлеки из текста GMP-сертификата следующие поля и верни строго JSON без пояснений: manufacturer (производитель), address (адрес площадки), validUntil (срок действия), scope (область действия / покрываемые лекарственные формы). Если поля нет, используй пустую строку.`,
  'doc-spc-ru': `Извлеки из текста ОХЛП (русский) следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), shelfLife (срок годности), storage (условия хранения), manufacturer (производитель), address (адрес), textContent (первые 3000 символов текста). Если поля нет, используй пустую строку.`,
  'doc-instruction-ru': `Извлеки из текста инструкции (русский) следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), shelfLife (срок годности), storage (условия хранения), hasBlackTriangle (есть ли черный перевернутый треугольник или отметка о дополнительном мониторинге: да/нет), textContent (первые 3000 символов текста). Если поля нет, используй пустую строку.`,
  'doc-mockup': `Извлеки из текста макета упаковки следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), dosage (дозировка), shelfLife (срок годности), storage (условия хранения). Если поля нет, используй пустую строку.`,
  'doc-bioequivalence-report': `Извлеки из текста отчёта биоэквивалентности следующие поля и верни строго JSON без пояснений: referenceProduct (референтный препарат), dosage (дозировка), dosageForm (лекарственная форма), manufacturer (производитель), conclusion (вывод). Если поля нет, используй пустую строку.`,
  'doc-bioequivalence-waiver': `Извлеки из текста обоснования отсутствия биоэквивалентности следующие поля и верни строго JSON без пояснений: waiverReason (причина биовейвера), justified (обосновано ли: да/нет), referenceProduct (референтный препарат), dosageForm (лекарственная форма). Если поля нет, используй пустую строку.`,
  'doc-quality-nd': `Извлеки из текста нормативного документа по качеству следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), dosage (дозировка), shelfLife (срок годности), storage (условия хранения). Если поля нет, используй пустую строку.`,
  'doc-cpp': `Извлеки из текста сертификата фармацевтического продукта следующие поля и верни строго JSON без пояснений: country (страна выдачи), issueDate (дата выдачи), validUntil (срок действия). Если поля нет, используй пустую строку.`,
  'doc-registration-certificate': `Извлеки из текста регистрационного удостоверения следующие поля и верни строго JSON без пояснений: registrationNumber (номер регистрационного удостоверения), tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), manufacturer (производитель), validUntil (срок действия). Если поля нет, используй пустую строку.`,
  'doc-current-spc-ru': `Извлеки из текста действующей ОХЛП (русский) следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), shelfLife (срок годности), storage (условия хранения). Если поля нет, используй пустую строку.`,
  'doc-current-spc-kz': `Извлеки из текста действующей ОХЛП (казахский) следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), shelfLife (срок годности), storage (условия хранения). Если поля нет, используй пустую строку.`,
  'doc-updated-spc-ru': `Извлеки из текста проекта ОХЛП с изменениями (русский) следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), shelfLife (срок годности), storage (условия хранения), changedValue (изменённое значение), oldValue (старое значение), newValue (новое значение). Если поля нет, используй пустую строку.`,
  'doc-updated-spc-kz': `Извлеки из текста проекта ОХЛП с изменениями (казахский) следующие поля и верни строго JSON без пояснений: tradeName (торговое наименование), inn (МНН), dosage (дозировка), dosageForm (лекарственная форма), shelfLife (срок годности), storage (условия хранения), changedValue (изменённое значение), oldValue (старое значение), newValue (новое значение). Если поля нет, используй пустую строку.`,
  'doc-variation-description': `Извлеки из текста описания вносимых изменений следующие поля и верни строго JSON без пояснений: variationClass (класс изменения: IA, IB или II), variationArea (область изменений), oldValue (старое значение), newValue (новое значение), affectedDocuments (затронутые документы), changeDescription (описание изменения). Если поля нет, используй пустую строку.`,
  'doc-variation-justification': `Извлеки из текста обоснования изменений следующие поля и верни строго JSON без пояснений: justificationText (обоснование), impactAssessment (оценка влияния), stabilityData (данные стабильности). Если поля нет, используй пустую строку.`,
  'doc-variation-comparison': `Извлеки из текста сравнительной таблицы изменений следующие поля и верни строго JSON без пояснений: oldValue (старое значение), newValue (новое значение), changedSection (раздел документа), documentsAffected (затронутые документы). Если поля нет, используй пустую строку.`,
  'doc-post-marketing-data': `Извлеки из текста пострегистрационных данных следующие поля и верни строго JSON без пояснений: reportDate (дата отчёта), periodCovered (период), safetySummary (сводка по безопасности), efficacySummary (сводка по эффективности). Если поля нет, используй пустую строку.`,
  'doc-no-changes-statement': `Извлеки из текста заявления об отсутствии изменений следующие поля и верни строго JSON без пояснений: statementDate (дата заявления), confirmsNoChanges (подтверждение отсутствия изменений: да/нет). Если поля нет, используй пустую строку.`,
  'doc-mi-application': `Извлеки из текста заявления на регистрацию МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), manufacturer (производитель), riskClass (класс риска), applicant (заявитель). Если поля нет, используй пустую строку.`,
  'doc-mi-registration-certificate': `Извлеки из текста регистрационного удостоверения МИ следующие поля и верни строго JSON без пояснений: registrationNumber (номер), tradeName (наименование), model (модель), manufacturer (производитель), validUntil (срок действия). Если поля нет, используй пустую строку.`,
  'doc-mi-technical-tests': `Извлеки из текста протокола технических испытаний МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), conclusion (вывод), testDate (дата испытаний). Если поля нет, используй пустую строку.`,
  'doc-mi-biological-studies': `Извлеки из текста протокола исследований биологического действия МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), conclusion (вывод), studyDate (дата исследования). Если поля нет, используй пустую строку.`,
  'doc-mi-clinical-trials': `Извлеки из текста протокола клинических испытаний МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), conclusion (вывод), trialDate (дата испытаний). Если поля нет, используй пустую строку.`,
  'doc-mi-instructions': `Извлеки из текста инструкции / эксплуатационной документации МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), manufacturer (производитель), intendedUse (назначение), contraindications (противопоказания), warnings (предупреждения), textContent (первые 3000 символов текста). Если поля нет, используй пустую строку.`,
  'doc-mi-current-instructions': `Извлеки из текста действующей инструкции / эксплуатационной документации МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), textContent (первые 3000 символов текста). Если поля нет, используй пустую строку.`,
  'doc-mi-updated-instructions': `Извлеки из текста проекта инструкции / эксплуатационной документации МИ с изменениями следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), changedValue (изменённое значение), oldValue (старое значение), newValue (новое значение), textContent (первые 3000 символов текста). Если поля нет, используй пустую строку.`,
  'doc-mi-labeling': `Извлеки из текста маркировки МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), manufacturer (производитель), textContent (первые 3000 символов текста). Если поля нет, используй пустую строку.`,
  'doc-mi-qms-certificate': `Извлеки из текста сертификата СМК / декларации соответствия МИ следующие поля и верни строго JSON без пояснений: manufacturer (производитель), certificateNumber (номер), validUntil (срок действия), scope (область). Если поля нет, используй пустую строку.`,
  'doc-mi-registration-dossier': `Извлеки из текста регистрационного досье МИ следующие поля и верни строго JSON без пояснений: tradeName (наименование), model (модель), riskClass (класс риска), manufacturer (производитель). Если поля нет, используй пустую строку.`,
  'doc-mi-post-marketing': `Извлеки из текста пострегистрационных данных МИ следующие поля и верни строго JSON без пояснений: reportDate (дата отчёта), periodCovered (период), safetySummary (сводка по безопасности). Если поля нет, используй пустую строку.`,
  'doc-mi-variation-description': `Извлеки из текста описания изменений МИ следующие поля и верни строго JSON без пояснений: variationClass (класс изменения: IA/IB/II), variationArea (область изменений), oldValue (старое значение), newValue (новое значение), changeDescription (описание изменения). Если поля нет, используй пустую строку.`,
  'doc-mi-variation-justification': `Извлеки из текста обоснования изменений МИ следующие поля и верни строго JSON без пояснений: justificationText (обоснование), impactAssessment (оценка влияния). Если поля нет, используй пустую строку.`,
};

interface ParserServicePage {
  page: number;
  text?: string;
  textLength?: number;
  needsOcr?: boolean;
  imageBase64?: string;
  imageMime?: string;
}

interface ParserServiceResponse {
  fileName?: string;
  bytes?: number;
  pageCount?: number;
  imagePages?: number;
  textChars?: number;
  durationMs?: number;
  pages?: ParserServicePage[];
}

async function extractTextFromBuffer(buffer: Buffer, contentType: string, fileName?: string): Promise<string> {
  const ext = path.extname(fileName || '').toLowerCase();
  logExtractor('text-start', { fileName, ext, contentType, bytes: buffer.length });

  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff'].includes(ext) || contentType.startsWith('image/')) {
    logExtractor('text-skip-image', { fileName, ext, contentType });
    return '';
  }

  if (ext === '.docx' || contentType.includes('wordprocessingml') || isZipBasedOfficeDocument(buffer)) {
    logExtractor('docx-start', { fileName });
    const result = await mammoth.extractRawText({ buffer });
    logExtractor('docx-done', { fileName, chars: result.value.length });
    return result.value;
  }

  if (ext === '.doc' || contentType === 'application/msword') {
    logExtractor('doc-start', { fileName });
    const libreOfficeText = await extractLegacyWordTextWithLibreOffice(buffer, fileName || 'document.doc');
    logExtractor('doc-done', { fileName, chars: libreOfficeText.length });
    if (libreOfficeText.trim()) return libreOfficeText;
  }

  if (ext === '.pdf' || contentType === 'application/pdf') {
    return extractPdfTextLayerByPage(buffer, fileName || 'document.pdf');
  }

  return buffer.toString('utf-8');
}

function isZipBasedOfficeDocument(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer.includes(Buffer.from('[Content_Types].xml'));
}

async function extractLegacyWordTextWithLibreOffice(buffer: Buffer, fileName: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndda-doc-'));
  const inputPath = path.join(tempDir, path.basename(fileName) || 'document.doc');
  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync('libreoffice', ['--headless', '--convert-to', 'txt:Text', '--outdir', tempDir, inputPath], {
      timeout: 60000,
      maxBuffer: 5 * 1024 * 1024,
    });
    const convertedPath = inputPath.replace(/\.[^.]+$/, '.txt');
    return await fs.readFile(convertedPath, 'utf8');
  } catch (error) {
    console.warn('[libreoffice-doc] failed', error instanceof Error ? error.message : error);
    return '';
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function buildGenericExtraction(text: string, vision?: GemmaVisionTextResult): Record<string, string> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      extractionStatus: vision?.status || 'failed',
      extractionProvider: vision?.provider || 'local-parser',
      extractionPromptVersion: vision?.promptVersion || 'generic-text-v1',
      extractionErrors: vision?.errors.join('; ') || 'No text layer or OCR text was extracted',
      textLayer: 'нет',
      textLength: '0',
      textContent: '',
    };
  }

  return {
    extractionStatus: vision?.status === 'partial' ? 'partial' : 'success',
    extractionProvider: vision?.provider || 'local-parser',
    extractionPromptVersion: vision?.promptVersion || 'generic-text-v1',
    extractionErrors: vision?.errors.join('; ') || '',
    textLayer: vision?.status === 'partial' ? 'частично' : vision?.provider && vision.provider !== 'document-parser-service' ? 'нет' : 'да',
    ocrProvider: vision?.provider || '',
    ocrPromptVersion: vision?.promptVersion || '',
    textLength: String(trimmed.length),
    textContent: trimmed,
  };
}

function isImageFile(fileName: string, contentType = ''): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'].includes(ext) || contentType.startsWith('image/');
}

function isPdfFile(fileName: string, contentType = ''): boolean {
  return path.extname(fileName).toLowerCase() === '.pdf' || contentType === 'application/pdf';
}

let pdfRendererPromise: Promise<{
  pdfjsLib: any;
  createCanvas: (width: number, height: number) => any;
}> | null = null;

async function loadPdfRenderer() {
  if (!pdfRendererPromise) {
    pdfRendererPromise = (async () => {
      const require = createRequire(import.meta.url);
      const canvas = require('@napi-rs/canvas') as { createCanvas: (width: number, height: number) => any };
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      return { pdfjsLib, createCanvas: canvas.createCanvas };
    })();
  }
  return pdfRendererPromise;
}

async function loadPdfDocument(buffer: Buffer, fileName: string, phase: string) {
  const { pdfjsLib } = await loadPdfRenderer();
  logExtractor('pdf-load-start', { fileName, phase, bytes: buffer.length });
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
  } as any).promise;
  logExtractor('pdf-load-done', { fileName, phase, pages: pdf.numPages });
  return pdf;
}

async function extractPdfTextLayerByPage(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const pdf = await loadPdfDocument(buffer, fileName, 'text');
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      logExtractor('pdf-page-text-start', { fileName, page: pageNumber, pages: pdf.numPages });
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = (textContent.items || [])
        .map((item: any) => typeof item?.str === 'string' ? item.str : '')
        .filter(Boolean)
        .join(' ');
      if (typeof page.cleanup === 'function') page.cleanup();
      logExtractor('pdf-page-text-done', { fileName, page: pageNumber, chars: text.length });
      if (text.trim()) pages.push(`--- Страница ${pageNumber} ---\n${text.trim()}`);
    }
    const result = pages.join('\n\n');
    logExtractor('pdf-text-done', { fileName, pages: pdf.numPages, chars: result.length });
    return result;
  } catch (error) {
    logExtractor('pdf-text-failed', { fileName, error: error instanceof Error ? error.message : String(error) });
    return '';
  }
}

async function extractPdfTextWithPageOcrFallback(
  buffer: Buffer,
  fileName: string,
): Promise<{ text: string; vision?: GemmaVisionTextResult }> {
  return extractFileWithParserService(buffer, fileName, 'application/pdf');
}

async function extractImageTextWithParserService(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<{ text: string; vision?: GemmaVisionTextResult }> {
  return extractFileWithParserService(buffer, fileName, contentType || 'image/png');
}

async function extractFileWithParserService(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<{ text: string; vision?: GemmaVisionTextResult }> {
  const parserUrl = process.env.DOCUMENT_PARSER_URL || process.env.NDDA_DOCUMENT_PARSER_URL;
  if (!parserUrl) throw new Error('DOCUMENT_PARSER_URL is required for PDF/image extraction. Local fallback is disabled.');
  return extractWithParserService(buffer, fileName, contentType, parserUrl);
}

async function extractWithParserService(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  parserUrl: string,
): Promise<{ text: string; vision?: GemmaVisionTextResult }> {
  const timeoutMs = Number(process.env.NDDA_DOCUMENT_PARSER_TIMEOUT_MS || 90000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType || 'application/octet-stream' }), fileName || 'document');
  form.append('min_text_chars', '80');
  form.append('zoom', '2.4');
  form.append('include_images', 'true');

  try {
    const url = `${parserUrl.replace(/\/+$/, '')}/parse`;
    logExtractor('parser-service-start', { fileName, url, bytes: buffer.length, timeoutMs });
    const response = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`parser service ${response.status}: ${text.slice(0, 1000)}`);
    const parsed = JSON.parse(text) as ParserServiceResponse;
    logExtractor('parser-service-done', {
      fileName,
      pages: parsed.pageCount || parsed.pages?.length || 0,
      imagePages: parsed.imagePages || 0,
      textChars: parsed.textChars || 0,
      durationMs: parsed.durationMs,
    });
    return buildPdfTextFromParserPages(fileName, parsed.pages || []);
  } finally {
    clearTimeout(timeout);
  }
}

async function buildPdfTextFromParserPages(
  fileName: string,
  parsedPages: ParserServicePage[],
): Promise<{ text: string; vision?: GemmaVisionTextResult }> {
  const pages: string[] = [];
  let imagePages = 0;

  for (const page of parsedPages) {
    const text = String(page.text || '').trim();
    if (text) pages.push(`--- Страница ${page.page} ---\n${text}`);
    if (page.imageBase64) {
      imagePages += 1;
      if (!text) pages.push(`--- Страница ${page.page} ---\n[Страница подготовлена parser-service как изображение для OCR/Gemma. Текстовый слой отсутствует или недостаточен.]`);
    }
  }

  return {
    text: pages.join('\n\n'),
    vision: {
      text: '',
      provider: 'document-parser-service',
      promptVersion: imagePages > 0 ? 'parser-prepared-image-pages-v1' : 'parser-text-layer-v1',
      status: imagePages > 0 ? 'partial' : 'success',
      errors: [],
      raw: '',
    },
  };
}

function safeTempFileName(fileName: string): string {
  const ext = path.extname(fileName) || '.pdf';
  const stem = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'document';
  return `${stem}${ext}`;
}

async function renderPdfPageToPngBuffer(pdf: any, pageNumber: number): Promise<Buffer> {
  const { createCanvas } = await loadPdfRenderer();
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.4 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const canvasContext = canvas.getContext('2d');
  await page.render({ canvasContext: canvasContext as any, viewport, canvas } as any).promise;
  enhanceRenderedPage(canvasContext as any, Math.ceil(viewport.width), Math.ceil(viewport.height));
  if (typeof page.cleanup === 'function') page.cleanup();
  return canvas.toBuffer('image/png');
}

function enhanceRenderedPage(canvasContext: any, width: number, height: number) {
  try {
    const imageData = canvasContext.getImageData(0, 0, width, height);
    const data = imageData.data;
    const contrast = 1.18;
    for (let index = 0; index < data.length; index += 4) {
      const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
      const adjusted = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
      data[index] = adjusted;
      data[index + 1] = adjusted;
      data[index + 2] = adjusted;
    }
    canvasContext.putImageData(imageData, 0, 0);
  } catch (error) {
    console.warn('[pdf-ocr-preprocess] skipped', error instanceof Error ? error.message : error);
  }
}

async function extractPdfImageTextWithGemma(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<GemmaVisionTextResult | undefined> {
  if (!isPdfFile(fileName, contentType)) return undefined;

  try {
    const pdf = await loadPdfDocument(buffer, fileName, 'ocr');
    const pageResults: GemmaVisionTextResult[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      logExtractor('pdf-render-page-start', { fileName, page: pageNumber, pages: pdf.numPages });
      const image = await renderPdfPageToPngBuffer(pdf, pageNumber);
      logExtractor('pdf-render-page-done', { fileName, page: pageNumber, imageBytes: image.length });
      logExtractor('gemma-pdf-page-start', { fileName, page: pageNumber, imageBytes: image.length });
      throw new Error('Direct PDF page Gemma OCR fallback is disabled. Use document-parser-service.');
    }

    const text = pageResults
      .map((result, index) => result.text.trim() ? `--- Страница ${index + 1} ---\n${result.text.trim()}` : '')
      .filter(Boolean)
      .join('\n\n');
    const errors = pageResults.flatMap((result) => result.errors);
    const provider = pageResults.find((result) => result.provider)?.provider || 'local-parser';
    const promptVersion = pageResults.find((result) => result.promptVersion)?.promptVersion || 'gemma-vision-ocr-v1';

    return {
      text,
      provider,
      promptVersion,
      status: text ? 'success' : pageResults.some((result) => result.status === 'failed') ? 'failed' : 'partial',
      errors,
      raw: pageResults.map((result) => result.raw || '').filter(Boolean).join('\n\n'),
    };
  } catch (error) {
    return {
      text: '',
      provider: 'local-pdf-renderer',
      promptVersion: 'pdfjs-gemma-vision-ocr-v1',
      status: 'failed',
      errors: [error instanceof Error ? error.message : 'PDF render OCR failed'],
    };
  }
}

export async function extractPlainTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  contentType = ''
): Promise<string> {
  if (isPdfFile(fileName, contentType)) {
    const pdf = await extractPdfTextWithPageOcrFallback(buffer, fileName);
    return pdf.text;
  }
  const text = await extractTextFromBuffer(buffer, contentType, fileName);
  return text;
}

export interface DocxStyleInfo {
  fonts: string[];
  sizes: string[];
  colors: string[];
  hasBold: boolean;
  hasItalic: boolean;
}

async function extractDocxStyleInfo(buffer: Buffer): Promise<DocxStyleInfo | undefined> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) return undefined;

    const fonts = new Set<string>();
    const sizes = new Set<string>();
    const colors = new Set<string>();
    let hasBold = false;
    let hasItalic = false;

    const runProps = documentXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/g) || [];
    for (const rPr of runProps) {
      const fontMatch = rPr.match(/<w:rFonts[^>]*(?:w:ascii|w:eastAsia|w:hAnsi)="([^"]+)"/);
      if (fontMatch) fonts.add(fontMatch[1]);
      const sizeMatch = rPr.match(/<w:sz[^>]*w:val="([^"]+)"/);
      if (sizeMatch) sizes.add(sizeMatch[1]);
      const colorMatch = rPr.match(/<w:color[^>]*w:val="([^"]+)"/);
      if (colorMatch) colors.add(colorMatch[1]);
      if (/<w:b\s*\/>|<w:b[^>]*w:val="1"/.test(rPr)) hasBold = true;
      if (/<w:i\s*\/>|<w:i[^>]*w:val="1"/.test(rPr)) hasItalic = true;
    }

    return {
      fonts: Array.from(fonts),
      sizes: Array.from(sizes),
      colors: Array.from(colors),
      hasBold,
      hasItalic,
    };
  } catch (err) {
    console.warn('[extractDocxStyleInfo] failed', (err as Error).message);
    return undefined;
  }
}

async function callExtractionModel(prompt: string, text: string): Promise<Record<string, string>> {
  const result = await callGemmaJson({ prompt, text });
  return {
    ...result.data,
    extractionStatus: result.status,
    extractionProvider: result.provider,
    extractionPromptVersion: result.promptVersion,
    extractionErrors: result.errors.join('; '),
  };
}

export async function extractDocumentFromBuffer(
  buffer: Buffer,
  fileName: string,
  documentTypeId: string
): Promise<Record<string, string>> {
  const prompt = EXTRACTION_PROMPTS[documentTypeId];
  const ext = path.extname(fileName).toLowerCase();
  const contentType =
    ext === '.docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : ext === '.pdf'
        ? 'application/pdf'
        : ['.jpg', '.jpeg', '.png'].includes(ext)
          ? `image/${ext.replace('.', '').replace('jpg', 'jpeg')}`
          : 'application/octet-stream';

  const serviceText = isPdfFile(fileName, contentType)
    ? await extractPdfTextWithPageOcrFallback(buffer, fileName)
    : isImageFile(fileName, contentType)
      ? await extractImageTextWithParserService(buffer, fileName, contentType)
      : undefined;
  const text = serviceText ? serviceText.text : await extractTextFromBuffer(buffer, contentType, fileName);
  const vision = serviceText?.vision;

  if (!prompt) {
    const extracted = buildGenericExtraction(text, vision);
    if (ext === '.docx') {
      const styleInfo = await extractDocxStyleInfo(buffer);
      if (styleInfo) {
        extracted.fonts = styleInfo.fonts.join(', ');
        extracted.sizes = styleInfo.sizes.join(', ');
        extracted.colors = styleInfo.colors.join(', ');
        extracted.hasBold = styleInfo.hasBold ? 'да' : 'нет';
        extracted.hasItalic = styleInfo.hasItalic ? 'да' : 'нет';
      }
    }
    return extracted;
  }

  if (!text.trim()) {
    return {
      extractionStatus: vision?.status || 'failed',
      extractionProvider: vision?.provider || 'local-parser',
      extractionPromptVersion: vision?.promptVersion || 'unknown',
      extractionErrors: vision?.errors.join('; ') || 'No text layer or OCR text was extracted',
      textLayer: 'нет',
    };
  }

  const extracted = await callExtractionModel(prompt, text);
  if (vision) {
    extracted.ocrProvider = vision.provider;
    extracted.ocrPromptVersion = vision.promptVersion;
  }
  extracted.textLength = String(text.length);
  extracted.textLayer = text.trim().length > 0 ? 'да' : 'нет';

  if (ext === '.docx') {
    const styleInfo = await extractDocxStyleInfo(buffer);
    if (styleInfo) {
      extracted.fonts = styleInfo.fonts.join(', ');
      extracted.sizes = styleInfo.sizes.join(', ');
      extracted.colors = styleInfo.colors.join(', ');
      extracted.hasBold = styleInfo.hasBold ? 'да' : 'нет';
      extracted.hasItalic = styleInfo.hasItalic ? 'да' : 'нет';
    }
  }

  return extracted;
}

export async function extractDocument(filePath: string, documentTypeId: string): Promise<Record<string, string>> {
  // Prefer pre-extracted .txt sidecar if it exists
  const txtPath = filePath + '.txt';
  try {
    const txt = await fs.readFile(txtPath, 'utf-8');
    if (txt.trim()) {
      const prompt = EXTRACTION_PROMPTS[documentTypeId];
      if (!prompt) return {};
      return callExtractionModel(prompt, txt);
    }
  } catch {
    // fall through to binary parsing
  }

  const buffer = await fs.readFile(filePath);
  return extractDocumentFromBuffer(buffer, path.basename(filePath), documentTypeId);
}
