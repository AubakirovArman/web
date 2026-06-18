import fsSync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { slugify } from './utils.mjs';

export function buildDocumentMeta(sourcePath, id) {
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

export function resolveSources({ sourceArg, sourceDirsArg, defaultSourceDirs }) {
  if (sourceArg) return [path.resolve(sourceArg)];

  const sourceDirs = sourceDirsArg
    ? sourceDirsArg.split(',').map((value) => path.resolve(value.trim())).filter(Boolean)
    : defaultSourceDirs;

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

export function prepareDocxSource(sourcePath, convertDir) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.docx') return sourcePath;
  if (ext !== '.doc') throw new Error(`Unsupported Word extension: ${ext}`);

  const targetPath = path.join(convertDir, `${path.basename(sourcePath, ext)}.docx`);
  if (fsSync.existsSync(targetPath)) return targetPath;

  const result = spawnSync(
    'libreoffice',
    ['--headless', '--convert-to', 'docx', '--outdir', convertDir, sourcePath],
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
