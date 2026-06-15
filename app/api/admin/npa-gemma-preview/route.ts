import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { getReferenceDocument } from '@/lib/reference/db';

export const runtime = 'nodejs';

const PROMPT_VERSION = 'npa_ai_extraction_v2_dynamic_dependencies_8040_preview';

interface EnvConfig {
  chatUrl: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

interface StructuredNpaSection {
  id: string;
  sectionType?: string | null;
  headingNumber?: string | null;
  title?: string | null;
  text: string;
}

interface StructuredNpaDocument {
  id: string;
  title: string;
  domain: string;
  kind: string;
  number?: string | null;
  date?: string | null;
  fileName: string;
  sections: StructuredNpaSection[];
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let document: StructuredNpaDocument;
    let sourceKind: 'reference' | 'upload' = 'reference';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      document = await parseUploadedNpaFile(buffer, file.name);
      sourceKind = 'upload';
    } else {
      const body = await req.json().catch(() => ({}));
      const documentId = String(body.documentId || '').trim();
      if (!documentId) {
        return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
      }

      const result = await getReferenceDocument(documentId);
      if (!result) {
        return NextResponse.json({ error: 'Reference document not found' }, { status: 404 });
      }
      document = result.document;
    }

    const env = readGemmaEnv();

    const payloadText = buildDocumentPayload(document);
    const extraction = await analyzeWithGemma(env, payloadText);
    const summary = previewSummary(extraction);

    return NextResponse.json({
      previewId: `${document.id}-${Date.now()}`,
      promptVersion: PROMPT_VERSION,
      sourceKind,
      createdAt: new Date().toISOString(),
      document: {
        id: document.id,
        title: document.title,
        domain: document.domain,
        fileName: document.fileName,
        number: document.number,
        date: document.date,
        sectionsTotal: document.sections.length,
        payloadChars: payloadText.length,
        sampleSections: document.sections.slice(0, 80).map((section) => ({
          id: section.id,
          type: section.sectionType,
          number: section.headingNumber,
          title: section.title,
          text: section.text.slice(0, 600),
        })),
      },
      extraction,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gemma preview failed' },
      { status: 502 },
    );
  }
}

function readGemmaEnv(): EnvConfig {
  const env = {
    ...parseEnvFile(path.resolve(process.cwd(), '.env')),
    ...parseEnvFile(path.resolve(process.cwd(), '..', '.env')),
    ...process.env,
  } as Record<string, string | undefined>;

  const endpoint = normalizeGemmaEndpoint(
    env.GEMMA_APP_BASE_URL || env.GEMMA_BASE_URL || env.VLLM_URL || 'http://89.106.235.4:8000',
  );

  return {
    ...endpoint,
    model: env.GEMMA_MODEL || env.VLLM_MODEL || 'google/gemma-4-31B-it',
    apiKey: env.GEMMA_API_KEY || env.VLLM_API_KEY || env.GEMMA_KEY || env.GEMMA4_API_KEY || '',
  };
}

function parseEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  const text = readFileSync(envPath, 'utf-8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\s+)\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function normalizeGemmaEndpoint(value: string) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (endpoint.endsWith('/v1/chat/completions')) {
    return {
      baseUrl: endpoint.replace(/\/v1\/chat\/completions$/, ''),
      chatUrl: endpoint,
    };
  }
  if (endpoint.endsWith('/chat/completions')) {
    return {
      baseUrl: endpoint.replace(/\/chat\/completions$/, ''),
      chatUrl: endpoint,
    };
  }
  if (endpoint.endsWith('/v1')) {
    return {
      baseUrl: endpoint.replace(/\/v1$/, ''),
      chatUrl: `${endpoint}/chat/completions`,
    };
  }
  return {
    baseUrl: endpoint,
    chatUrl: `${endpoint}/v1/chat/completions`,
  };
}

async function parseUploadedNpaFile(buffer: Buffer, fileName: string): Promise<StructuredNpaDocument> {
  const safeName = path.basename(fileName || 'uploaded-npa.docx');
  const ext = path.extname(safeName).toLowerCase();

  if (!['.doc', '.docx'].includes(ext)) {
    throw new Error('Поддерживаются только файлы .doc и .docx');
  }

  const docxBuffer = ext === '.doc' ? convertDocToDocx(buffer, safeName) : buffer;
  const raw = await mammoth.extractRawText({ buffer: docxBuffer });
  const text = normalizeExtractedText(raw.value || '');
  if (text.length < 100) {
    throw new Error('Не удалось извлечь достаточно текста из документа');
  }

  return {
    id: `upload-${Date.now()}`,
    title: inferUploadedTitle(text, safeName),
    domain: inferDomain(text),
    kind: 'uploaded_npa',
    number: inferActNumber(text),
    date: inferActDate(text),
    fileName: safeName,
    sections: splitUploadedTextIntoSections(text),
  };
}

