import fs from 'node:fs/promises';
import path from 'node:path';
import { writeSplitOutput } from './split-output.mjs';

export async function writeExperimentOutput(outputPath, preparedItems, completedDocuments, mode, config) {
  const completedIds = new Set(completedDocuments.map((document) => document.id));
  const pending = preparedItems.filter((item) => !completedIds.has(item.document.id)).map((item) => ({ ...buildBaseOutput(item), status: 'pending' }));
  const output = { generatedAt: new Date().toISOString(), promptVersion: config.promptVersion, model: config.noGemma ? null : config.model, mode, processedCount: completedDocuments.filter((doc) => doc.status === 'processed').length, targetCount: preparedItems.length, sort: 'tokenEstimate:asc', note: 'Умный справочник НПА. Полная чанковая обработка Gemma без усечения середины документа; документы идут от меньших к большим.', documents: [...completedDocuments, ...pending] };
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  // Emit runtime-friendly split artifacts (index.json + docs/<id>.json) so the
  // server never parses the full experiment.json at request time.
  await writeSplitOutput(path.dirname(outputPath), output);
  return output;
}

export function buildBaseOutput(item) {
  return { ...item.document, tokenEstimate: item.tokenEstimate, charCount: item.charCount, sectionsCount: item.sections.length, sections: item.sections.map((section) => ({ id: section.id, title: section.title, level: section.level, anchor: section.anchor, sectionType: section.sectionType, headingNumber: section.headingNumber, text: section.text, rawCharCount: section.rawCharCount })) };
}
