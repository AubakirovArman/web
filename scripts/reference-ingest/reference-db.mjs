export async function ensureReferenceSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reference_documents (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      source_path TEXT,
      kind TEXT NOT NULL,
      number TEXT,
      document_date TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      summary TEXT,
      markdown TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      gemma_status TEXT NOT NULL,
      gemma_model TEXT,
      gemma_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      search_vector TSVECTOR,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reference_sections (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES reference_documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      level INTEGER NOT NULL,
      anchor TEXT NOT NULL,
      text TEXT NOT NULL,
      raw_text TEXT,
      formatted_text TEXT,
      formatter TEXT,
      heading_number TEXT,
      full_heading TEXT,
      section_type TEXT,
      raw_char_count INTEGER,
      summary TEXT,
      source_quote TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      sort_order INTEGER NOT NULL,
      search_vector TSVECTOR,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS raw_text TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS formatted_text TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS formatter TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS heading_number TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS full_heading TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS section_type TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS raw_char_count INTEGER;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS parent_section_id TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS numbering_path TEXT;
    ALTER TABLE reference_sections ADD COLUMN IF NOT EXISTS source_locator TEXT;

    CREATE INDEX IF NOT EXISTS reference_documents_search_idx ON reference_documents USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS reference_sections_search_idx ON reference_sections USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS reference_documents_domain_idx ON reference_documents(domain);
    CREATE INDEX IF NOT EXISTS reference_documents_kind_idx ON reference_documents(kind);
    CREATE INDEX IF NOT EXISTS reference_sections_document_idx ON reference_sections(document_id, sort_order);
  `);
}

export async function upsertReferenceDocument(pool, document, sections, { mode, model }) {
  const markdown = renderDocumentMarkdown(document, sections);
  const rawText = sections.map((section) => section.rawText).join('\n\n');
  const summary = buildDocumentSummary(document, sections);
  const tags = Array.from(new Set([...(document.tags || []), ...sections.flatMap((section) => section.tags || [])]));
  const gemmaJson = {
    kb_format: 'docx_legal_tree_v1',
    parser: 'word_document_xml',
    model: mode === 'gemma' ? model : null,
    formatted_by_gemma: sections.filter((section) => section.formatter === 'gemma').length,
    section_count: sections.length,
    source_path: document.sourcePath,
  };

  await pool.query('BEGIN');
  try {
    await pool.query(
      `
        INSERT INTO reference_documents (
          id, domain, title, file_name, source_path, kind, number, document_date, tags, summary,
          markdown, raw_text, gemma_status, gemma_model, gemma_json, search_vector, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10,
          $11, $12, $13, $14, $15::jsonb,
          to_tsvector('russian', coalesce($3,'') || ' ' || coalesce($10,'') || ' ' || coalesce($12,'')),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          domain = EXCLUDED.domain,
          title = EXCLUDED.title,
          file_name = EXCLUDED.file_name,
          source_path = EXCLUDED.source_path,
          kind = EXCLUDED.kind,
          number = EXCLUDED.number,
          document_date = EXCLUDED.document_date,
          tags = EXCLUDED.tags,
          summary = EXCLUDED.summary,
          markdown = EXCLUDED.markdown,
          raw_text = EXCLUDED.raw_text,
          gemma_status = EXCLUDED.gemma_status,
          gemma_model = EXCLUDED.gemma_model,
          gemma_json = EXCLUDED.gemma_json,
          search_vector = EXCLUDED.search_vector,
          updated_at = now()
      `,
      [
        document.id,
        document.domain,
        document.title,
        document.fileName,
        document.sourcePath,
        document.kind,
        document.number || null,
        document.date || null,
        JSON.stringify(tags),
        summary,
        markdown,
        rawText,
        mode,
        mode === 'gemma' ? model : null,
        JSON.stringify(gemmaJson),
      ],
    );

    await pool.query('DELETE FROM reference_sections WHERE document_id = $1', [document.id]);

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      await pool.query(
        `
          INSERT INTO reference_sections (
            id, document_id, title, level, anchor, text, raw_text, formatted_text, formatter,
            heading_number, full_heading, section_type, raw_char_count, summary, source_quote, tags,
            sort_order, parent_section_id, numbering_path, source_locator, search_vector, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16::jsonb,
            $17, $18, $19, $20,
            to_tsvector('russian', coalesce($3,'') || ' ' || coalesce($6,'') || ' ' || coalesce($14,'')),
            now()
          )
        `,
        [
          section.id,
          document.id,
          section.headingTitle,
          section.level,
          section.anchor,
          section.formattedText,
          section.rawText,
          section.formattedText,
          section.formatter,
          section.headingNumber,
          section.fullHeading,
          section.sectionType,
          section.rawText.length,
          section.summary,
          section.sourceQuote,
          JSON.stringify(section.tags || []),
          index + 1,
          section.parentId,
          section.numberingPath,
          section.sourceLocator,
        ],
      );
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

function renderDocumentMarkdown(document, sections) {
  return [
    `# ${document.title}`,
    '',
    ...sections.flatMap((section) => {
      const hashes = '#'.repeat(Math.max(2, Math.min(section.level + 1, 6)));
      const number = section.headingNumber && !String(section.headingTitle).startsWith(section.headingNumber)
        ? `${section.headingNumber} `
        : '';
      return [
        `${hashes} ${number}${section.headingTitle}`.trim(),
        '',
        section.formattedText,
        '',
      ];
    }),
  ].join('\n').trim() + '\n';
}

function buildDocumentSummary(document, sections) {
  const firstPoint = sections.find((section) => section.sectionType === 'point')?.summary;
  return firstPoint || `${document.title}. Структурировано ${sections.length} пунктов, подпунктов и абзацев из DOCX.`;
}