function convertDocToDocx(buffer: Buffer, fileName: string): Buffer {
  const dir = mkdtempSync(path.join(tmpdir(), 'ndda-npa-upload-'));
  try {
    const inputPath = path.join(dir, path.basename(fileName));
    writeFileSync(inputPath, buffer);
    execFileSync('soffice', ['--headless', '--convert-to', 'docx', '--outdir', dir, inputPath], {
      stdio: 'pipe',
      timeout: 120000,
    });
    const outputPath = path.join(dir, `${path.basename(fileName, path.extname(fileName))}.docx`);
    if (!existsSync(outputPath)) {
      throw new Error('LibreOffice не смог конвертировать .doc в .docx');
    }
    return readFileSync(outputPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function splitUploadedTextIntoSections(text: string): StructuredNpaSection[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const sections: StructuredNpaSection[] = [];
  let current: StructuredNpaSection | null = null;

  const flush = () => {
    if (!current) return;
    current.text = current.text.trim();
    if (current.text) sections.push(current);
  };

  for (const line of lines) {
    const heading = classifyUploadedHeading(line);
    if (heading) {
      flush();
      current = {
        id: `upload-section-${sections.length + 1}`,
        sectionType: heading.type,
        headingNumber: heading.number,
        title: heading.title,
        text: line,
      };
      continue;
    }
    if (!current) {
      current = {
        id: `upload-section-${sections.length + 1}`,
        sectionType: 'preamble',
        headingNumber: null,
        title: 'Вводная часть',
        text: '',
      };
    }
    current.text += `${current.text ? '\n' : ''}${line}`;
  }
  flush();

  if (sections.length <= 1) {
    return text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk, index) => ({
        id: `upload-section-${index + 1}`,
        sectionType: index === 0 ? 'preamble' : 'fragment',
        headingNumber: null,
        title: index === 0 ? inferUploadedTitle(text, 'uploaded') : `Фрагмент ${index}`,
        text: chunk,
      }));
  }

  return sections;
}

function classifyUploadedHeading(line: string): { type: string; number: string | null; title: string } | null {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (/^(раздел|глава|параграф)\s+[IVXLCDM\d]+/i.test(normalized)) {
    const [, type, number = ''] = normalized.match(/^(раздел|глава|параграф)\s+([IVXLCDM\d]+)/i) || [];
    return { type: type?.toLowerCase() || 'heading', number, title: normalized };
  }
  const point = normalized.match(/^(\d+(?:-\d+)?(?:\.\d+)*)[.)]?\s+(.{8,})$/);
  if (point && normalized.length < 500) {
    return { type: point[1].includes('.') ? 'subpoint' : 'point', number: point[1], title: point[2] };
  }
  const appendix = normalized.match(/^приложение\s+([№N]?\s*\d+)?/i);
  if (appendix) {
    return { type: 'appendix', number: appendix[1] || null, title: normalized };
  }
  return null;
}

function inferUploadedTitle(text: string, fallback: string) {
  const firstUseful = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 12 && line.length < 260);
  return firstUseful || fallback;
}

function inferDomain(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('медицинск') && lower.includes('издел')) return 'МИ';
  if (lower.includes('лекарствен') || lower.includes('лекарств') || lower.includes('препарат')) return 'ЛС';
  return 'неясно';
}

function inferActNumber(text: string) {
  return text.match(/(?:№|N)\s*([A-Za-zА-Яа-я0-9\-\/]+)/)?.[1] || null;
}

function inferActDate(text: string) {
  return text.match(/от\s+(\d{1,2}\s+[а-яА-Я]+\s+\d{4}\s+года|\d{1,2}[./-]\d{1,2}[./-]\d{4})/)?.[1] || null;
}

function buildDocumentPayload(document: StructuredNpaDocument, maxChars = 62000) {
  const parts = [
    `Файл: ${document.fileName}`,
    `Название: ${document.title}`,
    `Определено локально: область=${document.domain}; тип_акта=${document.kind}; номер=${document.number || ''}; дата=${document.date || ''}`,
    '',
    'СТРУКТУРНЫЕ БЛОКИ ДОКУМЕНТА:',
  ];

  for (const [index, section] of document.sections.entries()) {
    const label = [
      `[${index}] ${section.sectionType || 'section'}`,
      section.headingNumber ? `пункт ${section.headingNumber}` : '',
      section.title,
    ].filter(Boolean).join(' · ');
    parts.push(`${label}\n${section.text.slice(0, 5000)}`);
    if (parts.join('\n\n').length > maxChars) break;
  }

  return trimPayload(parts.join('\n\n'), maxChars);
}

