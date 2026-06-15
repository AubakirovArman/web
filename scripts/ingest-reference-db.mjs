import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';

loadLocalEnv(path.resolve(process.cwd(), '.env'));
loadLocalEnv(path.resolve(process.cwd(), '..', '.env'));

const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';
const DATABASE_URL = process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const INDEX_PATH = path.resolve(process.cwd(), 'data/reference/generated/knowledge-index.json');
const DOCS_DIR = path.resolve(process.cwd(), 'data/reference/generated/documents');
const RUNS_DIR = path.resolve(process.cwd(), '.reference-postgres/gemma-runs');
const GEMMA_ENDPOINT = normalizeGemmaEndpoint(
  process.env.GEMMA_APP_BASE_URL || process.env.GEMMA_BASE_URL || process.env.VLLM_URL || 'http://89.106.235.4:8000',
);
const DEFAULT_GEMMA_BASE_URL = GEMMA_ENDPOINT.baseUrl;
const DEFAULT_GEMMA_CHAT_URL = GEMMA_ENDPOINT.chatUrl;
const DEFAULT_GEMMA_MODEL = process.env.GEMMA_MODEL || process.env.VLLM_MODEL || 'google/gemma-4-31B-it';
const GEMMA_API_KEY = process.env.GEMMA_API_KEY || process.env.VLLM_API_KEY || '';
const GEMMA_TIMEOUT_MS = Number(process.env.GEMMA_TIMEOUT_MS || 90000);
const GEMMA_MAX_TOKENS = Number(process.env.GEMMA_MAX_TOKENS || 1600);
const FORMAT_MODE = process.env.REFERENCE_FORMAT_MODE || 'gemma';
const FORCE = process.argv.includes('--force');
const DOCUMENT_ID = readArg('--document-id');
const MAX_DOCUMENTS = Number(readArg('--max-documents') || 0);
const MAX_GEMMA_SECTIONS = Number(readArg('--max-gemma-sections') || 0);
const GEMMA_CONCURRENCY = Math.max(1, Number(readArg('--gemma-concurrency') || process.env.GEMMA_CONCURRENCY || 4));
const pool = new Pool({ connectionString: DATABASE_URL });

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

