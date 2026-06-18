import fs from 'node:fs/promises';
import { Pool } from 'pg';
import { createIngestConfig } from './reference-ingest/config.mjs';
import { buildDocumentMeta, prepareDocxSource, resolveSources } from './reference-ingest/source-discovery.mjs';
import { parseDocxParagraphs } from './reference-ingest/docx-parser.mjs';
import { buildStructuredLegalSections } from './reference-ingest/legal-section-builder.mjs';
import { checkGemmaAvailable, formatSections } from './reference-ingest/gemma-formatter.mjs';
import { ensureReferenceSchema, upsertReferenceDocument } from './reference-ingest/reference-db.mjs';

const config = createIngestConfig();
const pool = new Pool({ connectionString: config.databaseUrl });

try {
  await fs.mkdir(config.runsDir, { recursive: true });
  await fs.mkdir(config.convertDir, { recursive: true });
  await ensureReferenceSchema(pool);

  const gemmaAvailable = !config.noGemma && await checkGemmaAvailable(config.gemma);
  const sources = resolveSources({
    sourceArg: config.sourceArg,
    sourceDirsArg: config.sourceDirsArg,
    defaultSourceDirs: config.defaultSourceDirs,
  });
  const selectedSources = config.maxDocuments > 0 ? sources.slice(0, config.maxDocuments) : sources;
  const errors = [];
  let processed = 0;

  for (const sourcePath of selectedSources) {
    try {
      const document = buildDocumentMeta(sourcePath, config.documentId && selectedSources.length === 1 ? config.documentId : '');
      const docxPath = prepareDocxSource(sourcePath, config.convertDir);
      const paragraphs = await parseDocxParagraphs(docxPath);
      const sections = buildStructuredLegalSections(document, paragraphs);
      const formattedSections = await formatSections(document, sections, {
        ...config.gemma,
        runsDir: config.runsDir,
        maxSections: config.maxGemmaSections,
        concurrency: config.gemmaConcurrency,
        noGemma: config.noGemma,
        force: config.force,
        available: gemmaAvailable,
      });

      await upsertReferenceDocument(pool, document, formattedSections, {
        mode: gemmaAvailable ? 'gemma' : 'raw',
        model: config.gemma.model,
      });

      processed += 1;
      const gemmaCount = formattedSections.filter((section) => section.formatter === 'gemma').length;
      console.log(
        `[${processed}/${selectedSources.length}] ${document.id} sections=${formattedSections.length} paragraphs=${paragraphs.length} gemma=${gemmaCount} source=${document.fileName}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ sourcePath, message });
      console.error(`[skip] ${sourcePath}: ${message}`);
    }
  }

  console.log(`Structured DOCX ingest complete: processed=${processed} failed=${errors.length}`);
  console.log(`database=${config.databaseUrl}`);
} finally {
  await pool.end();
}