function trimPayload(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.72));
  const tail = text.slice(-Math.floor(maxChars * 0.18));
  return `${head}\n\n... [середина документа усечена для LLM-контекста] ...\n\n${tail}`;
}

async function analyzeWithGemma(env: EnvConfig, documentText: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;

  const response = await fetch(env.chatUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: env.model,
      messages: [
        {
          role: 'system',
          content:
            'Ты методолог НЦЭЛС и аналитик НПА. Извлекай только подтвержденное текстом документа. Верни только валидный JSON без markdown.',
        },
        { role: 'user', content: npaExtractionPrompt(documentText) },
      ],
      temperature: 0,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(240000),
  });

  if (!response.ok) {
    throw new Error(`Gemma HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(cleanJson(content));
  return normalizeAiPayload(parsed, env.model);
}

function npaExtractionPrompt(documentText: string) {
  return (
    'Проанализируй НПА и извлеки все полезное для конструктора проверки документов.\n' +
    'Нужно определить: область ЛС/МИ, типы процедур, типы документов, условия обязательности, проверяемые требования, виды внесения изменений, параметры заявки, группы параметров и зависимости между параметрами.\n\n' +
    'Правила:\n' +
    '1. Не придумывай. Если в документе нет данных, верни пустой массив.\n' +
    '2. quote должен быть короткой дословной опорой из документа.\n' +
    '3. source_point заполняй пунктом/таблицей/строкой, если видно из текста.\n' +
    '4. requirement_text формулируй как атомарную проверку документа заявителя.\n' +
    '5. applicant_parameters нужны только если параметр реально нужен для применимости требований.\n\n' +
    'Верни JSON строго по схеме:\n' +
    '{\n' +
    '  "area": "ЛС|МИ|неясно",\n' +
    '  "act": {"type": "", "number": "", "date": "", "title": ""},\n' +
    '  "procedures": ["регистрация|перерегистрация|внесение изменений"],\n' +
    '  "document_types": [{"code": "", "name": "", "section": "", "procedure": "", "requiredness": "обязателен|при наличии|зависит от условия|неясно", "applicability_condition": "", "source_point": "", "quote": ""}],\n' +
    '  "requirements": [{"document_code": "", "document_name": "", "procedure": "", "check_subject": "", "check_type": "комплектность|содержание|оформление|сверка с заявкой|срок/дата|неясно", "requirement_text": "", "criticality": "критично|значимо|рекомендация", "applicability_condition": "", "source_point": "", "quote": ""}],\n' +
    '  "change_types": [{"code": "", "name": "", "procedure_type": "IA|IAНУ|IB|II|неясно", "conditions": "", "required_documents": "", "source_point": "", "quote": ""}],\n' +
    '  "applicant_parameters": [{"key": "", "label": "", "value_type": "enum|boolean|text|date|number", "options": [], "why_needed": "", "source_point": "", "quote": ""}],\n' +
    '  "parameter_groups": [{"key": "", "label": "", "description": "", "parameter_keys": [], "source_point": "", "quote": ""}],\n' +
    '  "parameter_dependencies": [{"conditions": [{"parameter_key": "", "operator": "equals|not_equals|in|contains", "value": "", "values": []}], "logic_operator": "all|any", "target_kind": "parameter|group", "target_key": "", "effect_type": "show|require", "condition_text": "", "effect_text": "", "source_point": "", "quote": ""}],\n' +
    '  "quality_notes": [""]\n' +
    '}\n\n' +
    `ДОКУМЕНТ:\n<<<NPA\n${documentText}\nNPA>>>`
  );
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
  return {
    area: String(payload?.area || 'неясно'),
    act: {
      type: String(act.type || ''),
      number: String(act.number || ''),
      date: String(act.date || ''),
      title: String(act.title || ''),
    },
    procedures: strings('procedures'),
    document_types: list('document_types'),
    requirements: list('requirements'),
    change_types: list('change_types'),
    applicant_parameters: list('applicant_parameters'),
    parameter_groups: list('parameter_groups'),
    parameter_dependencies: list('parameter_dependencies'),
    quality_notes: strings('quality_notes'),
    meta: {
      model,
      prompt_version: PROMPT_VERSION,
    },
  };
}

function previewSummary(payload: any) {
  return {
    area: payload.area || 'неясно',
    procedures: payload.procedures || [],
    document_types: payload.document_types?.length || 0,
    requirements: payload.requirements?.length || 0,
    applicant_parameters: payload.applicant_parameters?.length || 0,
    parameter_groups: payload.parameter_groups?.length || 0,
    parameter_dependencies: payload.parameter_dependencies?.length || 0,
    change_types: payload.change_types?.length || 0,
  };
}
