import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { Pool } from 'pg';

loadLocalEnv(path.resolve(process.cwd(), '.env'));
loadLocalEnv(path.resolve(process.cwd(), '..', '.env'));

const DEFAULT_SOURCE = '/mnt/models/NDDA_AI/8040/ЛС/10. Решение № 88 от 3 ноября 2016 года.docx';
const DEFAULT_SOURCE_DIRS = ['/mnt/models/NDDA_AI/8040/ЛС', '/mnt/models/NDDA_AI/8040/МИ'];
const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';
const SOURCE_ARG = readArg('--source');
const SOURCE_DIRS_ARG = readArg('--source-dirs');
const DOCUMENT_ID = readArg('--document-id');
const DATABASE_URL = process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const GEMMA_ENDPOINT = normalizeGemmaEndpoint(
  process.env.GEMMA_APP_BASE_URL || process.env.GEMMA_BASE_URL || process.env.VLLM_URL || 'http://89.106.235.4:8000',
);
const GEMMA_BASE_URL = GEMMA_ENDPOINT.baseUrl;
const GEMMA_CHAT_URL = GEMMA_ENDPOINT.chatUrl;
const GEMMA_MODEL = process.env.GEMMA_MODEL || process.env.VLLM_MODEL || 'google/gemma-4-31B-it';
const GEMMA_API_KEY = process.env.GEMMA_API_KEY || process.env.VLLM_API_KEY || '';
const GEMMA_TIMEOUT_MS = Number(process.env.GEMMA_TIMEOUT_MS || 90000);
const GEMMA_MAX_TOKENS = Number(process.env.GEMMA_MAX_TOKENS || 1600);
const GEMMA_CONCURRENCY = Math.max(1, Number(readArg('--gemma-concurrency') || process.env.GEMMA_CONCURRENCY || 4));
const MAX_GEMMA_SECTIONS = Number(readArg('--max-gemma-sections') || 0);
const MAX_DOCUMENTS = Number(readArg('--max-documents') || 0);
const NO_GEMMA = process.argv.includes('--no-gemma');
const FORCE = process.argv.includes('--force');
const RUNS_DIR = path.resolve(process.cwd(), '.reference-postgres/gemma-docx-runs');
const CONVERT_DIR = path.resolve(process.cwd(), '.reference-postgres/converted-docx');

const pool = new Pool({ connectionString: DATABASE_URL });

