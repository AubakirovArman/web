import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { buildLegalSections } from './reference-ingest/markdown-legal-sections.mjs';
import { checkGemmaAvailable, formatSections } from './reference-ingest/gemma-formatter.mjs';
import { ensureReferenceSchema, upsertReferenceDocument } from './reference-ingest/reference-db.mjs';
import { loadLocalEnv, normalizeGemmaEndpoint, readArg } from './reference-ingest/utils.mjs';

loadLocalEnv(path.resolve(process.cwd(), '.env'));
loadLocalEnv(path.resolve(process.cwd(), '..', '.env'));

const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';
const databaseUrl = process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const indexPath = path.resolve(process.cwd(), 'data/reference/generated/knowledge-index.json');
const docsDir = path.resolve(process.cwd(), 'data/reference/generated/documents');
const runsDir = path.resolve(process.cwd(), '.reference-postgres/gemma-runs');
const gemmaEndpoint = normalizeGemmaEndpoint(process.env.GEMMA_APP_BASE_URL || process.env.GEMMA_BASE_URL || process.env.VLLM_URL || 'http://89.106.235.4:8000');
const formatMode = process.env.REFERENCE_FORMAT_MODE || 'gemma';
const documentId = readArg('--document-id');
const maxDocuments = Number(readArg('--max-documents') || 0);
const gemmaConfig = {
  baseUrl: gemmaEndpoint.baseUrl,
  chatUrl: gemmaEndpoint.chatUrl,
  model: process.env.GEMMA_MODEL || process.env.VLLM_MODEL || 'google/gemma-4-31B-it',
  apiKey: process.env.GEMMA_API_KEY || process.env.VLLM_API_KEY || '',
  timeoutMs: Number(process.env.GEMMA_TIMEOUT_MS || 90000),
  maxTokens: Number(process.env.GEMMA_MAX_TOKENS || 1600),
  concurrency: Math.max(1, Number(readArg('--gemma-concurrency') || process.env.GEMMA_CONCURRENCY || 4)),
  maxSections: Number(readArg('--max-gemma-sections') || 0),
  noGemma: formatMode !== 'gemma',
  force: process.argv.includes('--force'),
  runsDir,
};

const pool = new Pool({ connectionString: databaseUrl });

try {
  await fs.mkdir(runsDir, { recursive: true });
  await ensureReferenceSchema(pool);
  const index = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
  let documents = index.documents;
  if (documentId) documents = documents.filter((document) => document.id === documentId);
  if (maxDocuments > 0) documents = documents.slice(0, maxDocuments);
  if (documents.length === 0) throw new Error(`No documents matched${documentId ? ` document-id=${documentId}` : ''}`);

  const gemmaAvailable = formatMode === 'gemma' ? await checkGemmaAvailable(gemmaConfig) : false;
  let count = 0;
  for (const document of documents) {
    const markdown = await fs.readFile(path.join(docsDir, `${document.id}.md`), 'utf-8');
    const legalSections = buildLegalSections(document, markdown);
    const formattedSections = await formatSections(document, legalSections, { ...gemmaConfig, available: gemmaAvailable });
    await upsertReferenceDocument(pool, document, formattedSections, { mode: gemmaAvailable ? 'gemma' : 'raw', model: gemmaConfig.model });
    count += 1;
    console.log(`[${count}/${documents.length}] ${document.id} sections=${formattedSections.length} gemma=${formattedSections.filter((section) => section.formatter === 'gemma').length} mode=${gemmaAvailable ? 'gemma' : 'raw'}`);
  }
  console.log(`Ingested ${count} reference documents into ${databaseUrl}`);
} finally {
  await pool.end();
}
