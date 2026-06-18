import fsSync from 'node:fs';
import crypto from 'node:crypto';

export function inferSectionTags(title, text) {
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

export function cleanupLegalText(text) {
  return text
    .replace(/\\([().\-[\]])/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function titleFromText(text, fallback) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 110 ? `${clean.slice(0, 107)}...` : clean;
}

export async function mapLimit(items, limit, worker) {
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

export function cleanJson(text) {
  let cleaned = String(text || '').trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i) || cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1).trim();

  return cleaned;
}

export function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^\w\u0400-\u04ff\d]+/g, ' ').trim();
}

export function slugify(value) {
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

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

export function loadLocalEnv(envPath) {
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

export function normalizeGemmaEndpoint(value) {
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
