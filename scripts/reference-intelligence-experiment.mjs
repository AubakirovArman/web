import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

loadLocalEnv(path.resolve(process.cwd(), '.env'));
loadLocalEnv(path.resolve(process.cwd(), '..', '.env'));

const PROMPT_VERSION = 'reference_intelligence_experiment_v1';
const ROOT_DIR = path.resolve(process.cwd(), '..');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/reference-intelligence');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'experiment.json');
const CACHE_DIR = path.resolve(process.cwd(), '.reference-postgres/intelligence-runs');
const CONVERT_DIR = path.resolve(process.cwd(), '.reference-postgres/intelligence-converted-docx');
const MAX_INPUT_CHARS = Number(readArg('--max-input-chars') || process.env.REFERENCE_INTELLIGENCE_MAX_INPUT_CHARS || 62000);
const DEFAULT_MAX_DOCUMENTS = process.argv.includes('--all') ? Number.MAX_SAFE_INTEGER : Number(readArg('--max-documents') || 1);
const FORCE = process.argv.includes('--force');
const NO_GEMMA = process.argv.includes('--no-gemma');
const GEMMA_ENDPOINT = normalizeGemmaEndpoint(
  process.env.GEMMA_APP_BASE_URL || process.env.GEMMA_BASE_URL || process.env.VLLM_URL || 'http://89.106.235.4:8000',
);
const GEMMA_MODEL = process.env.GEMMA_MODEL || process.env.VLLM_MODEL || 'google/gemma-4-31B-it';
const GEMMA_API_KEY = process.env.GEMMA_API_KEY || process.env.VLLM_API_KEY || '';
const GEMMA_TIMEOUT_MS = Number(process.env.GEMMA_TIMEOUT_MS || 240000);

const TARGET_DOCUMENTS = [
  ['ls-22', 'ЛС/22. Приказ МЗ РК от 27.01.2021 г. № ҚР ДСМ-10.docx'],
  ['ls-2', 'ЛС/2. Решение № 78 О Правилах регистрации и экспертизы ЛС.docx'],
  ['ls-10', 'ЛС/10. Решение № 88 от 3 ноября 2016 года.docx'],
  ['ls-4', 'ЛС/4. Решение № 85 от 3 ноября 2016 года.docx'],
  ['ls-7', 'ЛС/7. Решение № 77 от 3 ноября 2016 года.docx'],
  ['ls-11', 'ЛС/11. Решение № 87 от 3 ноября 2016 года.docx'],
  ['ls-15', 'ЛС/15. Решение №65 от 24 апреля 2018 года.docx'],
  ['ls-18', 'ЛС/18. Приказ МЗ РК от 27.01.2021 г. № ҚР ДСМ-9.docx'],
  ['ls-21', 'ЛС/21. Приказ МЗ РК от 23.12. 2020 г. № ҚР ДСМ-320 2020.docx'],
  ['ls-25', 'ЛС/25. Приказ МЗ РК от 27.01. 2021 г. № ҚР ДСМ-11.docx'],
  ['ls-31', 'ЛС/31. Приказ МЗ РК от 16.02.2021 г.№ ҚР ДСМ-20.docx'],
];

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.mkdir(CACHE_DIR, { recursive: true });
await fs.mkdir(CONVERT_DIR, { recursive: true });

const prepared = [];
for (const [id, relativePath] of TARGET_DOCUMENTS) {
  const sourcePath = path.join(ROOT_DIR, relativePath);
  if (!fsSync.existsSync(sourcePath)) {
    console.warn(`[missing] ${relativePath}`);
    continue;
  }
  const document = buildDocumentMeta(id, sourcePath);
  const docxPath = prepareDocxSource(sourcePath);
  const paragraphs = await parseDocxParagraphs(docxPath);
  const sections = buildSections(document, paragraphs);
  const rawText = sections.map((section) => section.text).join('\n\n');
  prepared.push({
    document,
    sections,
    rawText,
    charCount: rawText.length,
    tokenEstimate: estimateTokens(rawText),
  });
}

prepared.sort((left, right) => left.tokenEstimate - right.tokenEstimate);

