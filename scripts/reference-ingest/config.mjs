import path from 'node:path';
import { loadLocalEnv, normalizeGemmaEndpoint, readArg } from './utils.mjs';

const DEFAULT_SOURCE_DIRS = ['/mnt/models/NDDA_AI/8040/ЛС', '/mnt/models/NDDA_AI/8040/МИ'];
const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';

export function createIngestConfig() {
  loadLocalEnv(path.resolve(process.cwd(), '.env'));
  loadLocalEnv(path.resolve(process.cwd(), '..', '.env'));

  const sourceArg = readArg('--source');
  const sourceDirsArg = readArg('--source-dirs');
  const documentId = readArg('--document-id');
  const gemmaEndpoint = normalizeGemmaEndpoint(
    process.env.GEMMA_APP_BASE_URL || process.env.GEMMA_BASE_URL || process.env.VLLM_URL || 'http://89.106.235.4:8000',
  );

  return {
    sourceArg,
    sourceDirsArg,
    documentId,
    defaultSourceDirs: DEFAULT_SOURCE_DIRS,
    databaseUrl: process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    runsDir: path.resolve(process.cwd(), '.reference-postgres/gemma-docx-runs'),
    convertDir: path.resolve(process.cwd(), '.reference-postgres/converted-docx'),
    gemmaConcurrency: Math.max(1, Number(readArg('--gemma-concurrency') || process.env.GEMMA_CONCURRENCY || 4)),
    maxGemmaSections: Number(readArg('--max-gemma-sections') || 0),
    maxDocuments: Number(readArg('--max-documents') || 0),
    noGemma: process.argv.includes('--no-gemma'),
    force: process.argv.includes('--force'),
    gemma: {
      baseUrl: gemmaEndpoint.baseUrl,
      chatUrl: gemmaEndpoint.chatUrl,
      model: process.env.GEMMA_MODEL || process.env.VLLM_MODEL || 'google/gemma-4-31B-it',
      apiKey: process.env.GEMMA_API_KEY || process.env.VLLM_API_KEY || '',
      timeoutMs: Number(process.env.GEMMA_TIMEOUT_MS || 90000),
      maxTokens: Number(process.env.GEMMA_MAX_TOKENS || 1600),
    },
  };
}
