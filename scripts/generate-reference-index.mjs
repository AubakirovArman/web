import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const SOURCE_ROOT = process.env.REFERENCE_SOURCE_ROOT || path.resolve(process.cwd(), '..');
const OUTPUT_ROOT = path.resolve(process.cwd(), 'data/reference/generated');
const OUTPUT_DOCS = path.join(OUTPUT_ROOT, 'documents');

const domains = [
  { code: 'LS', dir: 'ЛС', idPrefix: 'ls' },
  { code: 'MI', dir: 'МИ', idPrefix: 'mi' },
];

await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DOCS, { recursive: true });

const documents = [];
const searchItems = [];

for (const domain of domains) {
  const sourceDir = path.join(SOURCE_ROOT, domain.dir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isSupportedSourceFile)
    .sort(sortByLeadingNumber);

  for (const fileName of files) {
    const sourcePath = path.join(sourceDir, fileName);
    const id = buildDocumentId(domain.idPrefix, fileName);
    const title = cleanTitle(fileName);
    const markdown = await extractMarkdown(sourcePath, fileName, title);
    const markdownPath = `data/reference/generated/documents/${id}.md`;
    const sections = buildSections(markdown, id);
    const document = {
      id,
      domain: domain.code,
      title,
      fileName,
      sourcePath,
      kind: inferKind(title),
      number: inferNumber(title),
      date: inferDate(title),
      tags: inferTags(domain.code, title, markdown),
      markdownPath,
      sections,
    };

    documents.push(document);
    for (const section of sections) {
      searchItems.push({
        documentId: id,
        domain: domain.code,
        title,
        sectionId: section.id,
        sectionTitle: section.title,
        text: section.text.slice(0, 1200),
        tags: document.tags,
        anchor: section.anchor,
      });
    }

    await fs.writeFile(path.join(OUTPUT_DOCS, `${id}.md`), markdown, 'utf-8');
  }
}

const index = {
  generatedAt: new Date().toISOString(),
  sourceRoot: SOURCE_ROOT,
  documents,
  searchItems,
};

await fs.writeFile(path.join(OUTPUT_ROOT, 'knowledge-index.json'), JSON.stringify(index, null, 2), 'utf-8');

console.log(`Generated ${documents.length} reference documents and ${searchItems.length} search items.`);

function isSupportedSourceFile(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.startsWith('~') || lower.endsWith('.tmp')) return false;
  return lower.endsWith('.docx') || lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.md');
}

function sortByLeadingNumber(a, b) {
  const aNum = Number(a.match(/^(\d+)/)?.[1] || Number.MAX_SAFE_INTEGER);
  const bNum = Number(b.match(/^(\d+)/)?.[1] || Number.MAX_SAFE_INTEGER);
  if (aNum !== bNum) return aNum - bNum;
  return a.localeCompare(b, 'ru');
}

function buildDocumentId(prefix, fileName) {
  const stem = path.basename(fileName, path.extname(fileName));
  const leadingNumber = stem.match(/^(\d+)/)?.[1];
  if (leadingNumber) return `${prefix}-${leadingNumber}`;
  return `${prefix}-${slugify(stem).slice(0, 72)}`;
}

function cleanTitle(fileName) {
  return path.basename(fileName, path.extname(fileName)).replace(/\s+/g, ' ').trim();
}

