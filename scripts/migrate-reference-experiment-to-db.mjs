#!/usr/bin/env node
// Migrates the file-based reference experiment (public/reference-intelligence/
// experiment.json) into PostgreSQL so the /reference page can read from the DB.
//
// Creates two tables in the reference DB:
//   reference_experiment_meta       — single-row run metadata
//   reference_experiment_documents  — one row per document with:
//        list_item jsonb  (lightweight: doc without sections/intelligence + summaryShort)
//        data      jsonb  (full document: sections + intelligence)

import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL =
  process.env.NDDA_DATABASE_URL ||
  process.env.REFERENCE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';

const fullPath = path.resolve(process.cwd(), 'public/reference-intelligence/experiment.json');

function toListItem(doc) {
  const { sections, intelligence, ...rest } = doc;
  const summaryShort = intelligence?.summary?.short;
  return summaryShort ? { ...rest, summaryShort } : rest;
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reference_experiment_meta (
      key text PRIMARY KEY DEFAULT 'default',
      generated_at text,
      prompt_version text,
      model text,
      note text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reference_experiment_documents (
      id text PRIMARY KEY,
      domain text,
      title text,
      file_name text,
      number text,
      document_date text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      summary_short text,
      status text,
      sort_order integer NOT NULL DEFAULT 0,
      list_item jsonb NOT NULL,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS reference_experiment_documents_sort_idx
      ON reference_experiment_documents(sort_order);
    CREATE INDEX IF NOT EXISTS reference_experiment_documents_domain_idx
      ON reference_experiment_documents(domain);
  `);
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(fullPath, 'utf-8');
  } catch {
    console.error(`Not found: ${fullPath}. Run "npm run reference:intelligence:experiment" first.`);
    process.exit(1);
  }

  const data = JSON.parse(raw);
  const documents = Array.isArray(data.documents) ? data.documents : [];
  if (documents.length === 0) {
    console.error('experiment.json has no documents — aborting.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
  const client = await pool.connect();
  try {
    await ensureSchema(pool);
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO reference_experiment_meta (key, generated_at, prompt_version, model, note, updated_at)
        VALUES ('default', $1, $2, $3, $4, now())
        ON CONFLICT (key) DO UPDATE
          SET generated_at = EXCLUDED.generated_at,
              prompt_version = EXCLUDED.prompt_version,
              model = EXCLUDED.model,
              note = EXCLUDED.note,
              updated_at = now()
      `,
      [data.generatedAt ?? null, data.promptVersion ?? null, data.model ?? null, data.note ?? null],
    );

    // Replace the document set so removed documents do not linger.
    await client.query('TRUNCATE reference_experiment_documents');

    let inserted = 0;
    for (let i = 0; i < documents.length; i += 1) {
      const doc = documents[i];
      if (!doc || typeof doc.id !== 'string') continue;
      const listItem = toListItem(doc);
      await client.query(
        `
          INSERT INTO reference_experiment_documents
            (id, domain, title, file_name, number, document_date, tags, summary_short, status, sort_order, list_item, data, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
        `,
        [
          doc.id,
          doc.domain ?? null,
          doc.title ?? null,
          doc.fileName ?? null,
          doc.number ?? null,
          doc.date ?? null,
          JSON.stringify(Array.isArray(doc.tags) ? doc.tags : []),
          listItem.summaryShort ?? null,
          doc.status ?? null,
          i,
          JSON.stringify(listItem),
          JSON.stringify(doc),
        ],
      );
      inserted += 1;
    }

    await client.query('COMMIT');
    console.log(`migrated ${inserted} documents into reference_experiment_documents (DB: ${maskUrl(DATABASE_URL)})`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function maskUrl(value) {
  return value.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
