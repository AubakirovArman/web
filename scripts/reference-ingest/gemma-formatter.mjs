import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanJson, cleanupLegalText, inferSectionTags, mapLimit, sha256 } from './utils.mjs';

export async function formatSections(document, sections, config) {
  let attempts = 0;
  let completed = 0;
  let gemma = 0;
  const jobs = sections.map((section) => {
    const shouldUseGemma = config.available && isGemmaUseful(section) && (!config.maxSections || attempts < config.maxSections);
    if (shouldUseGemma) attempts += 1;
    return { section, shouldUseGemma };
  });

  return mapLimit(jobs, config.concurrency, async ({ section, shouldUseGemma }) => {
    const formatted = shouldUseGemma
      ? await formatLegalSectionWithGemma(document, section, config)
      : formatLegalSectionRaw(section, config.available ? 'raw' : 'raw_empty_gemma');
    completed += 1;
    if (formatted.formatter === 'gemma') gemma += 1;
    if (!config.noGemma && (completed % 25 === 0 || completed === sections.length)) {
      console.log(`[docx-sections] ${document.id} ${completed}/${sections.length} gemma=${gemma}`);
    }
    return formatted;
  });
}

function isGemmaUseful(section) {
  if (section.rawText.length < 60) return false;
  if (['heading', 'chapter', 'appendix', 'approval'].includes(section.sectionType)) return false;
  return true;
}

export async function checkGemmaAvailable({ baseUrl, apiKey }) {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function formatLegalSectionWithGemma(document, section, config) {
  const cacheKey = sha256(`${config.model}\n${document.id}\n${section.id}\n${section.rawText}`);
  const cachePath = path.join(config.runsDir, `${document.id}-${section.index}-${cacheKey.slice(0, 12)}.json`);

  if (!config.force) {
    try {
      const cached = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
      return normalizeFormattedSection(section, cached.parsed, cached.status || 'gemma');
    } catch {
      // no cache
    }
  }

  const prompt = buildGemmaPrompt(document, section);
  try {
    const response = await fetch(config.chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'Ты юридический редактор НПА. Отвечай только валидным JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.05,
        max_tokens: config.maxTokens,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) throw new Error(`Gemma HTTP ${response.status}: ${await response.text()}`);

    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(cleanJson(raw));
    await fs.writeFile(cachePath, JSON.stringify({ status: 'gemma', raw, parsed }, null, 2), 'utf-8');
    return normalizeFormattedSection(section, parsed, 'gemma');
  } catch (error) {
    const fallback = formatLegalSectionRaw(section, 'gemma_error');
    fallback.summary = error instanceof Error ? error.message : 'Gemma formatting failed';
    return fallback;
  }
}

function buildGemmaPrompt(document, section) {
  return [
    'Переформатируй пункт нормативного документа для справочника.',
    '',
    'Правила:',
    '- Не меняй юридический смысл.',
    '- Не добавляй факты от себя.',
    '- Сохрани номера пунктов, подпунктов, приложений и ссылок.',
    '- Убери технический мусор, если он есть.',
    '- Если внутри текста есть перечисления, оформи их markdown-списком.',
    '- Не называй текст фрагментом.',
    '- Верни только JSON.',
    '',
    'JSON-схема:',
    '{"formatted_text":"","summary":"","source_quote":"","tags":[]}',
    '',
    `Документ: ${document.title}`,
    `Структура: ${section.fullHeading}`,
    `Тип узла: ${section.sectionType}`,
    `Номер/путь: ${section.numberingPath}`,
    '',
    'Текст:',
    section.rawText,
  ].join('\n');
}

function formatLegalSectionRaw(section, formatter) {
  const formattedText = cleanupLegalText(section.rawText);
  return {
    ...section,
    formattedText,
    formatter,
    summary: formattedText.slice(0, 520),
    sourceQuote: formattedText.slice(0, 320),
    tags: inferSectionTags(section.fullHeading, formattedText),
  };
}

function normalizeFormattedSection(section, parsed, formatter) {
  const formattedText = String(parsed?.formatted_text || '').trim();
  const safeFormattedText = formattedText && formattedText.length >= Math.min(50, section.rawText.length * 0.35)
    ? formattedText
    : cleanupLegalText(section.rawText);
  const safeFormatter = safeFormattedText === formattedText ? formatter : 'raw_safety_short_gemma';

  return {
    ...section,
    formattedText: safeFormattedText,
    formatter: safeFormatter,
    summary: String(parsed?.summary || safeFormattedText.slice(0, 520)).trim(),
    sourceQuote: String(parsed?.source_quote || safeFormattedText.slice(0, 320)).trim(),
    tags: Array.isArray(parsed?.tags) ? parsed.tags.map(String) : inferSectionTags(section.fullHeading, safeFormattedText),
  };
}
