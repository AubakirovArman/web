import type { EnvConfig, StructuredNpaDocument, StructuredNpaSection } from './types';

const PROMPT_VERSION = 'npa_ai_extraction_v2_dynamic_dependencies_8040_preview';
const WHOLE_DOCUMENT_CONTEXT_CHARS = 120000;
const CHUNK_CONTEXT_CHARS = 56000;

export async function analyzeDocumentRequirementsWithGemma(env: EnvConfig, document: StructuredNpaDocument) {
  const payloads = buildDocumentPayloads(document);
  if (payloads.length === 1) {
    return { extraction: await analyzeWithGemma(env, payloads[0]), payloadChars: payloads[0].length };
  }

  const extractions = [];
  for (const [index, payload] of payloads.entries()) {
    extractions.push(await analyzeWithGemma(env, [`Это часть ${index + 1} из ${payloads.length}.`, 'Извлекай только требования, которые видны в этой части. Не переноси требования из других частей.', payload].join('\n\n')));
  }
  return { extraction: mergeChunkExtractions(extractions, env.model, payloads.length), payloadChars: payloads.reduce((sum, payload) => sum + payload.length, 0) };
}

function buildDocumentPayloads(document: StructuredNpaDocument) {
  const fullPayload = buildDocumentPayload(document);
  if (fullPayload.length <= WHOLE_DOCUMENT_CONTEXT_CHARS) return [fullPayload];
  const chunks: string[] = [];
  let currentBlocks: string[] = [];

  for (const [index, section] of document.sections.entries()) {
    const block = buildSectionBlock(section, index);
    if (block.length > CHUNK_CONTEXT_CHARS) {
      const splitBlocks = splitLongBlock(block, CHUNK_CONTEXT_CHARS - 2500);
      for (const splitBlock of splitBlocks) {
        if (currentBlocks.length) {
          chunks.push(buildDocumentPayload(document, currentBlocks, chunks.length + 1));
          currentBlocks = [];
        }
        chunks.push(buildDocumentPayload(document, [splitBlock], chunks.length + 1));
      }
      continue;
    }
    const candidate = buildDocumentPayload(document, [...currentBlocks, block], chunks.length + 1);
    if (candidate.length > CHUNK_CONTEXT_CHARS && currentBlocks.length > 0) {
      chunks.push(buildDocumentPayload(document, currentBlocks, chunks.length + 1));
      currentBlocks = [block];
      continue;
    }
    currentBlocks.push(block);
  }

  if (currentBlocks.length) chunks.push(buildDocumentPayload(document, currentBlocks, chunks.length + 1));
  return chunks.length ? chunks : [fullPayload.slice(0, WHOLE_DOCUMENT_CONTEXT_CHARS)];
}

function buildDocumentPayload(document: StructuredNpaDocument, blocks?: string[], chunkNumber?: number) {
  const header = [`Файл: ${document.fileName}`, `Название: ${document.title}`, `Определено локально: область=${document.domain}; тип_акта=${document.kind}; номер=${document.number || ''}; дата=${document.date || ''}`, chunkNumber ? `Режим анализа: часть ${chunkNumber}` : 'Режим анализа: весь документ', '', 'СТРУКТУРНЫЕ БЛОКИ ДОКУМЕНТА:'];
  const contentBlocks = blocks || document.sections.map((section, index) => buildSectionBlock(section, index));
  return [...header, ...contentBlocks].join('\n\n');
}

function buildSectionBlock(section: StructuredNpaSection, index: number) {
  const label = [`[${index}] ${section.sectionType || 'section'}`, section.headingNumber ? `пункт ${section.headingNumber}` : '', section.title].filter(Boolean).join(' · ');
  return `${label}\n${section.text}`;
}

function splitLongBlock(block: string, maxChars: number) {
  const chunks: string[] = [];
  for (let offset = 0; offset < block.length; offset += maxChars) chunks.push(`${block.slice(0, 220)}\n\n[продолжение крупного блока]\n${block.slice(offset, offset + maxChars)}`);
  return chunks;
}

