import { slugify } from './utils.mjs';

export function buildLegalSections(document, markdown) {
  const cleaned = markdown.replace(/\\([().-])/g, '$1').replace(/<a id="[^"]+"><\/a>/g, '').replace(/__+/g, '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const paragraphs = cleaned.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const sections = [];
  let current = null;
  let cursor = 0;

  const flush = () => {
    if (!current) return;
    const rawText = current.parts.join('\n\n').trim();
    if (!rawText) return;
    sections.push({ id: `${document.id}-section-${sections.length + 1}`, index: sections.length + 1, level: current.level, headingNumber: current.headingNumber, headingTitle: current.headingTitle, fullHeading: current.fullHeading, anchor: slugify(current.fullHeading) || `section-${sections.length + 1}`, sectionType: current.sectionType, rawText, startChar: current.startChar, endChar: current.startChar + rawText.length });
  };

  for (const paragraph of paragraphs) {
    const heading = detectLegalHeading(paragraph);
    const paragraphStart = cursor;
    cursor += paragraph.length + 2;
    if (heading && (current === null || current.parts.join('\n\n').length > 600 || heading.level <= current.level)) {
      flush();
      current = { ...heading, parts: [paragraph], startChar: paragraphStart };
      continue;
    }
    if (!current) current = { level: 1, headingNumber: '', headingTitle: 'Преамбула', fullHeading: document.title, sectionType: 'preamble', parts: [], startChar: paragraphStart };
    current.parts.push(paragraph);
    if (current.parts.join('\n\n').length > 11000) {
      flush();
      current = null;
    }
  }
  flush();
  return sections.length ? sections : [{ id: `${document.id}-section-1`, index: 1, level: 1, headingNumber: '', headingTitle: document.title, fullHeading: document.title, anchor: slugify(document.title), sectionType: 'document', rawText: cleaned, startChar: 0, endChar: cleaned.length }];
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
    return { level: candidate.level, headingNumber: number, headingTitle: title, fullHeading: number ? `${number}. ${title}` : title, sectionType: candidate.type };
  }
  if (text.length <= 160 && /^[А-ЯЁA-Z][А-ЯЁA-Z0-9\s.,:;№"«»()/-]+$/.test(text) && /ПРАВИЛ|ПОРЯД|ТРЕБОВАН|ФОРМ|ПЕРЕЧЕН|ПОЛОЖЕН/.test(text)) return { level: 2, headingNumber: '', headingTitle: text, fullHeading: text, sectionType: 'heading' };
  return null;
}
