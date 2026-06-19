import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
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

interface FullCache {
  mtimeMs: number;
  byId: Map<string, ReferenceExperimentDocument>;
  index: ReferenceIndex;
}

interface IndexCache {
  mtimeMs: number;
  index: ReferenceIndex;
}

// Caches survive HMR / route module reloads by living on globalThis.
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

// Sanitize ids before using them as file names to avoid path traversal.
function safeDocId(id: string): string | null {
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

/**
 * Parse the full 17 MB experiment.json at most once per file version.
 * Cached in memory keyed by file mtime, so it is only re-parsed when the
 * generator rewrites the file — never on a timer and never twice for the
 * list + detail routes.
 */
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

/**
 * Lightweight document list. Prefers the pre-split index.json (≈21 KB,
 * trivial to parse); falls back to parsing the full file once if the split
 * artifacts are missing or stale.
 */
export async function getReferenceIndex(): Promise<ReferenceIndex> {
  const [indexMtime, fullMtime] = await Promise.all([fileMtime(INDEX_PATH), fileMtime(FULL_PATH)]);

  // Use pre-split index only when it is at least as fresh as the source.
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

/**
 * Full document by id. Prefers a per-document file (docs/<id>.json) so a
 * detail view never forces a parse of the whole experiment.json.
 */
export async function getReferenceDocument(id: string): Promise<ReferenceExperimentDocument | null> {
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