try {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.mkdir(CONVERT_DIR, { recursive: true });
  await ensureSchema();

  const gemmaAvailable = !NO_GEMMA && await checkGemmaAvailable();
  const sources = resolveSources();
  const selectedSources = MAX_DOCUMENTS > 0 ? sources.slice(0, MAX_DOCUMENTS) : sources;
  const errors = [];
  let processed = 0;

  for (const sourcePath of selectedSources) {
    try {
      const document = buildDocumentMeta(sourcePath, DOCUMENT_ID && selectedSources.length === 1 ? DOCUMENT_ID : '');
      const docxPath = prepareDocxSource(sourcePath);
      const paragraphs = await parseDocxParagraphs(docxPath);
      const sections = buildStructuredLegalSections(document, paragraphs);
      const formattedSections = await formatSections(document, sections, gemmaAvailable);

      await upsertDocument(document, formattedSections, gemmaAvailable ? 'gemma' : 'raw');

      processed += 1;
      const gemmaCount = formattedSections.filter((section) => section.formatter === 'gemma').length;
      console.log(
        `[${processed}/${selectedSources.length}] ${document.id} sections=${formattedSections.length} paragraphs=${paragraphs.length} gemma=${gemmaCount} source=${path.basename(sourcePath)}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ sourcePath, message });
      console.error(`[skip] ${path.basename(sourcePath)}: ${message}`);
    }
  }

  console.log(`Structured DOCX ingest complete: processed=${processed} failed=${errors.length}`);
  console.log(`database=${DATABASE_URL}`);
} finally {
  await pool.end();
}

function buildDocumentMeta(sourcePath, id) {
  const fileName = path.basename(sourcePath);
  const fileTitle = fileName.replace(/\.(docx?|rtf)$/i, '').replace(/^\d+\.\s*/, '').trim();
  const domain = sourcePath.includes(`${path.sep}МИ${path.sep}`) || sourcePath.includes('/МИ/') ? 'MI' : 'LS';
  const leadingNumber = path.basename(sourcePath).match(/^(\d+)\./)?.[1] || '';
  const documentId = id || `${domain.toLowerCase()}-${leadingNumber || slugify(fileTitle).slice(0, 48)}`;
  const kind = inferKind(fileTitle);
  const number = extractNumber(fileTitle);
  const date = extractDate(fileTitle);

  return {
    id: documentId,
    domain,
    title: fileTitle,
    fileName,
    sourcePath,
    kind,
    number,
    date,
    tags: Array.from(new Set([domain === 'LS' ? 'ЛС' : 'МИ', kindLabel(kind), number ? `№ ${number}` : '', date || ''].filter(Boolean))),
  };
}

function resolveSources() {
  if (SOURCE_ARG) return [path.resolve(SOURCE_ARG)];

  const sourceDirs = SOURCE_DIRS_ARG
    ? SOURCE_DIRS_ARG.split(',').map((value) => path.resolve(value.trim())).filter(Boolean)
    : DEFAULT_SOURCE_DIRS;

  return sourceDirs.flatMap((dir) => findWordFiles(dir)).sort((left, right) => left.localeCompare(right, 'ru'));
}

function findWordFiles(dir) {
  if (!fsSync.existsSync(dir)) return [];

  const entries = fsSync.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findWordFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('~$')) continue;
    if (!/\.(docx|doc)$/i.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files;
}

function prepareDocxSource(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.docx') return sourcePath;
  if (ext !== '.doc') throw new Error(`Unsupported Word extension: ${ext}`);

  const targetPath = path.join(CONVERT_DIR, `${path.basename(sourcePath, ext)}.docx`);
  if (fsSync.existsSync(targetPath)) return targetPath;

  const result = spawnSync(
    'libreoffice',
    ['--headless', '--convert-to', 'docx', '--outdir', CONVERT_DIR, sourcePath],
    { encoding: 'utf-8' },
  );
  if (result.status !== 0 || !fsSync.existsSync(targetPath)) {
    throw new Error(`LibreOffice conversion failed: ${(result.stderr || result.stdout || '').trim()}`);
  }

  return targetPath;
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
  const labels = {
    order: 'Приказ',
    decision: 'Решение',
    agreement: 'Соглашение',
    code: 'Кодекс',
    form: 'Форма',
    classifier: 'Классификатор',
    dossier: 'Досье',
    other: 'Другое',
  };
  return labels[kind] || kind;
}

function extractNumber(title) {
  return title.match(/(?:№|N)\s*([A-ZА-ЯЁа-яё0-9ҚРДСМӘІҢҒҮҰқрдсмәсіңғүұ./-]+)/i)?.[1] || '';
}

function extractDate(title) {
  const numeric = title.match(/от\s+(\d{1,2})[.](\d{1,2})[.](\d{4})/i);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;

  const textDate = title.match(/от\s+(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!textDate) return '';

  const months = {
    января: '01',
    февраля: '02',
    марта: '03',
    апреля: '04',
    мая: '05',
    июня: '06',
    июля: '07',
    августа: '08',
    сентября: '09',
    октября: '10',
    ноября: '11',
    декабря: '12',
  };
  const month = months[textDate[2].toLowerCase()];
  return month ? `${textDate[3]}-${month}-${textDate[1].padStart(2, '0')}` : '';
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
      numId: extractAttr(pXml, /<w:numId[^>]*w:val="([^"]+)"/),
      ilvl: extractAttr(pXml, /<w:ilvl[^>]*w:val="([^"]+)"/),
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

function buildStructuredLegalSections(document, paragraphs) {
  const sections = [];
  const context = {
    chapter: null,
    appendix: null,
    point: null,
    subpoint: null,
    listIntro: null,
  };

  for (const paragraph of paragraphs) {
    const classified = classifyParagraph(paragraph, context);
    if (!classified) continue;

    const mergeTarget = findMergeTarget(sections, classified, context);
    if (mergeTarget) {
      appendParagraphToSection(mergeTarget, paragraph, classified);
      continue;
    }

    const section = makeSection(document, sections.length + 1, paragraph, classified, context);
    sections.push(section);
    updateContext(context, section);
  }

  return sections;
}

function findMergeTarget(sections, classified, context) {
  const last = sections.at(-1);
  if (!last) return null;

  if (classified.sectionType === 'paragraph') {
    return context.subpoint || context.point || last;
  }

  if (classified.sectionType === 'preamble') {
    return last.sectionType === 'preamble' ? last : null;
  }

  if (classified.sectionType === 'approval') {
    return last.sectionType === 'approval' ? last : null;
  }

  if (classified.sectionType === 'amendment_note') {
    return context.subpoint || context.point || last;
  }

  return null;
}

function appendParagraphToSection(section, paragraph, classified) {
  const prefix = classified.sectionType === 'amendment_note' ? 'Примечание об изменениях: ' : '';
  const addition = `${prefix}${paragraph.text}`.trim();
  section.rawText = [section.rawText, addition].filter(Boolean).join('\n\n');
  section.formattedText = section.rawText;
  section.summary = section.rawText.slice(0, 520);
  section.sourceQuote = section.rawText.slice(0, 320);
  section.sourceLocator = [section.sourceLocator, `word/document.xml:p[${paragraph.index}]`].filter(Boolean).join(',');
  section.tags = Array.from(new Set([...(section.tags || []), ...inferSectionTags(classified.fullHeading, addition)]));
}

function classifyParagraph(paragraph, context) {
  const text = paragraph.text.trim();
  if (!text) return null;

  const appendix = text.match(/^Приложение\s*(?:№|N)?\s*(?<num>\d+)?\s*(?<tail>.*)$/i);
  if (appendix) {
    return {
      level: 1,
      sectionType: 'appendix',
      headingNumber: appendix.groups?.num ? `Приложение №${appendix.groups.num}` : 'Приложение',
      headingTitle: text,
      fullHeading: text,
      pathNumber: appendix.groups?.num ? `app-${appendix.groups.num}` : 'appendix',
    };
  }

  const roman = text.match(/^(?<num>[IVXLCDM]+)\.\s*(?<title>[\s\S]+)$/i);
  if (roman && text.length <= 260) {
    return {
      level: 1,
      sectionType: 'chapter',
      headingNumber: roman.groups.num,
      headingTitle: roman.groups.title.trim(),
      fullHeading: `${roman.groups.num}. ${roman.groups.title.trim()}`,
      pathNumber: roman.groups.num,
    };
  }

  if (isDocumentHeading(text, paragraph.style)) {
    return {
      level: 1,
      sectionType: 'heading',
      headingNumber: '',
      headingTitle: text,
      fullHeading: text,
      pathNumber: slugify(text),
    };
  }

  if (paragraph.style === 'pji' || /^В\s+.+внесены изменения/i.test(text)) {
    const parentNumber = context.point?.headingNumber || context.chapter?.headingNumber || '';
    return {
      level: context.point ? 3 : 2,
      sectionType: 'amendment_note',
      headingNumber: parentNumber ? `${parentNumber}.note` : 'note',
      headingTitle: 'Примечание об изменениях',
      fullHeading: parentNumber ? `Примечание к пункту ${parentNumber}` : 'Примечание об изменениях',
      pathNumber: parentNumber ? `${parentNumber}.note.${paragraph.index}` : `note.${paragraph.index}`,
    };
  }

  const letterSubpoint = text.match(/^(?:(?<artifact>\d+)\.\s*)?(?<letter>[а-яё])\)\s*(?<title>.+)$/i);
  if (letterSubpoint) {
    const parent = context.point?.headingNumber || context.chapter?.headingNumber || '';
    const letter = letterSubpoint.groups.letter.toLowerCase();
    const headingNumber = parent ? `${parent}.${letter})` : `${letter})`;
    return {
      level: 3,
      sectionType: 'subpoint',
      headingNumber,
      headingTitle: `${letter}) ${letterSubpoint.groups.title.trim()}`,
      fullHeading: parent ? `Подпункт ${letter}) пункта ${parent}` : `Подпункт ${letter})`,
      pathNumber: headingNumber,
    };
  }

  const nestedNumber = text.match(/^(?<num>\d+(?:\.\d+){1,4})\.\s*(?<title>.+)$/);
  if (nestedNumber) {
    return {
      level: 3,
      sectionType: 'subpoint',
      headingNumber: nestedNumber.groups.num,
      headingTitle: nestedNumber.groups.title.trim(),
      fullHeading: `${nestedNumber.groups.num}. ${nestedNumber.groups.title.trim()}`,
      pathNumber: nestedNumber.groups.num,
    };
  }

  const mainPoint = text.match(/^(?<num>\d{1,3})\.\s+(?<title>.+)$/);
  if (mainPoint) {
    return {
      level: 2,
      sectionType: 'point',
      headingNumber: mainPoint.groups.num,
      headingTitle: mainPoint.groups.title.trim(),
      fullHeading: `Пункт ${mainPoint.groups.num}`,
      pathNumber: mainPoint.groups.num,
    };
  }

  if (isListItem(text, context)) {
    const parent = context.subpoint?.headingNumber || context.point?.headingNumber || context.chapter?.headingNumber || '';
    const order = nextListOrder(context, parent);
    return {
      level: context.subpoint ? 4 : 3,
      sectionType: 'list_item',
      headingNumber: parent ? `${parent}.${order}` : `list.${order}`,
      headingTitle: titleFromText(text, 'Элемент перечня'),
      fullHeading: parent ? `Элемент перечня к ${parent}` : 'Элемент перечня',
      pathNumber: parent ? `${parent}.${order}` : `list.${order}`,
    };
  }

  if (/^УТВЕРЖДЕН[АЫО]?$/i.test(text) || paragraph.style === 'pr') {
    return {
      level: 1,
      sectionType: 'approval',
      headingNumber: '',
      headingTitle: text,
      fullHeading: 'Гриф утверждения',
      pathNumber: `approval.${paragraph.index}`,
    };
  }

  const parent = context.subpoint?.headingNumber || context.point?.headingNumber || context.chapter?.headingNumber || '';
  return {
    level: parent ? 3 : 1,
    sectionType: parent ? 'paragraph' : 'preamble',
    headingNumber: parent ? `${parent}.p${paragraph.index}` : `p${paragraph.index}`,
    headingTitle: parent ? titleFromText(text, `Абзац к ${parent}`) : titleFromText(text, 'Преамбула'),
    fullHeading: parent ? `Абзац к ${parent}` : 'Преамбула',
    pathNumber: parent ? `${parent}.p${paragraph.index}` : `preamble.${paragraph.index}`,
  };
}

function isDocumentHeading(text, style) {
  if (style === 'pc' && text.length <= 320 && /^(ТРЕБОВАНИЯ|ПРАВИЛА|ПОРЯДОК|ПЕРЕЧЕНЬ|ОБЩАЯ ХАРАКТЕРИСТИКА)/i.test(text)) return true;
  if (/^[А-ЯЁ\s.,:;№"«»()\-/]+$/.test(text) && text.length <= 260 && /(ТРЕБОВАНИЯ|ПРАВИЛА|ПОРЯДОК|ПЕРЕЧЕНЬ)/.test(text)) return true;
  return false;
}

function isListItem(text, context) {
  if (!context.point && !context.subpoint) return false;
  if (/^[—-]\s+/.test(text)) return true;
  if (/;$/.test(text)) return true;
  if (/^(или|и|а также|при этом|за исключением)\b/i.test(text)) return true;
  if (context.listIntro && text.length <= 700) return true;
  return false;
}

function nextListOrder(context, parent) {
  if (!context.__listCounters) context.__listCounters = new Map();
  const key = parent || 'root';
  const next = (context.__listCounters.get(key) || 0) + 1;
  context.__listCounters.set(key, next);
  return next;
}

function makeSection(document, index, paragraph, classified, context) {
  const rawText = paragraph.text;
  const parentId = classified.sectionType === 'chapter' || classified.sectionType === 'heading' || classified.sectionType === 'appendix'
    ? null
    : context.subpoint?.id || context.point?.id || context.chapter?.id || context.appendix?.id || null;
  const pathNumber = classified.pathNumber || classified.headingNumber || String(index);

  return {
    id: `${document.id}-docx-${index}`,
    index,
    parentId,
    numberingPath: pathNumber,
    sourceLocator: `word/document.xml:p[${paragraph.index}]`,
    level: classified.level,
    headingNumber: classified.headingNumber,
    headingTitle: classified.headingTitle,
    fullHeading: classified.fullHeading,
    anchor: slugify(`${pathNumber}-${classified.headingTitle}`) || `section-${index}`,
    sectionType: classified.sectionType,
    rawText,
    formattedText: rawText,
    formatter: 'raw',
    summary: rawText.slice(0, 520),
    sourceQuote: rawText.slice(0, 320),
    tags: inferSectionTags(classified.fullHeading, rawText),
  };
}

function updateContext(context, section) {
  if (section.sectionType === 'chapter' || section.sectionType === 'heading') {
    context.chapter = section;
    context.point = null;
    context.subpoint = null;
    context.listIntro = null;
    return;
  }
  if (section.sectionType === 'appendix') {
    context.appendix = section;
    context.chapter = section;
    context.point = null;
    context.subpoint = null;
    context.listIntro = null;
    return;
  }
  if (section.sectionType === 'point') {
    context.point = section;
    context.subpoint = null;
    context.listIntro = /:\s*$/.test(section.rawText) || /включает|представляет|содержит|устанавливаются|должен представить/i.test(section.rawText);
    return;
  }
  if (section.sectionType === 'subpoint') {
    context.subpoint = section;
    context.listIntro = /:\s*$/.test(section.rawText) || /включает|представляет|содержит|устанавливаются|должен представить/i.test(section.rawText);
    return;
  }
  if (section.sectionType !== 'list_item') context.listIntro = /:\s*$/.test(section.rawText);
}

async function formatSections(document, sections, gemmaAvailable) {
  let attempts = 0;
  let completed = 0;
  let gemma = 0;
  const jobs = sections.map((section) => {
    const shouldUseGemma = gemmaAvailable && isGemmaUseful(section) && (!MAX_GEMMA_SECTIONS || attempts < MAX_GEMMA_SECTIONS);
    if (shouldUseGemma) attempts += 1;
    return { section, shouldUseGemma };
  });

  return mapLimit(jobs, GEMMA_CONCURRENCY, async ({ section, shouldUseGemma }) => {
    const formatted = shouldUseGemma
      ? await formatLegalSectionWithGemma(document, section)
      : formatLegalSectionRaw(section, gemmaAvailable ? 'raw' : 'raw_empty_gemma');
    completed += 1;
    if (formatted.formatter === 'gemma') gemma += 1;
    if (!NO_GEMMA && (completed % 25 === 0 || completed === sections.length)) {
      console.log(`[docx-sections] ${document.id} ${completed}/${sections.length} gemma=${gemma}`);
    }
    return formatted;
  });
}

function isGemmaUseful(section) {
  if (section.rawText.length < 60) return false;
  if (['heading', 'chapter', 'appendix', 'approval'].includes(section.sectionType)) return false;
  return true;
}

async function checkGemmaAvailable() {
  try {
    const response = await fetch(`${GEMMA_BASE_URL}/v1/models`, {
      headers: GEMMA_API_KEY ? { Authorization: `Bearer ${GEMMA_API_KEY}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function formatLegalSectionWithGemma(document, section) {
  const cacheKey = sha256(`${GEMMA_MODEL}\n${document.id}\n${section.id}\n${section.rawText}`);
  const cachePath = path.join(RUNS_DIR, `${document.id}-${section.index}-${cacheKey.slice(0, 12)}.json`);

  if (!FORCE) {
    try {
      const cached = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
      return normalizeFormattedSection(section, cached.parsed, cached.status || 'gemma');
    } catch {
      // no cache
    }
  }

  const prompt = buildGemmaPrompt(document, section);
  try {
    const response = await fetch(GEMMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GEMMA_API_KEY ? { Authorization: `Bearer ${GEMMA_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        messages: [
          { role: 'system', content: 'Ты юридический редактор НПА. Отвечай только валидным JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.05,
        max_tokens: GEMMA_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(GEMMA_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Gemma HTTP ${response.status}: ${await response.text()}`);

    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(cleanJson(raw));
    await fs.writeFile(cachePath, JSON.stringify({ status: 'gemma', raw, parsed }, null, 2), 'utf-8');
    return normalizeFormattedSection(section, parsed, 'gemma');
  } catch (error) {
    const fallback = formatLegalSectionRaw(section, 'gemma_error');
    fallback.summary = error instanceof Error ? error.message : 'Gemma formatting failed';
    return fallback;
  }
}

function buildGemmaPrompt(document, section) {
  return [
    'Переформатируй пункт нормативного документа для справочника.',
    '',
    'Правила:',
    '- Не меняй юридический смысл.',
    '- Не добавляй факты от себя.',
    '- Сохрани номера пунктов, подпунктов, приложений и ссылок.',
    '- Убери технический мусор, если он есть.',
    '- Если внутри текста есть перечисления, оформи их markdown-списком.',
    '- Не называй текст фрагментом.',
    '- Верни только JSON.',
    '',
    'JSON-схема:',
    '{"formatted_text":"","summary":"","source_quote":"","tags":[]}',
    '',
    `Документ: ${document.title}`,
    `Структура: ${section.fullHeading}`,
    `Тип узла: ${section.sectionType}`,
    `Номер/путь: ${section.numberingPath}`,
    '',
    'Текст:',
    section.rawText,
  ].join('\n');
}

function formatLegalSectionRaw(section, formatter) {
  const formattedText = cleanupLegalText(section.rawText);
  return {
    ...section,
    formattedText,
    formatter,
    summary: formattedText.slice(0, 520),
    sourceQuote: formattedText.slice(0, 320),
    tags: inferSectionTags(section.fullHeading, formattedText),
  };
}

function normalizeFormattedSection(section, parsed, formatter) {
  const formattedText = String(parsed?.formatted_text || '').trim();
  const safeFormattedText = formattedText && formattedText.length >= Math.min(50, section.rawText.length * 0.35)
    ? formattedText
    : cleanupLegalText(section.rawText);
  const safeFormatter = safeFormattedText === formattedText ? formatter : 'raw_safety_short_gemma';

  return {
    ...section,
    formattedText: safeFormattedText,
    formatter: safeFormatter,
    summary: String(parsed?.summary || safeFormattedText.slice(0, 520)).trim(),
    sourceQuote: String(parsed?.source_quote || safeFormattedText.slice(0, 320)).trim(),
    tags: Array.isArray(parsed?.tags) ? parsed.tags.map(String) : inferSectionTags(section.fullHeading, safeFormattedText),
  };
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reference_documents (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      source_path TEXT,
      kind TEXT NOT NULL,
      number TEXT,
      document_date TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      summary TEXT,
      markdown TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      gemma_status TEXT NOT NULL,
      gemma_model TEXT,
      gemma_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      search_vector TSVECTOR,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reference_sections (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES reference_documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      level INTEGER NOT NULL,
      anchor TEXT NOT NULL,
      text TEXT NOT NULL,
      raw_text TEXT,
      formatted_text TEXT,
      formatter TEXT,
      heading_number TEXT,
      full_heading TEXT,
      section_type TEXT,
      raw_char_count INTEGER,
      summary TEXT,
      source_quote TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      sort_order INTEGER NOT NULL,
      search_vector TSVECTOR,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS raw_text TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS formatted_text TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS formatter TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS heading_number TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS full_heading TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS section_type TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS raw_char_count INTEGER;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS parent_section_id TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS numbering_path TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS source_locator TEXT;

    CREATE INDEX IF NOT EXISTS reference_documents_search_idx ON reference_documents USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS reference_sections_search_idx ON reference_sections USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS reference_documents_domain_idx ON reference_documents(domain);
    CREATE INDEX IF NOT EXISTS reference_documents_kind_idx ON reference_documents(kind);
    CREATE INDEX IF NOT EXISTS reference_sections_document_idx ON reference_sections(document_id, sort_order);
  `);
}

async function upsertDocument(document, sections, mode) {
  const markdown = renderDocumentMarkdown(document, sections);
  const rawText = sections.map((section) => section.rawText).join('\n\n');
  const summary = buildDocumentSummary(document, sections);
  const tags = Array.from(new Set([...(document.tags || []), ...sections.flatMap((section) => section.tags || [])]));
  const gemmaJson = {
    kb_format: 'docx_legal_tree_v1',
    parser: 'word_document_xml',
    model: mode === 'gemma' ? GEMMA_MODEL : null,
    formatted_by_gemma: sections.filter((section) => section.formatter === 'gemma').length,
    section_count: sections.length,
    source_path: document.sourcePath,
  };

  await pool.query('BEGIN');
  try {
    await pool.query(
      `
        INSERT INTO reference_documents (
          id, domain, title, file_name, source_path, kind, number, document_date, tags, summary,
          markdown, raw_text, gemma_status, gemma_model, gemma_json, search_vector, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10,
          $11, $12, $13, $14, $15::jsonb,
          to_tsvector('russian', coalesce($3,'') || ' ' || coalesce($10,'') || ' ' || coalesce($12,'')),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          domain = EXCLUDED.domain,
          title = EXCLUDED.title,
          file_name = EXCLUDED.file_name,
          source_path = EXCLUDED.source_path,
          kind = EXCLUDED.kind,
          number = EXCLUDED.number,
          document_date = EXCLUDED.document_date,
          tags = EXCLUDED.tags,
          summary = EXCLUDED.summary,
          markdown = EXCLUDED.markdown,
          raw_text = EXCLUDED.raw_text,
          gemma_status = EXCLUDED.gemma_status,
          gemma_model = EXCLUDED.gemma_model,
          gemma_json = EXCLUDED.gemma_json,
          search_vector = EXCLUDED.search_vector,
          updated_at = now()
      `,
      [
        document.id,
        document.domain,
        document.title,
        document.fileName,
        document.sourcePath,
        document.kind,
        document.number || null,
        document.date || null,
        JSON.stringify(tags),
        summary,
        markdown,
        rawText,
        mode,
        mode === 'gemma' ? GEMMA_MODEL : null,
        JSON.stringify(gemmaJson),
      ],
    );

    await pool.query('DELETE FROM reference_sections WHERE document_id = $1', [document.id]);

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      await pool.query(
        `
          INSERT INTO reference_sections (
            id, document_id, title, level, anchor, text, raw_text, formatted_text, formatter,
            heading_number, full_heading, section_type, raw_char_count, summary, source_quote, tags,
            sort_order, parent_section_id, numbering_path, source_locator, search_vector, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16::jsonb,
            $17, $18, $19, $20,
            to_tsvector('russian', coalesce($3,'') || ' ' || coalesce($6,'') || ' ' || coalesce($14,'')),
            now()
          )
        `,
        [
          section.id,
          document.id,
          section.headingTitle,
          section.level,
          section.anchor,
          section.formattedText,
          section.rawText,
          section.formattedText,
          section.formatter,
          section.headingNumber,
          section.fullHeading,
          section.sectionType,
          section.rawText.length,
          section.summary,
          section.sourceQuote,
          JSON.stringify(section.tags || []),
          index + 1,
          section.parentId,
          section.numberingPath,
          section.sourceLocator,
        ],
      );
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

function renderDocumentMarkdown(document, sections) {
  return [
    `# ${document.title}`,
    '',
    ...sections.flatMap((section) => {
      const hashes = '#'.repeat(Math.max(2, Math.min(section.level + 1, 6)));
      const number = section.headingNumber && !String(section.headingTitle).startsWith(section.headingNumber)
        ? `${section.headingNumber} `
        : '';
      return [
        `${hashes} ${number}${section.headingTitle}`.trim(),
        '',
        section.formattedText,
        '',
      ];
    }),
  ].join('\n').trim() + '\n';
}

function buildDocumentSummary(document, sections) {
  const firstPoint = sections.find((section) => section.sectionType === 'point')?.summary;
  return firstPoint || `${document.title}. Структурировано ${sections.length} пунктов, подпунктов и абзацев из DOCX.`;
}

function inferSectionTags(title, text) {
  const corpus = `${title}\n${text}`.toLowerCase();
  const tags = [];
  const rules = [
    ['ОХЛП', /охлп|общая характеристика/],
    ['ЛВ', /листок-вкладыш|листок вкладыш|лв/],
    ['инструкция', /инструкц/],
    ['регистрационное досье', /регистрационн.+досье|досье/],
    ['изменения', /изменен|изменени/],
    ['экспертиза', /экспертиз/],
    ['ЕАЭС', /евразийск|еаэс/],
    ['приложение', /приложен/],
    ['пользовательское тестирование', /пользовательск.+тест/],
    ['маркировка', /маркиров/],
  ];
  for (const [tag, pattern] of rules) {
    if (pattern.test(corpus)) tags.push(tag);
  }
  return tags;
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
  return clean.length > 110 ? `${clean.slice(0, 107)}...` : clean;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function cleanJson(text) {
  let cleaned = String(text || '').trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i) || cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1).trim();

  return cleaned;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^\w\u0400-\u04ff\d]+/g, ' ').trim();
}

function slugify(value) {
  return normalize(value)
    .replace(/[а-яёқғәіңөұүһ]/g, (char) => ({
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
      к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
      х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
      қ: 'k', ғ: 'g', ә: 'a', і: 'i', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h',
    }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function normalizeGemmaEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (!endpoint) {
    return {
      baseUrl: 'http://89.106.235.4:8000',
      chatUrl: 'http://89.106.235.4:8000/v1/chat/completions',
    };
  }

  if (endpoint.endsWith('/v1/chat/completions')) {
    return {
      baseUrl: endpoint.replace(/\/v1\/chat\/completions$/, ''),
      chatUrl: endpoint,
    };
  }

  return {
    baseUrl: endpoint,
    chatUrl: `${endpoint}/v1/chat/completions`,
  };
}
