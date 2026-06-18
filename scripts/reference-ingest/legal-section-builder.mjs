import { inferSectionTags, slugify, titleFromText } from './utils.mjs';

export function buildStructuredLegalSections(document, paragraphs) {
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
