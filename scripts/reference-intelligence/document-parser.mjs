import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { extractDate, extractNumber, inferKind, kindLabel, slugify } from './utils.mjs';

export function buildDocumentMeta(id, sourcePath) {
  const fileName = path.basename(sourcePath);
  const title = fileName.replace(/\.(docx?|rtf)$/i, '').replace(/^\d+\.\s*/, '').trim();
  const domain = sourcePath.includes(`${path.sep}МИ${path.sep}`) || sourcePath.includes('/МИ/') ? 'MI' : 'LS';
  const kind = inferKind(title);
  const number = extractNumber(title);
  const date = extractDate(title);
  return { id, domain, title, fileName, sourcePath, kind, number, date, tags: Array.from(new Set([domain, kindLabel(kind), number ? `№ ${number}` : '', date || ''].filter(Boolean))) };
}

export function prepareDocxSource(sourcePath, convertDir) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.docx') return sourcePath;
  if (ext !== '.doc') throw new Error(`Unsupported Word extension: ${ext}`);
  const targetPath = path.join(convertDir, `${path.basename(sourcePath, ext)}.docx`);
  if (fsSync.existsSync(targetPath)) return targetPath;
  const result = spawnSync('libreoffice', ['--headless', '--convert-to', 'docx', '--outdir', convertDir, sourcePath], { encoding: 'utf-8' });
  if (result.status !== 0 || !fsSync.existsSync(targetPath)) throw new Error(`LibreOffice conversion failed: ${(result.stderr || result.stdout || '').trim()}`);
  return targetPath;
}

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
    result.push({ index: index + 1, style: extractAttr(pXml, /<w:pStyle[^>]*w:val="([^"]+)"/), text });
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

export function buildSections(document, paragraphs) {
  const sections = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    current.text = cleanupLegalText(current.text);
    if (current.text) sections.push(current);
    current = null;
  };

  for (const paragraph of paragraphs) {
    const classified = classifyParagraph(paragraph.text, paragraph.style);
    if (classified) {
      flush();
      current = { id: `${document.id}-section-${sections.length + 1}`, title: classified.title, level: classified.level, anchor: slugify(`${classified.number || sections.length + 1}-${classified.title}`) || `section-${sections.length + 1}`, sectionType: classified.type, headingNumber: classified.number, text: paragraph.text };
      continue;
    }
    if (!current) current = { id: `${document.id}-section-${sections.length + 1}`, title: 'Вводная часть', level: 1, anchor: `section-${sections.length + 1}`, sectionType: 'preamble', headingNumber: '', text: '' };
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

function isDocumentHeading(text, style) {
  if (style === 'pc' && text.length <= 340 && /^(ТРЕБОВАНИЯ|ПРАВИЛА|ПОРЯДОК|ПЕРЕЧЕНЬ|ОБЩАЯ ХАРАКТЕРИСТИКА)/i.test(text)) return true;
  if (/^[А-ЯЁ\s.,:;№"«»()\-/]+$/.test(text) && text.length <= 280 && /(ТРЕБОВАНИЯ|ПРАВИЛА|ПОРЯДОК|ПЕРЕЧЕНЬ)/.test(text)) return true;
  return false;
}

function normalizeParagraphText(value) { return value.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/([^\s])\n([^\s])/g, '$1\n$2').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/([№§])\s+/g, '$1 ').trim(); }
function cleanupLegalText(text) { return text.replace(/\\([().\-[\]])/g, '$1').replace(/\[(.*?)\]\((.*?)\)/g, '$1').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim(); }
function titleFromText(text, fallback) { const clean = text.replace(/\s+/g, ' ').trim(); return !clean ? fallback : clean.length > 120 ? `${clean.slice(0, 117)}...` : clean; }
function decodeXml(value) { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function extractAttr(value, re) { return value.match(re)?.[1] || ''; }