const documents = [];
let processed = 0;
for (const item of prepared) {
  const base = buildBaseOutput(item);
  if (NO_GEMMA || processed >= DEFAULT_MAX_DOCUMENTS) {
    documents.push({ ...base, status: 'pending' });
    continue;
  }

  try {
    const intelligence = await analyzeDocument(item);
    documents.push({
      ...base,
      status: 'processed',
      processedAt: new Date().toISOString(),
      promptVersion: PROMPT_VERSION,
      intelligence,
    });
    processed += 1;
    console.log(`[processed] ${item.document.id} tokens=${item.tokenEstimate} ${item.document.fileName}`);
  } catch (error) {
    documents.push({
      ...base,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    processed += 1;
    console.error(`[error] ${item.document.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  promptVersion: PROMPT_VERSION,
  model: NO_GEMMA ? null : GEMMA_MODEL,
  mode: NO_GEMMA ? 'metadata-only' : 'gemma-experiment',
  processedCount: documents.filter((doc) => doc.status === 'processed').length,
  targetCount: documents.length,
  sort: 'tokenEstimate:asc',
  note: 'Экспериментальный умный справочник. Обрабатываем MVP-ядро НПА от самых маленьких документов к самым большим.',
  documents,
};

await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`written=${OUTPUT_PATH}`);
console.log(`processed=${output.processedCount}/${output.targetCount}`);
console.log('order:');
for (const doc of documents) {
  console.log(`- ${doc.id} tokens=${doc.tokenEstimate} status=${doc.status} ${doc.fileName}`);
}

function buildDocumentMeta(id, sourcePath) {
  const fileName = path.basename(sourcePath);
  const title = fileName.replace(/\.(docx?|rtf)$/i, '').replace(/^\d+\.\s*/, '').trim();
  const domain = sourcePath.includes(`${path.sep}МИ${path.sep}`) || sourcePath.includes('/МИ/') ? 'MI' : 'LS';
  const kind = inferKind(title);
  const number = extractNumber(title);
  const date = extractDate(title);
  return {
    id,
    domain,
    title,
    fileName,
    sourcePath,
    kind,
    number,
    date,
    tags: Array.from(new Set([domain, kindLabel(kind), number ? `№ ${number}` : '', date || ''].filter(Boolean))),
  };
}

function prepareDocxSource(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.docx') return sourcePath;
  if (ext !== '.doc') throw new Error(`Unsupported Word extension: ${ext}`);

  const targetPath = path.join(CONVERT_DIR, `${path.basename(sourcePath, ext)}.docx`);
  if (fsSync.existsSync(targetPath)) return targetPath;

  const result = spawnSync('libreoffice', ['--headless', '--convert-to', 'docx', '--outdir', CONVERT_DIR, sourcePath], {
    encoding: 'utf-8',
  });
  if (result.status !== 0 || !fsSync.existsSync(targetPath)) {
    throw new Error(`LibreOffice conversion failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return targetPath;
}

async function parseDocxParagraphs(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error(`word/document.xml not found in ${filePath}`);
  const xml = await documentFile.async('string');
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const result = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const pXml = paragraphs[index];
    const text = normalizeParagraphText(extractParagraphText(pXml));
    if (!text) continue;
    result.push({
      index: index + 1,
      style: extractAttr(pXml, /<w:pStyle[^>]*w:val="([^"]+)"/),
      text,
    });
  }
  return result;
}

function extractParagraphText(pXml) {
  const parts = [];
  const tokenRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\s*\/>/g;
  let match;
  while ((match = tokenRe.exec(pXml))) {
    if (match[1] !== undefined) parts.push(decodeXml(match[1]));
    else if (match[0].startsWith('<w:tab')) parts.push(' ');
    else parts.push('\n');
  }
  return parts.join('');
}

function buildSections(document, paragraphs) {
  const sections = [];
  let current = null;

  function flush() {
    if (!current) return;
    current.text = cleanupLegalText(current.text);
    if (current.text) sections.push(current);
    current = null;
  }

  for (const paragraph of paragraphs) {
    const classified = classifyParagraph(paragraph.text, paragraph.style);
    if (classified) {
      flush();
      current = {
        id: `${document.id}-section-${sections.length + 1}`,
        title: classified.title,
        level: classified.level,
        anchor: slugify(`${classified.number || sections.length + 1}-${classified.title}`) || `section-${sections.length + 1}`,
        sectionType: classified.type,
        headingNumber: classified.number,
        text: paragraph.text,
      };
      continue;
    }

    if (!current) {
      current = {
        id: `${document.id}-section-${sections.length + 1}`,
        title: 'Вводная часть',
        level: 1,
        anchor: `section-${sections.length + 1}`,
        sectionType: 'preamble',
        headingNumber: '',
        text: '',
      };
    }
    current.text += `${current.text ? '\n\n' : ''}${paragraph.text}`;
  }
  flush();

  return sections.map((section, index) => ({ ...section, sortOrder: index + 1, rawCharCount: section.text.length }));
}

function classifyParagraph(text, style) {
  const value = text.trim();
  if (!value) return null;

  const appendix = value.match(/^Приложение\s*(?:№|N)?\s*(?<num>\d+)?\s*(?<tail>.*)$/i);
  if (appendix) return { type: 'appendix', level: 1, number: appendix.groups?.num ? `Приложение №${appendix.groups.num}` : 'Приложение', title: value };

  const roman = value.match(/^(?<num>[IVXLCDM]+)\.\s*(?<title>[\s\S]+)$/i);
  if (roman && value.length <= 280) return { type: 'chapter', level: 1, number: roman.groups.num, title: roman.groups.title.trim() };

  if (isDocumentHeading(value, style)) return { type: 'heading', level: 1, number: '', title: value };

  const letter = value.match(/^(?:(?<artifact>\d+)\.\s*)?(?<letter>[а-яё])\)\s*(?<title>.+)$/i);
  if (letter) return { type: 'subpoint', level: 3, number: `${letter.groups.letter.toLowerCase()})`, title: `${letter.groups.letter.toLowerCase()}) ${letter.groups.title.trim()}` };

  const nested = value.match(/^(?<num>\d+(?:\.\d+){1,5})\.\s*(?<title>.+)$/);
  if (nested) return { type: 'subpoint', level: 3, number: nested.groups.num, title: nested.groups.title.trim() };

  const point = value.match(/^(?<num>\d{1,3})\.\s+(?<title>.+)$/);
  if (point) return { type: 'point', level: 2, number: point.groups.num, title: titleFromText(point.groups.title.trim(), `Пункт ${point.groups.num}`) };

  return null;
}

function buildBaseOutput(item) {
  return {
    ...item.document,
    tokenEstimate: item.tokenEstimate,
    charCount: item.charCount,
    sectionsCount: item.sections.length,
    sections: item.sections.map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      anchor: section.anchor,
      sectionType: section.sectionType,
      headingNumber: section.headingNumber,
      text: section.text,
      rawCharCount: section.rawCharCount,
    })),
  };
}

