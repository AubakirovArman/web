import { Pool } from 'pg';
import { ReferenceDocument, ReferenceSearchItem } from '@/lib/types';

const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';

const globalForReferenceDb = globalThis as unknown as {
  referencePool?: Pool;
};

export function getReferencePool() {
  if (!globalForReferenceDb.referencePool) {
    globalForReferenceDb.referencePool = new Pool({
      connectionString: process.env.REFERENCE_DATABASE_URL || DEFAULT_DATABASE_URL,
      max: 6,
    });
  }
  return globalForReferenceDb.referencePool;
}

export interface ReferenceListOptions {
  q?: string;
  domain?: 'LS' | 'MI' | 'all';
  kind?: string;
  limit?: number;
}

export interface ReferenceListResult {
  documents: ReferenceDocument[];
  searchItems: ReferenceSearchItem[];
  stats: {
    documentsCount: number;
    sectionsCount: number;
    databaseUrl: string;
  };
}

export async function listReferenceDocuments(options: ReferenceListOptions = {}): Promise<ReferenceListResult> {
  const pool = getReferencePool();
  const q = (options.q || '').trim();
  const domain = options.domain && options.domain !== 'all' ? options.domain : null;
  const kind = options.kind && options.kind !== 'all' ? options.kind : null;
  const limit = options.limit || 80;

  const params = [q, domain, kind, limit];
  const documentsResult = await pool.query(
    `
      SELECT id, domain, title, file_name, source_path, kind, number, document_date, tags, summary
      FROM reference_documents
      WHERE ($2::text IS NULL OR domain = $2)
        AND ($3::text IS NULL OR kind = $3)
        AND (
          $1::text = ''
          OR search_vector @@ websearch_to_tsquery('russian', $1)
          OR lower(title) LIKE '%' || lower($1) || '%'
          OR lower(raw_text) LIKE '%' || lower($1) || '%'
        )
      ORDER BY
        CASE WHEN $1::text = '' THEN 0 ELSE ts_rank(search_vector, websearch_to_tsquery('russian', $1)) END DESC,
        domain,
        title
      LIMIT $4
    `,
    params
  );

  const searchResult = q
    ? await pool.query(
        `
          SELECT s.document_id, d.domain, d.title, s.id AS section_id, s.title AS section_title,
                 coalesce(s.formatted_text, s.text) AS text, s.tags, s.anchor
          FROM reference_sections s
          JOIN reference_documents d ON d.id = s.document_id
          WHERE ($2::text IS NULL OR d.domain = $2)
            AND ($3::text IS NULL OR d.kind = $3)
            AND (
              s.search_vector @@ websearch_to_tsquery('russian', $1)
              OR lower(s.text) LIKE '%' || lower($1) || '%'
              OR lower(s.title) LIKE '%' || lower($1) || '%'
            )
          ORDER BY ts_rank(s.search_vector, websearch_to_tsquery('russian', $1)) DESC
          LIMIT 40
        `,
        [q, domain, kind]
      )
    : { rows: [] };

  const statsResult = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM reference_documents) AS documents_count,
      (SELECT count(*)::int FROM reference_sections) AS sections_count
  `);

  return {
    documents: documentsResult.rows.map(mapDocumentRow),
    searchItems: searchResult.rows.map(mapSearchRow),
    stats: {
      documentsCount: statsResult.rows[0]?.documents_count || 0,
      sectionsCount: statsResult.rows[0]?.sections_count || 0,
      databaseUrl: maskDatabaseUrl(process.env.REFERENCE_DATABASE_URL || DEFAULT_DATABASE_URL),
    },
  };
}

export async function getReferenceDocument(id: string): Promise<{ document: ReferenceDocument; markdown: string } | null> {
  const pool = getReferencePool();
  const documentResult = await pool.query(
    `
      SELECT id, domain, title, file_name, source_path, kind, number, document_date, tags, summary, markdown
      FROM reference_documents
      WHERE id = $1
    `,
    [id]
  );
  if (documentResult.rows.length === 0) return null;

  const sectionsResult = await pool.query(
    `
      SELECT id, title, level, anchor, text, raw_text, formatted_text, formatter, full_heading,
             heading_number, section_type, raw_char_count, summary, source_quote, tags
      FROM reference_sections
      WHERE document_id = $1
      ORDER BY sort_order
    `,
    [id]
  );

  const row = documentResult.rows[0];
  return {
    document: {
      ...mapDocumentRow(row),
      sections: sectionsResult.rows.map((section) => ({
        id: section.id,
        title: section.title,
        level: section.level,
        anchor: section.anchor,
        text: section.formatted_text || section.text,
        rawText: section.raw_text || undefined,
        formattedText: section.formatted_text || undefined,
        formatter: section.formatter || undefined,
        headingNumber: section.heading_number || undefined,
        sectionType: section.section_type || undefined,
        rawCharCount: section.raw_char_count || undefined,
      })),
    },
    markdown: sectionsResult.rows.length > 0 ? renderMarkdownFromSections(row, sectionsResult.rows) : row.markdown,
  };
}

function mapDocumentRow(row: any): ReferenceDocument {
  return {
    id: row.id,
    domain: row.domain,
    title: row.title,
    fileName: row.file_name,
    sourcePath: row.source_path,
    kind: row.kind,
    number: row.number || undefined,
    date: row.document_date || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    markdownPath: `db://${row.id}`,
    sections: row.summary
      ? [
          {
            id: `${row.id}-summary`,
            title: 'Краткое содержание',
            level: 2,
            anchor: 'summary',
            text: row.summary,
          },
        ]
      : [],
  };
}

function renderMarkdownFromSections(documentRow: any, rows: any[]) {
  const parts = [`# ${documentRow.title}`, ''];
  for (const row of rows) {
    const level = Math.max(2, Math.min((row.level || 1) + 1, 6));
    const heading = row.full_heading || row.title;
    parts.push(`${'#'.repeat(level)} ${heading}`);
    parts.push('');
    parts.push(row.formatted_text || row.text || '');
    parts.push('');
  }
  return parts.join('\n').trim() + '\n';
}

function mapSearchRow(row: any): ReferenceSearchItem {
  return {
    documentId: row.document_id,
    domain: row.domain,
    title: row.title,
    sectionId: row.section_id,
    sectionTitle: row.section_title,
    text: row.text,
    tags: Array.isArray(row.tags) ? row.tags : [],
    anchor: row.anchor,
  };
}

function maskDatabaseUrl(value: string) {
  return value.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@');
}
