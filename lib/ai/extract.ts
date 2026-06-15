import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import JSZip from 'jszip';

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

async function extractTextFromBuffer(buffer: Buffer, contentType: string, fileName?: string): Promise<string> {
  const ext = path.extname(fileName || '').toLowerCase();

  if (ext === '.docx' || contentType.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.slice(0, 8000);
  }

  if (ext === '.pdf' || contentType === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      return data.text.slice(0, 8000);
    } catch (err) {
      console.warn('[pdf-parse] failed, falling back to raw buffer', (err as Error).message);
      return buffer.toString('utf-8').slice(0, 8000);
    }
  }

  return buffer.toString('utf-8').slice(0, 8000);
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

function cleanJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

async function callExtractionModel(prompt: string, text: string): Promise<Record<string, string>> {
  const url = process.env.VLLM_URL;
  const apiKey = process.env.VLLM_API_KEY;
  const model = process.env.VLLM_MODEL;

  if (!url || !apiKey || !model) {
    throw new Error('VLLM environment variables are not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Ты помогаешь извлекать структурированные данные из фармацевтических документов. Всегда отвечай только валидным JSON.' },
        { role: 'user', content: `${prompt}\n\nТекст документа:\n${text.slice(0, 6000)}` },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`VLLM request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as any;
  const raw = data.choices?.[0]?.message?.content || '';
  const cleaned = cleanJson(raw);
  try {
    return JSON.parse(cleaned) as Record<string, string>;
  } catch {
    return { rawText: text.slice(0, 1000), aiRaw: raw.slice(0, 1000) };
  }
}

export async function extractDocumentFromBuffer(
  buffer: Buffer,
  fileName: string,
  documentTypeId: string
): Promise<Record<string, string>> {
  const prompt = EXTRACTION_PROMPTS[documentTypeId];
  if (!prompt) {
    return {};
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType =
    ext === '.docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';

  const text = await extractTextFromBuffer(buffer, contentType, fileName);
  if (!text.trim()) {
    return {};
  }

  const extracted = await callExtractionModel(prompt, text);

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
