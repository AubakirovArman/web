import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { cleanJson, sha256, uniqueObjects, uniqueStrings } from './utils.mjs';

export async function analyzeDocument(item, config) {
  const cacheKey = sha256(`${config.promptVersion}\n${config.model}\n${item.document.id}\n${item.rawText}`);
  const cachePath = path.join(config.cacheDir, `${item.document.id}-${cacheKey.slice(0, 12)}.json`);
  if (!config.force && fsSync.existsSync(cachePath)) return JSON.parse(await fs.readFile(cachePath, 'utf-8'));

  const chunks = buildDocumentTextChunks(item, config.maxInputChars);
  const chunkPayloads = [];
  for (const [index, chunk] of chunks.entries()) {
    console.log(`[gemma] ${item.document.id} chunk=${index + 1}/${chunks.length} chars=${chunk.text.length}`);
    chunkPayloads.push(await analyzeDocumentChunk(item, chunk, index + 1, chunks.length, config));
  }
  const parsed = mergeIntelligencePayloads(chunkPayloads, item, chunks.length, config);
  await fs.writeFile(cachePath, JSON.stringify(parsed, null, 2), 'utf-8');
  return parsed;
}

async function analyzeDocumentChunk(item, chunk, chunkNumber, chunksTotal, config) {
  // Устойчивость: до 2 попыток. Если Gemma вернула битый JSON — ремонтируем;
  // если и после ремонта не парсится — пропускаем чанк (пустой payload),
  // чтобы один плохой чанк не валил весь документ.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(config.gemma.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.gemma.apiKey ? { Authorization: `Bearer ${config.gemma.apiKey}` } : {}) },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: 'Ты методолог НЦЭЛС, аналитик НПА и архитектор правил проверки регистрационного досье. Извлекай только подтвержденное текстом. Отвечай строго JSON без markdown.' }, { role: 'user', content: buildIntelligencePrompt(item, chunk, chunkNumber, chunksTotal) }], temperature: 0, max_tokens: 12000 }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      if (attempt < 2) continue;
      throw new Error(`Gemma HTTP ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content || '{}';
    const parsed = safeParseIntelligenceJson(raw);
    if (parsed) return normalizeIntelligencePayload(parsed, item, config);
    console.warn(`[gemma] ${item.document.id} chunk=${chunkNumber}/${chunksTotal} невалидный JSON (попытка ${attempt}/2)`);
  }
  console.warn(`[gemma] ${item.document.id} chunk=${chunkNumber}/${chunksTotal} пропущен — JSON не восстановлен`);
  return normalizeIntelligencePayload({}, item, config);
}

// Пытается распарсить JSON-ответ Gemma с несколькими стратегиями ремонта.
function safeParseIntelligenceJson(raw) {
  const cleaned = cleanJson(raw);
  const noTrailingCommas = cleaned.replace(/,(\s*[}\]])/g, '$1');
  const candidates = [cleaned, noTrailingCommas, balanceBrackets(noTrailingCommas)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* пробуем следующую стратегию */
    }
  }
  return null;
}

// Достраивает недостающие закрывающие скобки/кавычки при обрыве (truncation).
function balanceBrackets(text) {
  let curly = 0;
  let square = 0;
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') curly += 1; else if (ch === '}') curly -= 1;
    else if (ch === '[') square += 1; else if (ch === ']') square -= 1;
  }
  let out = text;
  if (inString) out += '"';
  while (square > 0) { out += ']'; square -= 1; }
  while (curly > 0) { out += '}'; curly -= 1; }
  return out;
}

function buildIntelligencePrompt(item, documentText, chunkNumber, chunksTotal) {
  return ['Проанализируй нормативный документ для интеллектуального справочника веб-приложения экспертизы ЛС/МИ.', chunksTotal > 1 ? `Это часть ${chunkNumber} из ${chunksTotal}. Извлекай только то, что подтверждено в этой части.` : 'Документ помещается в один запрос.', '', 'Цель не пересказать документ, а вытащить полезные для проекта сущности:', '- требования к документам заявителя;', '- параметры заявки, влияющие на комплектность/проверки;', '- зависимости вида если выбран параметр X, тогда нужен документ/проверка Y;', '- типы документов, упомянутые в НПА;', '- проверки, которые можно автоматизировать или подсветить эксперту;', '- ключевые пункты НПА и короткие подтверждающие цитаты.', '', 'Правила:', '1. Не придумывай. Если данных нет, верни пустой массив.', '2. Каждый вывод должен иметь source_point и короткий quote.', '3. Пиши прикладно для нашего проекта: заявка, чеклист документов, правила, проверки, эксперт.', '4. Требование формулируй атомарно: что требуется, для какого документа, при каком условии, зачем это важно.', '5. Если видишь пункт/подпункт/приложение, обязательно укажи его в source_point.', '6. Выделяй ключевые слова для поиска и подсветки в интерфейсе.', '', 'Верни JSON строго по схеме:', '{', '  "summary": {"short": "", "detailed": "", "project_relevance": "", "regulated_scope": ""},', '  "key_points": [{"title": "", "description": "", "project_impact": "", "keywords": [], "source_point": "", "quote": ""}],', '  "procedures": [{"name": "регистрация|перерегистрация|внесение изменений|неясно", "why_relevant": "", "source_point": "", "quote": ""}],', '  "document_types": [{"code": "", "name": "", "mapped_guess": "", "procedure": "", "requiredness": "обязателен|при наличии|зависит от условия|неясно", "condition": "", "why_needed": "", "source_point": "", "quote": ""}],', '  "requirements": [{"title": "", "requirement_text": "", "applies_to_document": "", "procedure": "", "condition": "", "applicant_parameters": [], "criticality": "critical|serious|warning|unknown", "why_it_matters": "", "source_point": "", "quote": "", "keywords": []}],', '  "applicant_parameters": [{"key": "", "label": "", "type": "enum|boolean|text|date|number", "options": [], "why_needed": "", "source_point": "", "quote": ""}],', '  "dependencies": [{"condition_text": "", "if_parameters": [], "then_required_documents": [], "then_checks": [], "explanation": "", "source_point": "", "quote": ""}],', '  "checks": [{"name": "", "check_type": "format|presence|content|consistency|date|ocr|manual|llm", "target_document": "", "automation_hint": "", "source_point": "", "quote": ""}],', '  "highlights": [{"kind": "requirement|parameter|dependency|document_type|check|key_point", "title": "", "section_hint": "", "source_point": "", "quote": "", "importance": ""}],', '  "quality_notes": [""]', '}', '', `Документ: ${item.document.title}`, `Файл: ${item.document.fileName}`, `Оценка размера: ${item.tokenEstimate} токенов`, `Текст: полный документ обрабатывается чанками без усечения. Текущая часть ${chunkNumber}/${chunksTotal}.`, '', 'ТЕКСТ ДОКУМЕНТА:', `<<<NPA\n${documentText.text}\nNPA>>>`].join('\n');
}

function buildDocumentTextChunks(item, maxInputChars) {
  const blocks = item.sections.map((section, index) => `${[`[${index + 1}]`, section.sectionType, section.headingNumber ? `пункт ${section.headingNumber}` : '', section.title].filter(Boolean).join(' · ')}\n${section.text}`);
  const chunks = [];
  let current = [];
  let currentLength = 0;
  for (const block of blocks) {
    if (block.length > maxInputChars) {
      if (current.length) chunks.push({ text: current.join('\n\n') });
      current = [];
      currentLength = 0;
      chunks.push(...splitLargeBlock(block, maxInputChars).map((text) => ({ text })));
      continue;
    }
    if (currentLength && currentLength + block.length + 2 > maxInputChars) {
      chunks.push({ text: current.join('\n\n') });
      current = [block];
      currentLength = block.length;
      continue;
    }
    current.push(block);
    currentLength += block.length + 2;
  }
  if (current.length) chunks.push({ text: current.join('\n\n') });
  return chunks.length ? chunks : [{ text: item.rawText }];
}

function splitLargeBlock(block, maxInputChars) {
  const limit = Math.max(12000, maxInputChars - 2000);
  const parts = [];
  for (let offset = 0; offset < block.length; offset += limit) parts.push(`${block.slice(0, 260)}\n\n[продолжение крупного пункта]\n${block.slice(offset, offset + limit)}`);
  return parts;
}

function normalizeIntelligencePayload(payload, item, config) {
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const list = (key) => Array.isArray(payload?.[key]) ? payload[key].filter((entry) => entry && typeof entry === 'object') : [];
  const strings = (key) => Array.isArray(payload?.[key]) ? payload[key].map(String).filter(Boolean) : [];
  const summary = object(payload?.summary);
  return { summary: { short: String(summary.short || `${item.document.title}.`), detailed: String(summary.detailed || ''), project_relevance: String(summary.project_relevance || ''), regulated_scope: String(summary.regulated_scope || '') }, key_points: list('key_points'), procedures: list('procedures'), document_types: list('document_types'), requirements: list('requirements'), applicant_parameters: list('applicant_parameters'), dependencies: list('dependencies'), checks: list('checks'), highlights: list('highlights'), quality_notes: strings('quality_notes'), meta: { model: config.model, prompt_version: config.promptVersion, analyzed_full_text: true, max_input_chars: config.maxInputChars } };
}

function mergeIntelligencePayloads(payloads, item, chunksTotal, config) {
  const firstSummary = payloads.find((payload) => payload.summary?.short || payload.summary?.detailed)?.summary || {};
  return { summary: { short: firstSummary.short || `${item.document.title}.`, detailed: firstSummary.detailed || [`${item.document.title}.`, `Документ полностью обработан Gemma по ${chunksTotal} чанкам.`, `Структурировано ${item.sections.length} пунктов/подпунктов.`].join(' '), project_relevance: firstSummary.project_relevance || '', regulated_scope: firstSummary.regulated_scope || '' }, key_points: uniqueObjects(payloads.flatMap((payload) => payload.key_points || []), ['title', 'source_point', 'quote']), procedures: uniqueObjects(payloads.flatMap((payload) => payload.procedures || []), ['name', 'source_point', 'quote']), document_types: uniqueObjects(payloads.flatMap((payload) => payload.document_types || []), ['code', 'name', 'source_point', 'quote']), requirements: uniqueObjects(payloads.flatMap((payload) => payload.requirements || []), ['title', 'requirement_text', 'applies_to_document', 'source_point']), applicant_parameters: uniqueObjects(payloads.flatMap((payload) => payload.applicant_parameters || []), ['key', 'label', 'source_point']), dependencies: uniqueObjects(payloads.flatMap((payload) => payload.dependencies || []), ['condition_text', 'explanation', 'source_point']), checks: uniqueObjects(payloads.flatMap((payload) => payload.checks || []), ['name', 'target_document', 'source_point']), highlights: uniqueObjects(payloads.flatMap((payload) => payload.highlights || []), ['kind', 'title', 'source_point', 'quote']), quality_notes: uniqueStrings([`Полная обработка по чанкам: ${chunksTotal}`, ...payloads.flatMap((payload) => payload.quality_notes || [])]), meta: { model: config.model, prompt_version: config.promptVersion, analyzed_full_text: true, chunks_total: chunksTotal, max_input_chars: config.maxInputChars } };
}
