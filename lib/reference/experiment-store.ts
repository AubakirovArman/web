import { getReferencePool } from '@/lib/reference/db';
import type { ReferenceExperimentDocument } from '@/components/reference/reference-types';

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

/**
 * Marker error thrown when the reference experiment has not been migrated into
 * the database yet. Routes translate this into a 404 with a setup hint.
 */
export const REFERENCE_DB_EMPTY = 'REFERENCE_DB_EMPTY';

interface MetaRow {
  generated_at: string | null;
  prompt_version: string | null;
  model: string | null;
}

/**
 * Document list — read from PostgreSQL (reference_experiment_documents).
 * Returns only the lightweight `list_item` payload per row.
 */
export async function getReferenceIndex(): Promise<ReferenceIndex> {
  const pool = getReferencePool();
  const [docsResult, metaResult, countsResult] = await Promise.all([
    pool.query<{
      list_item: ReferenceListItem;
      req_count: number;
      doc_count: number;
      param_count: number;
      dep_count: number;
      check_count: number;
    }>(
      `SELECT list_item,
         jsonb_array_length(COALESCE(data->'intelligence'->'requirements','[]'::jsonb)) AS req_count,
         jsonb_array_length(COALESCE(data->'intelligence'->'document_types','[]'::jsonb)) AS doc_count,
         jsonb_array_length(COALESCE(data->'intelligence'->'applicant_parameters','[]'::jsonb)) AS param_count,
         jsonb_array_length(COALESCE(data->'intelligence'->'dependencies','[]'::jsonb)) AS dep_count,
         jsonb_array_length(COALESCE(data->'intelligence'->'checks','[]'::jsonb)) AS check_count
       FROM reference_experiment_documents ORDER BY sort_order, id`,
    ),
    pool.query<MetaRow>(
      `SELECT generated_at, prompt_version, model FROM reference_experiment_meta WHERE key = 'default' LIMIT 1`,
    ),
    pool.query<{ total: string; processed: string }>(
      `SELECT count(*)::text AS total, count(*) FILTER (WHERE status = 'processed')::text AS processed FROM reference_experiment_documents`,
    ),
  ]);

  const total = Number(countsResult.rows[0]?.total || 0);
  if (total === 0) {
    throw new Error(`${REFERENCE_DB_EMPTY}: run "npm run reference:db:migrate-experiment"`);
  }

  const meta = metaResult.rows[0];
  return {
    generatedAt: meta?.generated_at || '',
    promptVersion: meta?.prompt_version || '',
    model: meta?.model ?? null,
    processedCount: Number(countsResult.rows[0]?.processed || 0),
    targetCount: total,
    documents: docsResult.rows.map((row) => ({
      ...row.list_item,
      intelligenceCounts: {
        requirements: Number(row.req_count) || 0,
        document_types: Number(row.doc_count) || 0,
        applicant_parameters: Number(row.param_count) || 0,
        dependencies: Number(row.dep_count) || 0,
        checks: Number(row.check_count) || 0,
      },
    })),
  };
}

/**
 * Full document by id — read from PostgreSQL (the `data` jsonb column, which
 * includes sections and the intelligence analysis).
 */
export async function getReferenceDocument(id: string): Promise<ReferenceExperimentDocument | null> {
  const pool = getReferencePool();
  const { rows } = await pool.query<{ data: ReferenceExperimentDocument }>(
    `SELECT data FROM reference_experiment_documents WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0]?.data ?? null;
}