async function analyzeWithGemma(env: EnvConfig, documentText: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;
  const response = await fetch(env.chatUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: env.model,
      messages: [
        { role: 'system', content: 'Ты методолог НЦЭЛС и аналитик НПА. Извлекай только подтвержденное текстом документа. Верни только валидный JSON без markdown.' },
        { role: 'user', content: npaExtractionPrompt(documentText) },
      ],
      temperature: 0,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(240000),
  });
  if (!response.ok) throw new Error(`Gemma HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return normalizeAiPayload(JSON.parse(cleanJson(content)), env.model);
}

function npaExtractionPrompt(documentText: string) {
  return 'Проанализируй НПА для конструктора проверки документов.\n' +
    'Основная задача: извлечь только проверяемые требования к документам, условия обязательности документов, пункты НПА и критичность.\n' +
    'Если в тексте есть тип документа и указано, что именно в нем проверять, оформи это как строку requirements.\n' +
    'Не извлекай справочные фрагменты, общие пересказы и рекомендуемые поля заявки, если они не являются условием конкретного требования.\n\n' +
    'Правила:\n1. Не придумывай. Если в документе нет данных, верни пустой массив.\n2. quote должен быть короткой дословной опорой из документа.\n3. source_point заполняй пунктом/таблицей/строкой, если видно из текста.\n4. requirement_text формулируй как атомарную проверку документа заявителя.\n5. document_code/document_name заполняй, если требование относится к конкретному типу документа.\n6. applicant_parameters, parameter_groups и parameter_dependencies оставляй пустыми, кроме случаев, когда без них невозможно описать условие требования.\n\n' +
    'Верни JSON строго по схеме:\n' +
    '{\n  "area": "ЛС|МИ|неясно",\n  "act": {"type": "", "number": "", "date": "", "title": ""},\n  "procedures": ["регистрация|перерегистрация|внесение изменений"],\n  "document_types": [{"code": "", "name": "", "section": "", "procedure": "", "requiredness": "обязателен|при наличии|зависит от условия|неясно", "applicability_condition": "", "source_point": "", "quote": ""}],\n  "requirements": [{"document_code": "", "document_name": "", "procedure": "", "check_subject": "", "check_type": "комплектность|содержание|оформление|сверка с заявкой|срок/дата|неясно", "requirement_text": "", "criticality": "критично|значимо|рекомендация", "applicability_condition": "", "source_point": "", "quote": ""}],\n  "change_types": [{"code": "", "name": "", "procedure_type": "IA|IAНУ|IB|II|неясно", "conditions": "", "required_documents": "", "source_point": "", "quote": ""}],\n  "applicant_parameters": [{"key": "", "label": "", "value_type": "enum|boolean|text|date|number", "options": [], "why_needed": "", "source_point": "", "quote": ""}],\n  "parameter_groups": [{"key": "", "label": "", "description": "", "parameter_keys": [], "source_point": "", "quote": ""}],\n  "parameter_dependencies": [{"conditions": [{"parameter_key": "", "operator": "equals|not_equals|in|contains", "value": "", "values": []}], "logic_operator": "all|any", "target_kind": "parameter|group", "target_key": "", "effect_type": "show|require", "condition_text": "", "effect_text": "", "source_point": "", "quote": ""}],\n  "quality_notes": [""]\n}\n\n' +
    `ДОКУМЕНТ:\n<<<NPA\n${documentText}\nNPA>>>`;
}

function cleanJson(text: string) {
  let cleaned = String(text || '').trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i) || cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return start >= 0 && end > start ? cleaned.slice(start, end + 1).trim() : cleaned;
}

function normalizeAiPayload(payload: any, model: string) {
  const list = (key: string) => Array.isArray(payload?.[key]) ? payload[key].filter((item: unknown) => item && typeof item === 'object') : [];
  const strings = (key: string) => Array.isArray(payload?.[key]) ? payload[key].map(String).filter(Boolean) : [];
  const act = payload?.act && typeof payload.act === 'object' ? payload.act : {};
  return { area: String(payload?.area || 'неясно'), act: { type: String(act.type || ''), number: String(act.number || ''), date: String(act.date || ''), title: String(act.title || '') }, procedures: strings('procedures'), document_types: list('document_types'), requirements: list('requirements'), change_types: list('change_types'), applicant_parameters: list('applicant_parameters'), parameter_groups: list('parameter_groups'), parameter_dependencies: list('parameter_dependencies'), quality_notes: strings('quality_notes'), meta: { model, prompt_version: PROMPT_VERSION } };
}

function mergeChunkExtractions(payloads: any[], model: string, chunksTotal: number) {
  const normalized = payloads.map((payload) => normalizeAiPayload(payload, model));
  return {
    area: normalized.find((payload) => payload.area && payload.area !== 'неясно')?.area || 'неясно',
    act: normalized.find((payload) => payload.act?.title || payload.act?.number)?.act || { type: '', number: '', date: '', title: '' },
    procedures: uniqueStrings(normalized.flatMap((payload) => payload.procedures)),
    document_types: uniqueObjects(normalized.flatMap((payload) => payload.document_types), ['code', 'name', 'source_point', 'applicability_condition']),
    requirements: uniqueObjects(normalized.flatMap((payload) => payload.requirements), ['document_code', 'document_name', 'source_point', 'requirement_text']),
    change_types: uniqueObjects(normalized.flatMap((payload) => payload.change_types), ['code', 'name', 'source_point']),
    applicant_parameters: uniqueObjects(normalized.flatMap((payload) => payload.applicant_parameters), ['key', 'label', 'source_point']),
    parameter_groups: uniqueObjects(normalized.flatMap((payload) => payload.parameter_groups), ['key', 'label', 'source_point']),
    parameter_dependencies: uniqueObjects(normalized.flatMap((payload) => payload.parameter_dependencies), ['target_key', 'condition_text', 'source_point']),
    quality_notes: uniqueStrings([`Документ обработан чанками: ${chunksTotal}`, ...normalized.flatMap((payload) => payload.quality_notes)]),
    meta: { model, prompt_version: PROMPT_VERSION, chunks_total: chunksTotal },
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function uniqueObjects(items: Record<string, unknown>[], keys: string[]) {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];
  for (const item of items) {
    const key = keys.map((field) => String(item[field] || '').trim().toLowerCase()).filter(Boolean).join('|') || JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function previewSummary(payload: any) {
  return { area: payload.area || 'неясно', procedures: payload.procedures || [], document_types: payload.document_types?.length || 0, requirements: payload.requirements?.length || 0, applicant_parameters: payload.applicant_parameters?.length || 0, parameter_groups: payload.parameter_groups?.length || 0, parameter_dependencies: payload.parameter_dependencies?.length || 0, change_types: payload.change_types?.length || 0 };
}
