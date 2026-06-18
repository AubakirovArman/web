import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { TARGET_DOCUMENTS } from './reference-intelligence/target-documents.mjs';
import { analyzeDocument } from './reference-intelligence/analysis.mjs';
import { buildDocumentMeta, buildSections, parseDocxParagraphs, prepareDocxSource } from './reference-intelligence/document-parser.mjs';
import { buildBaseOutput, writeExperimentOutput } from './reference-intelligence/output.mjs';
import { estimateTokens, loadLocalEnv, normalizeGemmaEndpoint, readArg } from './reference-intelligence/utils.mjs';

loadLocalEnv(path.resolve(process.cwd(), '.env'));
loadLocalEnv(path.resolve(process.cwd(), '..', '.env'));

const config = {
  promptVersion: 'reference_intelligence_full_chunked_v2',
  rootDir: path.resolve(process.cwd(), '..'),
  outputDir: path.resolve(process.cwd(), 'public/reference-intelligence'),
  cacheDir: path.resolve(process.cwd(), '.reference-postgres/intelligence-runs'),
  convertDir: path.resolve(process.cwd(), '.reference-postgres/intelligence-converted-docx'),
  maxInputChars: Number(readArg('--max-input-chars') || process.env.REFERENCE_INTELLIGENCE_MAX_INPUT_CHARS || 62000),
  maxDocuments: process.argv.includes('--all') ? Number.MAX_SAFE_INTEGER : Number(readArg('--max-documents') || 1),
  force: process.argv.includes('--force'),
  noGemma: process.argv.includes('--no-gemma'),
  gemma: normalizeGemmaEndpoint(process.env.GEMMA_APP_BASE_URL || process.env.GEMMA_BASE_URL || process.env.VLLM_URL || 'http://89.106.235.4:8000'),
  model: process.env.GEMMA_MODEL || process.env.VLLM_MODEL || 'google/gemma-4-31B-it',
  timeoutMs: Number(process.env.GEMMA_TIMEOUT_MS || 240000),
};
config.gemma.apiKey = process.env.GEMMA_API_KEY || process.env.VLLM_API_KEY || '';
const outputPath = path.join(config.outputDir, 'experiment.json');

await fs.mkdir(config.outputDir, { recursive: true });
await fs.mkdir(config.cacheDir, { recursive: true });
await fs.mkdir(config.convertDir, { recursive: true });

const prepared = [];
for (const [id, relativePath] of TARGET_DOCUMENTS) {
  const sourcePath = path.join(config.rootDir, relativePath);
  if (!fsSync.existsSync(sourcePath)) {
    console.warn(`[missing] ${relativePath}`);
    continue;
  }
  const document = buildDocumentMeta(id, sourcePath);
  const paragraphs = await parseDocxParagraphs(prepareDocxSource(sourcePath, config.convertDir));
  const sections = buildSections(document, paragraphs);
  const rawText = sections.map((section) => section.text).join('\n\n');
  prepared.push({ document, sections, rawText, charCount: rawText.length, tokenEstimate: estimateTokens(rawText) });
}
prepared.sort((left, right) => left.tokenEstimate - right.tokenEstimate);

const documents = [];
let processed = 0;
for (const item of prepared) {
  const base = buildBaseOutput(item);
  if (config.noGemma || processed >= config.maxDocuments) {
    documents.push({ ...base, status: 'pending' });
    continue;
  }
  try {
    documents.push({ ...base, status: 'processed', processedAt: new Date().toISOString(), promptVersion: config.promptVersion, intelligence: await analyzeDocument(item, config) });
    processed += 1;
    console.log(`[processed] ${item.document.id} tokens=${item.tokenEstimate} ${item.document.fileName}`);
  } catch (error) {
    documents.push({ ...base, status: 'error', error: error instanceof Error ? error.message : String(error) });
    processed += 1;
    console.error(`[error] ${item.document.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await writeExperimentOutput(outputPath, prepared, documents, config.noGemma ? 'metadata-only' : 'gemma-full-chunked', config);
}

const output = await writeExperimentOutput(outputPath, prepared, documents, config.noGemma ? 'metadata-only' : 'gemma-full-chunked', config);
console.log(`written=${outputPath}`);
console.log(`processed=${output.processedCount}/${output.targetCount}`);
console.log('order:');
for (const doc of documents) console.log(`- ${doc.id} tokens=${doc.tokenEstimate} status=${doc.status} ${doc.fileName}`);