async function extractMarkdown(sourcePath, fileName, title) {
  const lower = fileName.toLowerCase();
  try {
    if (lower.endsWith('.docx')) {
      const result = await mammoth.convertToMarkdown({ path: sourcePath });
      return normalizeMarkdown(`# ${title}\n\n${result.value || ''}`);
    }
    if (lower.endsWith('.pdf')) {
      const buffer = await fs.readFile(sourcePath);
      const result = await pdfParse(buffer);
      return normalizeMarkdown(`# ${title}\n\n${result.text || ''}`);
    }
    const text = await fs.readFile(sourcePath, 'utf-8');
    return normalizeMarkdown(`# ${title}\n\n${text}`);
  } catch (error) {
    return normalizeMarkdown(`# ${title}\n\n> Не удалось извлечь текст: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
    .concat('\n');
}

function buildSections(markdown, documentId) {
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const text = current.lines.join('\n').trim();
    if (!text) return;
    sections.push({
      id: `${documentId}-section-${sections.length + 1}`,
      title: current.title,
      level: current.level,
      anchor: slugify(current.title) || `section-${sections.length + 1}`,
      text,
    });
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const legalHeading = !heading && line.length <= 180 && /^(Приложение|Глава|Раздел|Статья)\b/i.test(line.trim());
    if (heading || legalHeading) {
      flush();
      current = {
        title: heading ? heading[2].trim() : line.trim(),
        level: heading ? heading[1].length : 2,
        lines: [line],
      };
      continue;
    }
    if (!current) {
      current = { title: 'Начало документа', level: 1, lines: [] };
    }
    current.lines.push(line);
  }
  flush();

  if (sections.length <= 1 && markdown.length > 1800) {
    return chunkMarkdown(markdown, documentId);
  }

  return sections.length ? sections : chunkMarkdown(markdown, documentId);
}

function chunkMarkdown(markdown, documentId) {
  const paragraphs = markdown.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = [];
  let buffer = [];
  let size = 0;

  for (const paragraph of paragraphs) {
    if (size + paragraph.length > 1800 && buffer.length) {
      chunks.push(buffer.join('\n\n'));
      buffer = [];
      size = 0;
    }
    buffer.push(paragraph);
    size += paragraph.length;
  }
  if (buffer.length) chunks.push(buffer.join('\n\n'));

  return chunks.map((text, index) => ({
    id: `${documentId}-section-${index + 1}`,
    title: index === 0 ? 'Начало документа' : `Фрагмент ${index + 1}`,
    level: 2,
    anchor: `fragment-${index + 1}`,
    text,
  }));
}

function inferKind(title) {
  const lower = title.toLowerCase();
  if (lower.includes('соглашение')) return 'agreement';
  if (lower.includes('кодекс')) return 'code';
  if (lower.includes('решение')) return 'decision';
  if (lower.includes('приказ')) return 'order';
  if (lower.includes('досье')) return 'dossier';
  if (lower.includes('форма') || lower.includes('заявлен')) return 'form';
  if (lower.includes('классификатор')) return 'classifier';
  return 'other';
}

function inferNumber(title) {
  return title.match(/(?:№|N)\s*([A-Za-zА-Яа-яЁё0-9\-\/]+)/)?.[1];
}

function inferDate(title) {
  return title.match(/(\d{1,2}[.\s]\d{1,2}[.\s]\d{2,4}|\d{1,2}\s+[а-яА-ЯёЁ]+\s+\d{4})/)?.[1];
}

function inferTags(domain, title, markdown) {
  const corpus = `${title}\n${markdown.slice(0, 6000)}`.toLowerCase();
  const tags = new Set([domain === 'LS' ? 'ЛС' : 'МИ']);
  const tagRules = [
    ['регистрация', /регистрац/],
    ['перерегистрация', /перерегистрац/],
    ['изменения', /изменен|изменени/],
    ['заявление', /заявлен/],
    ['экспертиза', /экспертиз/],
    ['досье', /досье/],
    ['GMP', /gmp|надлежащей производственной/],
    ['фармаконадзор', /фармаконадзор/],
    ['биоэквивалентность', /биоэквивалент/],
    ['маркировка', /маркиров/],
    ['ОХЛП', /охлп|общая характеристика/],
    ['инструкция', /инструкц/],
    ['испытания', /испытан/],
  ];
  for (const [tag, pattern] of tagRules) {
    if (pattern.test(corpus)) tags.add(tag);
  }
  return Array.from(tags);
}

function slugify(value) {
  const translit = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    қ: 'k', ғ: 'g', ә: 'a', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', і: 'i', һ: 'h',
  };
  return value
    .toLowerCase()
    .split('')
    .map((char) => translit[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
