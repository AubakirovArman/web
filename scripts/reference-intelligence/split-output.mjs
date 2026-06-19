import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Splits a full experiment dataset into runtime-friendly artifacts so the
 * server never has to parse the multi-MB experiment.json at request time:
 *   - index.json        — lightweight document list (no sections/intelligence)
 *   - docs/<id>.json     — one file per document with full sections + intelligence
 *
 * Keep the index item shape in sync with lib/reference/experiment-store.ts.
 */
export function buildReferenceIndex(data) {
  return {
    generatedAt: data.generatedAt,
    promptVersion: data.promptVersion,
    model: data.model ?? null,
    processedCount: data.processedCount,
    targetCount: data.targetCount,
    documents: (data.documents || []).map((doc) => {
      const { sections, intelligence, ...rest } = doc;
      const summaryShort = intelligence?.summary?.short;
      return summaryShort ? { ...rest, summaryShort } : rest;
    }),
  };
}

export async function writeSplitOutput(outputDir, data) {
  const indexPath = path.join(outputDir, 'index.json');
  const docsDir = path.join(outputDir, 'docs');

  // Reset the per-document directory so removed documents do not linger.
  await fs.rm(docsDir, { recursive: true, force: true });
  await fs.mkdir(docsDir, { recursive: true });

  const index = buildReferenceIndex(data);
  await fs.writeFile(indexPath, JSON.stringify(index), 'utf-8');

  let written = 0;
  for (const doc of data.documents || []) {
    if (!doc || typeof doc.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(doc.id)) continue;
    await fs.writeFile(path.join(docsDir, `${doc.id}.json`), JSON.stringify(doc), 'utf-8');
    written += 1;
  }

  return { indexPath, docsDir, documents: index.documents.length, docFiles: written };
}