async function analyzeDocument(item) {
  const cacheKey = sha256(`${PROMPT_VERSION}\n${GEMMA_MODEL}\n${item.document.id}\n${item.rawText}`);
  const cachePath = path.join(CACHE_DIR, `${item.document.id}-${cacheKey.slice(0, 12)}.json`);
  if (!FORCE && fsSync.existsSync(cachePath)) {
    return JSON.parse(await fs.readFile(cachePath, 'utf-8'));
  }

  const prompt = buildIntelligencePrompt(item);
  const response = await fetch(GEMMA_ENDPOINT.chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GEMMA_API_KEY ? { Authorization: `Bearer ${GEMMA_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: GEMMA_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Ты методолог НЦЭЛС, аналитик НПА и архитектор правил проверки регистрационного досье. Извлекай только подтвержденное текстом. Отвечай строго JSON без markdown.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 12000,
    }),
    signal: AbortSignal.timeout(GEMMA_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Gemma HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content || '{}';
  const parsed = normalizeIntelligencePayload(JSON.parse(cleanJson(raw)), item);
  await fs.writeFile(cachePath, JSON.stringify(parsed, null, 2), 'utf-8');
  return parsed;
}

function buildIntelligencePrompt(item) {
  const documentText = buildDocumentText(item);
  return [
    'Проанализируй нормативный документ для интеллектуального справочника веб-приложения экспертизы ЛС/МИ.',
    '',
    'Цель не пересказать документ, а вытащить полезные для проекта сущности:',
    '- требования к документам заявителя;',
    '- параметры заявки, влияющие на комплектность/проверки;',
    '- зависимости вида если выбран параметр X, тогда нужен документ/проверка Y;',
    '- типы документов, упомянутые в НПА;',
    '- проверки, которые можно автоматизировать или подсветить эксперту;',
    '- ключевые пункты НПА и короткие подтверждающие цитаты.',
    '',
    'Правила:',
    '1. Не придумывай. Если данных нет, верни пустой массив.',
    '2. Каждый вывод должен иметь source_point и короткий quote.',
    '3. Пиши прикладно для нашего проекта: заявка, чеклист документов, правила, проверки, эксперт.',
    '4. Требование формулируй атомарно: что требуется, для какого документа, при каком условии, зачем это важно.',
    '5. Если видишь пункт/подпункт/приложение, обязательно укажи его в source_point.',
    '6. Выделяй ключевые слова для поиска и подсветки в интерфейсе.',
    '',
    'Верни JSON строго по схеме:',
    '{',
    '  "summary": {"short": "", "detailed": "", "project_relevance": "", "regulated_scope": ""},',
    '  "key_points": [{"title": "", "description": "", "project_impact": "", "keywords": [], "source_point": "", "quote": ""}],',
    '  "procedures": [{"name": "регистрация|перерегистрация|внесение изменений|неясно", "why_relevant": "", "source_point": "", "quote": ""}],',
    '  "document_types": [{"code": "", "name": "", "mapped_guess": "", "procedure": "", "requiredness": "обязателен|при наличии|зависит от условия|неясно", "condition": "", "why_needed": "", "source_point": "", "quote": ""}],',
    '  "requirements": [{"title": "", "requirement_text": "", "applies_to_document": "", "procedure": "", "condition": "", "applicant_parameters": [], "criticality": "critical|serious|warning|unknown", "why_it_matters": "", "source_point": "", "quote": "", "keywords": []}],',
    '  "applicant_parameters": [{"key": "", "label": "", "type": "enum|boolean|text|date|number", "options": [], "why_needed": "", "source_point": "", "quote": ""}],',
    '  "dependencies": [{"condition_text": "", "if_parameters": [], "then_required_documents": [], "then_checks": [], "explanation": "", "source_point": "", "quote": ""}],',
    '  "checks": [{"name": "", "check_type": "format|presence|content|consistency|date|ocr|manual|llm", "target_document": "", "automation_hint": "", "source_point": "", "quote": ""}],',
    '  "highlights": [{"kind": "requirement|parameter|dependency|document_type|check|key_point", "title": "", "section_hint": "", "source_point": "", "quote": "", "importance": ""}],',
    '  "quality_notes": [""]',
    '}',
    '',
    `Документ: ${item.document.title}`,
    `Файл: ${item.document.fileName}`,
    `Оценка размера: ${item.tokenEstimate} токенов`,
    `Текст ${documentText.truncated ? 'УСЕЧЕН' : 'ПОЛНЫЙ'} для эксперимента.`,
    '',
    'ТЕКСТ ДОКУМЕНТА:',
    `<<<NPA\n${documentText.text}\nNPA>>>`,
  ].join('\n');
}

function buildDocumentText(item) {
  const chunks = item.sections.map((section, index) => {
    const heading = [
      `[${index + 1}]`,
      section.sectionType,
      section.headingNumber ? `пункт ${section.headingNumber}` : '',
      section.title,
    ].filter(Boolean).join(' · ');
    return `${heading}\n${section.text}`;
  });
  const text = chunks.join('\n\n');
  if (text.length <= MAX_INPUT_CHARS) return { text, truncated: false };
  const head = text.slice(0, Math.floor(MAX_INPUT_CHARS * 0.72));
  const tail = text.slice(-Math.floor(MAX_INPUT_CHARS * 0.18));
  return { text: `${head}\n\n... [середина документа усечена для эксперимента] ...\n\n${tail}`, truncated: true };
}

function normalizeIntelligencePayload(payload, item) {
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const list = (key) => Array.isArray(payload?.[key]) ? payload[key].filter((entry) => entry && typeof entry === 'object') : [];
  const strings = (key) => Array.isArray(payload?.[key]) ? payload[key].map(String).filter(Boolean) : [];
  const summary = object(payload?.summary);
  return {
    summary: {
      short: String(summary.short || `${item.document.title}.`),
      detailed: String(summary.detailed || ''),
      project_relevance: String(summary.project_relevance || ''),
      regulated_scope: String(summary.regulated_scope || ''),
    },
    key_points: list('key_points'),
    procedures: list('procedures'),
    document_types: list('document_types'),
    requirements: list('requirements'),
    applicant_parameters: list('applicant_parameters'),
    dependencies: list('dependencies'),
    checks: list('checks'),
    highlights: list('highlights'),
    quality_notes: strings('quality_notes'),
    meta: {
      model: GEMMA_MODEL,
      prompt_version: PROMPT_VERSION,
      analyzed_full_text: item.rawText.length <= MAX_INPUT_CHARS,
      max_input_chars: MAX_INPUT_CHARS,
    },
  };
}

function inferKind(title) {
  if (/приказ/i.test(title)) return 'order';
  if (/решени/i.test(title)) return 'decision';
  if (/соглашени/i.test(title)) return 'agreement';
  if (/кодекс/i.test(title)) return 'code';
  if (/форма/i.test(title)) return 'form';
  if (/классификатор/i.test(title)) return 'classifier';
  if (/досье/i.test(title)) return 'dossier';
  return 'other';
}

function kindLabel(kind) {
  return {
    order: 'Приказ',
    decision: 'Решение',
    agreement: 'Соглашение',
    code: 'Кодекс',
    form: 'Форма',
    classifier: 'Классификатор',
    dossier: 'Досье',
    other: 'Другое',
  }[kind] || kind;
}

function extractNumber(title) {
  return title.match(/(?:№|N)\s*([A-ZА-ЯЁа-яё0-9ҚРДСМӘІҢҒҮҰқрдсмәсіңғүұ./-]+)/i)?.[1] || '';
}

function extractDate(title) {
  const numeric = title.match(/от\s+(\d{1,2})[.](\d{1,2})[.](\d{4})/i);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  const textDate = title.match(/от\s+(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!textDate) return '';
  const months = { января: '01', февраля: '02', марта: '03', апреля: '04', мая: '05', июня: '06', июля: '07', августа: '08', сентября: '09', октября: '10', ноября: '11', декабря: '12' };
  const month = months[textDate[2].toLowerCase()];
  return month ? `${textDate[3]}-${month}-${textDate[1].padStart(2, '0')}` : '';
}

function isDocumentHeading(text, style) {
  if (style === 'pc' && text.length <= 340 && /^(ТРЕБОВАНИЯ|ПРАВИЛА|ПОРЯДОК|ПЕРЕЧЕНЬ|ОБЩАЯ ХАРАКТЕРИСТИКА)/i.test(text)) return true;
  if (/^[А-ЯЁ\s.,:;№"«»()\-/]+$/.test(text) && text.length <= 280 && /(ТРЕБОВАНИЯ|ПРАВИЛА|ПОРЯДОК|ПЕРЕЧЕНЬ)/.test(text)) return true;
  return false;
}

function normalizeParagraphText(value) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/([^\s])\n([^\s])/g, '$1\n$2')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([№§])\s+/g, '$1 ')
    .trim();
}

function cleanupLegalText(text) {
  return text
    .replace(/\\([().\-[\]])/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function titleFromText(text, fallback) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 3.8);
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractAttr(value, re) {
  return value.match(re)?.[1] || '';
}

function cleanJson(text) {
  let cleaned = String(text || '').trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i) || cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1).trim() : cleaned;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[а-яёқғәіңөұүһ]/g, (char) => ({
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'k', ғ: 'g', ә: 'a', і: 'i', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h',
    }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeGemmaEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (endpoint.endsWith('/v1/chat/completions')) return { baseUrl: endpoint.replace(/\/v1\/chat\/completions$/, ''), chatUrl: endpoint };
  if (endpoint.endsWith('/chat/completions')) return { baseUrl: endpoint.replace(/\/chat\/completions$/, ''), chatUrl: endpoint };
  if (endpoint.endsWith('/v1')) return { baseUrl: endpoint.replace(/\/v1$/, ''), chatUrl: `${endpoint}/chat/completions` };
  return { baseUrl: endpoint, chatUrl: `${endpoint}/v1/chat/completions` };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function loadLocalEnv(envPath) {
  if (!fsSync.existsSync(envPath)) return;
  const text = fsSync.readFileSync(envPath, 'utf-8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\s+)\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}
