import fs from 'node:fs/promises';
import JSZip from 'jszip';

export async function parseDocxParagraphs(filePath) {
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