try {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await ensureSchema();
  const index = JSON.parse(await fs.readFile(INDEX_PATH, 'utf-8'));
  let documents = index.documents;
  if (DOCUMENT_ID) documents = documents.filter((document) => document.id === DOCUMENT_ID);
  if (MAX_DOCUMENTS > 0) documents = documents.slice(0, MAX_DOCUMENTS);
  if (documents.length === 0) throw new Error(`No documents matched${DOCUMENT_ID ? ` document-id=${DOCUMENT_ID}` : ''}`);

  const gemmaAvailable = FORMAT_MODE === 'gemma' ? await checkGemmaAvailable() : false;
  let count = 0;
  for (const document of documents) {
    const markdown = await fs.readFile(path.join(DOCS_DIR, `${document.id}.md`), 'utf-8');
    const legalSections = buildLegalSections(document, markdown);
    let gemmaAttempts = 0;
    let completedSections = 0;
    let gemmaFormattedSections = 0;
    const sectionJobs = legalSections.map((section) => {
      const shouldUseGemma = gemmaAvailable && (!MAX_GEMMA_SECTIONS || gemmaAttempts < MAX_GEMMA_SECTIONS);
      if (shouldUseGemma) gemmaAttempts += 1;
      return { section, shouldUseGemma };
    });

    const formattedSections = await mapLimit(sectionJobs, GEMMA_CONCURRENCY, async ({ section, shouldUseGemma }) => {
      const formatted = shouldUseGemma
        ? await formatLegalSectionWithGemma(document, section)
        : formatLegalSectionRaw(section, gemmaAvailable ? 'raw' : 'raw_empty_gemma');
      completedSections += 1;
      if (formatted.formatter === 'gemma') gemmaFormattedSections += 1;
      if (legalSections.length >= 50 && (completedSections % 25 === 0 || completedSections === legalSections.length)) {
        console.log(`[sections] ${document.id} ${completedSections}/${legalSections.length} gemma=${gemmaFormattedSections}`);
      }
      return formatted;
    });

    await upsertDocument(document, markdown, formattedSections, gemmaAvailable ? 'gemma' : 'raw');
    count += 1;
    console.log(
      `[${count}/${documents.length}] ${document.id} sections=${formattedSections.length} gemma=${formattedSections.filter((s) => s.formatter === 'gemma').length} mode=${gemmaAvailable ? 'gemma' : 'raw'}`
    );
  }
  console.log(`Ingested ${count} reference documents into ${DATABASE_URL}`);
} finally {
  await pool.end();
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

    CREATE INDEX IF NOT EXISTS reference_documents_search_idx ON reference_documents USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS reference_sections_search_idx ON reference_sections USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS reference_documents_domain_idx ON reference_documents(domain);
    CREATE INDEX IF NOT EXISTS reference_documents_kind_idx ON reference_documents(kind);
    CREATE INDEX IF NOT EXISTS reference_sections_document_idx ON reference_sections(document_id, sort_order);
  `);
}

async function upsertDocument(document, markdown, sections, mode) {
  const rawText = markdown.replace(/[#>*_`|\\]/g, ' ').replace(/\s+/g, ' ').trim();
  const summary = buildDocumentSummary(document, sections);
  const tags = Array.from(new Set([...(document.tags || []), ...sections.flatMap((section) => section.tags || [])]));
  const markdownFromGemma = renderDocumentMarkdown(document, sections);
  const gemmaJson = {
    kb_format: 'gemma_legal_structure_v1',
    model: mode === 'gemma' ? DEFAULT_GEMMA_MODEL : null,
    formatted_by_gemma: sections.filter((section) => section.formatter === 'gemma').length,
    section_count: sections.length,
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
        markdownFromGemma,
        rawText,
        mode,
        mode === 'gemma' ? DEFAULT_GEMMA_MODEL : null,
        JSON.stringify(gemmaJson),
      ]
    );

    await pool.query('DELETE FROM reference_sections WHERE document_id = $1', [document.id]);
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      await pool.query(
        `
          INSERT INTO reference_sections (
            id, document_id, title, level, anchor, text, raw_text, formatted_text, formatter,
            heading_number, full_heading, section_type, raw_char_count, summary, source_quote, tags,
            sort_order, search_vector, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16::jsonb,
            $17,
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
        ]
      );
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

function buildLegalSections(document, markdown) {
  const cleaned = markdown
    .replace(/\\([().-])/g, '$1')
    .replace(/<a id="[^"]+"><\/a>/g, '')
    .replace(/__+/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const paragraphs = cleaned.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const sections = [];
  let current = null;
  let cursor = 0;

  const flush = () => {
    if (!current) return;
    const rawText = current.parts.join('\n\n').trim();
    if (!rawText) return;
    sections.push({
      id: `${document.id}-section-${sections.length + 1}`,
      index: sections.length + 1,
      level: current.level,
      headingNumber: current.headingNumber,
      headingTitle: current.headingTitle,
      fullHeading: current.fullHeading,
      anchor: slugify(current.fullHeading) || `section-${sections.length + 1}`,
      sectionType: current.sectionType,
      rawText,
      startChar: current.startChar,
      endChar: current.startChar + rawText.length,
    });
  };

  for (const paragraph of paragraphs) {
    const heading = detectLegalHeading(paragraph);
    const paragraphStart = cursor;
    cursor += paragraph.length + 2;
    if (heading && (current === null || current.parts.join('\n\n').length > 600 || heading.level <= current.level)) {
      flush();
      current = {
        ...heading,
        parts: [paragraph],
        startChar: paragraphStart,
      };
      continue;
    }
    if (!current) {
      current = {
        level: 1,
        headingNumber: '',
        headingTitle: 'Преамбула',
        fullHeading: document.title,
        sectionType: 'preamble',
        parts: [],
        startChar: paragraphStart,
      };
    }
    current.parts.push(paragraph);
    if (current.parts.join('\n\n').length > 11000) {
      flush();
      current = null;
    }
  }
  flush();

  return sections.length ? sections : [{
    id: `${document.id}-section-1`,
    index: 1,
    level: 1,
    headingNumber: '',
    headingTitle: document.title,
    fullHeading: document.title,
    anchor: slugify(document.title),
    sectionType: 'document',
    rawText: cleaned,
    startChar: 0,
    endChar: cleaned.length,
  }];
}

function detectLegalHeading(paragraph) {
  const text = paragraph.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const candidates = [
    { re: /^(?<num>[IVXLCDM]+)\.\s*(?<title>[А-ЯA-ZЁ].{3,180})$/i, level: 1, type: 'chapter' },
    { re: /^(?<title>Раздел\s+\d+\.?\s*.{0,180})$/i, level: 1, type: 'chapter' },
    { re: /^(?<title>Глава\s+\d+\.?\s*.{0,180})$/i, level: 2, type: 'chapter' },
    { re: /^(?<title>Приложение\s*(?:№|N)?\s*\d*.*)$/i, level: 1, type: 'appendix' },
    { re: /^(?<num>\d+(?:\.\d+){0,4})[.)]\s+(?<title>.{3,220})$/i, level: 3, type: 'point' },
    { re: /^(?<num>\d+(?:\.\d+){1,4})\.?\s*$/i, level: 3, type: 'point' },
  ];
  for (const candidate of candidates) {
    const match = text.match(candidate.re);
    if (!match) continue;
    const number = match.groups?.num || '';
    const title = (match.groups?.title || text).trim();
    return {
      level: candidate.level,
      headingNumber: number,
      headingTitle: title,
      fullHeading: number ? `${number}. ${title}` : title,
      sectionType: candidate.type,
    };
  }
  if (text.length <= 160 && /^[А-ЯЁA-Z][А-ЯЁA-Z0-9\s.,:;№"«»()/-]+$/.test(text) && /ПРАВИЛ|ПОРЯД|ТРЕБОВАН|ФОРМ|ПЕРЕЧЕН|ПОЛОЖЕН/.test(text)) {
    return {
      level: 2,
      headingNumber: '',
      headingTitle: text,
      fullHeading: text,
      sectionType: 'heading',
    };
  }
  return null;
}

async function checkGemmaAvailable() {
  if (FORMAT_MODE !== 'gemma') return false;
  try {
    const response = await fetch(`${DEFAULT_GEMMA_BASE_URL.replace(/\/$/, '')}/v1/models`, {
      headers: GEMMA_API_KEY ? { Authorization: `Bearer ${GEMMA_API_KEY}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function formatLegalSectionWithGemma(document, section) {
  const cacheKey = sha256(`${DEFAULT_GEMMA_MODEL}\n${document.id}\n${section.id}\n${section.rawText}`);
  const cachePath = path.join(RUNS_DIR, `${document.id}-${section.index}-${cacheKey.slice(0, 12)}.json`);
  if (!FORCE) {
    try {
      const cached = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
      return normalizeFormattedSection(section, cached.parsed, cached.status || 'gemma');
    } catch {
      // no cache
    }
  }

  const prompt = buildLegalFormatterPrompt(document, section);
  try {
    const response = await fetch(DEFAULT_GEMMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GEMMA_API_KEY ? { Authorization: `Bearer ${GEMMA_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: DEFAULT_GEMMA_MODEL,
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

function buildLegalFormatterPrompt(document, section) {
  return [
    'Переформатируй фрагмент нормативного правового акта для красивого справочника.',
    '',
    'Жесткие правила:',
    '- Не изменяй юридический смысл.',
    '- Не добавляй внешние знания.',
    '- Сохраняй номера пунктов, подпунктов, абзацев и приложений.',
    '- Делай текст читаемым: заголовки, списки, подпункты, таблицы markdown если они есть.',
    '- Если есть длинный абзац с перечислением, разложи его на пункты без потери текста.',
    '- Верни только JSON.',
    '',
    'Схема JSON:',
    '{"formatted_text":"","summary":"","source_quote":"","tags":[]}',
    '',
    `Документ: ${document.title}`,
    `Домен: ${document.domain}`,
    `Раздел: ${section.fullHeading}`,
    `Тип: ${section.sectionType}`,
    '',
    'Текст фрагмента:',
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
  const safeFormattedText = formattedText && formattedText.length >= Math.min(80, section.rawText.length * 0.4)
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

function cleanupLegalText(text) {
  return text
    .replace(/\\([().-])/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function renderDocumentMarkdown(document, sections) {
  return [
    `# ${document.title}`,
    '',
    ...sections.flatMap((section) => {
      const hashes = '#'.repeat(Math.max(2, Math.min(section.level + 1, 6)));
      return [
        `${hashes} ${section.fullHeading}`,
        '',
        section.formattedText,
        '',
      ];
    }),
  ].join('\n').trim() + '\n';
}

function buildDocumentSummary(document, sections) {
  const first = sections.find((section) => section.summary)?.summary;
  return first || `${document.title}. ${sections.length} структурированных разделов.`;
}

function inferSectionTags(title, text) {
  const corpus = `${title}\n${text}`.toLowerCase();
  const tags = [];
  const rules = [
    ['заявление', /заявлен/],
    ['регистрация', /регистрац/],
    ['перерегистрация', /перерегистрац/],
    ['изменения', /изменен|изменени/],
    ['досье', /досье/],
    ['GMP', /gmp|надлежащей производственной/],
    ['фармаконадзор', /фармаконадзор/],
    ['биоэквивалентность', /биоэквивалент/],
    ['маркировка', /маркиров/],
    ['испытания', /испытан/],
    ['заявитель', /заявител/],
    ['экспертиза', /экспертиз/],
  ];
  for (const [tag, pattern] of rules) {
    if (pattern.test(corpus)) tags.push(tag);
  }
  return tags;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
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
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i) ||
    cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
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
