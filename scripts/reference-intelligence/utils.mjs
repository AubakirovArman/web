import fsSync from 'node:fs';
import crypto from 'node:crypto';

export function loadLocalEnv(envPath) {
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

export function normalizeGemmaEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (endpoint.endsWith('/v1/chat/completions')) return { baseUrl: endpoint.replace(/\/v1\/chat\/completions$/, ''), chatUrl: endpoint };
  if (endpoint.endsWith('/chat/completions')) return { baseUrl: endpoint.replace(/\/chat\/completions$/, ''), chatUrl: endpoint };
  if (endpoint.endsWith('/v1')) return { baseUrl: endpoint.replace(/\/v1$/, ''), chatUrl: `${endpoint}/chat/completions` };
  return { baseUrl: endpoint, chatUrl: `${endpoint}/v1/chat/completions` };
}

export function inferKind(title) {
  if (/приказ/i.test(title)) return 'order';
  if (/решени/i.test(title)) return 'decision';
  if (/соглашени/i.test(title)) return 'agreement';
  if (/кодекс/i.test(title)) return 'code';
  if (/форма/i.test(title)) return 'form';
  if (/классификатор/i.test(title)) return 'classifier';
  if (/досье/i.test(title)) return 'dossier';
  return 'other';
}

export function kindLabel(kind) {
  return { order: 'Приказ', decision: 'Решение', agreement: 'Соглашение', code: 'Кодекс', form: 'Форма', classifier: 'Классификатор', dossier: 'Досье', other: 'Другое' }[kind] || kind;
}

export function extractNumber(title) {
  return title.match(/(?:№|N)\s*([A-ZА-ЯЁа-яё0-9ҚРДСМӘІҢҒҮҰқрдсмәсіңғүұ./-]+)/i)?.[1] || '';
}

export function extractDate(title) {
  const numeric = title.match(/от\s+(\d{1,2})[.](\d{1,2})[.](\d{4})/i);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  const textDate = title.match(/от\s+(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!textDate) return '';
  const months = { января: '01', февраля: '02', марта: '03', апреля: '04', мая: '05', июня: '06', июля: '07', августа: '08', сентября: '09', октября: '10', ноября: '11', декабря: '12' };
  const month = months[textDate[2].toLowerCase()];
  return month ? `${textDate[3]}-${month}-${textDate[1].padStart(2, '0')}` : '';
}

export function cleanJson(text) {
  let cleaned = String(text || '').trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i) || cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1).trim() : cleaned;
}

export function slugify(value) {
  return String(value || '').toLowerCase().replace(/[а-яёқғәіңөұүһ]/g, (char) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'k', ғ: 'g', ә: 'a', і: 'i', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h' }[char] || char)).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function readArg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ''; }
export function estimateTokens(text) { return Math.ceil(String(text || '').length / 3.8); }
export function uniqueStrings(values) { return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))); }
export function uniqueObjects(items, keys) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const key = keys.map((field) => String(item[field] || '').trim().toLowerCase()).filter(Boolean).join('|') || JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
