import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getReferencePool } from '@/lib/reference/db';
import type { ReferenceExperimentData, ReferenceExperimentDocument } from '@/components/reference/reference-types';

const DIR = path.join(process.cwd(), 'public', 'reference-intelligence');
const FULL_PATH = path.join(DIR, 'experiment.json');
const INDEX_PATH = path.join(DIR, 'index.json');
const DOCS_DIR = path.join(DIR, 'docs');

export type ReferenceListItem = Omit<ReferenceExperimentDocument, 'sections' | 'intelligence'> & {
  /** Short summary kept for list-level search without shipping full intelligence. */
  summaryShort?: string;
};

export interface ReferenceIndex {
  generatedAt: string;
  promptVersion: string;
  model: string | null;
  processedCount: number;
  targetCount: number;
  documents: ReferenceListItem[];
}

// ---------------------------------------------------------------------------
// Primary source: PostgreSQL (reference_experiment_documents / _meta).
// The /reference page reads from the DB once the migration has run
// (npm run reference:db:migrate-experiment). If the tables are missing or
// empty we transparently fall back to the file artifacts so nothing breaks.
// ---------------------------------------------------------------------------

interface MetaRow {
  generated_at: string | null;
  prompt_version: string | null;
  model: string | null;
}

async function getIndexFromDb(): Promise<ReferenceIndex | null> {
  const pool = getReferencePool();
  try {
    const [docsResult, metaResult, countsResult] = await Promise.all([
      pool.query<{ list_item: ReferenceListItem }>(
        `SELECT list_item FROM reference_experiment_documents ORDER BY sort_order, id`,
      ),
      pool.query<MetaRow>(`SELECT generated_at, prompt_version, model FROM reference_experiment_meta WHERE key = 'default' LIMIT 1`),
      pool.query<{ total: string; processed: string }>(
        `SELECT count(*)::text AS total, count(*) FILTER (WHERE status = 'processed')::text AS processed FROM reference_experiment_documents`,
      ),
    ]);

    const total = Number(countsResult.rows[0]?.total || 0);
    if (total === 0) return null; // not migrated yet → caller falls back to file

    const meta = metaResult.rows[0];
    return {
      generatedAt: meta?.generated_at || '',
      promptVersion: meta?.prompt_version || '',
      model: meta?.model ?? null,
      processedCount: Number(countsResult.rows[0]?.processed || 0),
      targetCount: total,
      documents: docsResult.rows.map((row) => row.list_item),
    };
  } catch {
    return null; // table missing / DB unavailable → fall back to file
  }
}

async function getDocumentFromDb(id: string): Promise<ReferenceExperimentDocument | null> {
  const pool = getReferencePool();
  try {
    const { rows } = await pool.query<{ data: ReferenceExperimentDocument }>(
      `SELECT data FROM reference_experiment_documents WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// File fallback: shared in-memory cache keyed by experiment.json mtime, with
// pre-split index.json / docs/<id>.json fast paths.
// ---------------------------------------------------------------------------

interface FullCache {
  mtimeMs: number;
  byId: Map<string, ReferenceExperimentDocument>;
  index: ReferenceIndex;
}

interface IndexCache {
  mtimeMs: number;
  index: ReferenceIndex;
}

const globalStore = globalThis as unknown as {
  __refFullCache?: FullCache;
  __refIndexCache?: IndexCache;
};

async function fileMtime(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

function stripDoc(doc: ReferenceExperimentDocument): ReferenceListItem {
  const { sections: _sections, intelligence, ...rest } = doc;
  const summaryShort = intelligence?.summary?.short;
  return summaryShort ? { ...rest, summaryShort } : rest;
}

export function toReferenceIndex(data: ReferenceExperimentData): ReferenceIndex {
  return {
    generatedAt: data.generatedAt,
    promptVersion: data.promptVersion,
    model: data.model,
    processedCount: data.processedCount,
    targetCount: data.targetCount,
    documents: data.documents.map(stripDoc),
  };
}

function safeDocId(id: string): string | null {
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

async function loadFull(): Promise<FullCache> {
  const mtimeMs = await fileMtime(FULL_PATH);
  if (mtimeMs == null) throw new Error('ENOENT: experiment.json not found');

  const cached = globalStore.__refFullCache;
  if (cached && cached.mtimeMs === mtimeMs) return cached;

  const raw = await readFile(FULL_PATH, 'utf-8');
  const data = JSON.parse(raw) as ReferenceExperimentData;
  const byId = new Map(data.documents.map((doc) => [doc.id, doc]));
  const next: FullCache = { mtimeMs, byId, index: toReferenceIndex(data) };
  globalStore.__refFullCache = next;
  return next;
}

async function getIndexFromFile(): Promise<ReferenceIndex> {
  const [indexMtime, fullMtime] = await Promise.all([fileMtime(INDEX_PATH), fileMtime(FULL_PATH)]);

  if (indexMtime != null && (fullMtime == null || indexMtime >= fullMtime)) {
    const cached = globalStore.__refIndexCache;
    if (cached && cached.mtimeMs === indexMtime) return cached.index;
    try {
      const raw = await readFile(INDEX_PATH, 'utf-8');
      const index = JSON.parse(raw) as ReferenceIndex;
      globalStore.__refIndexCache = { mtimeMs: indexMtime, index };
      return index;
    } catch {
      // fall through to full parse
    }
  }

  if (fullMtime == null) throw new Error('ENOENT: experiment.json not found');
  return (await loadFull()).index;
}

async function getDocumentFromFile(id: string): Promise<ReferenceExperimentDocument | null> {
  const safeId = safeDocId(id);
  if (safeId) {
    const docPath = path.join(DOCS_DIR, `${safeId}.json`);
    const [docMtime, fullMtime] = await Promise.all([fileMtime(docPath), fileMtime(FULL_PATH)]);
    if (docMtime != null && (fullMtime == null || docMtime >= fullMtime)) {
      try {
        return JSON.parse(await readFile(docPath, 'utf-8')) as ReferenceExperimentDocument;
      } catch {
        // fall through to full parse
      }
    }
  }

  const fullMtime = await fileMtime(FULL_PATH);
  if (fullMtime == null) return null;
  return (await loadFull()).byId.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Public API: DB first, file fallback.
// ---------------------------------------------------------------------------

export async function getReferenceIndex(): Promise<ReferenceIndex> {
  const fromDb = await getIndexFromDb();
  if (fromDb) return fromDb;
  return getIndexFromFile();
}

export async function getReferenceDocument(id: string): Promise<ReferenceExperimentDocument | null> {
  const fromDb = await getDocumentFromDb(id);
  if (fromDb) return fromDb;
  return getDocumentFromFile(id);
}
