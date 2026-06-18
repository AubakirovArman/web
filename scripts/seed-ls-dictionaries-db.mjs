import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';
const databaseUrl = process.env.NDDA_DATABASE_URL || process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const dictionaries = [
  ['ls_dossier_document_types_new', 'lib/data/generated/ls-dossier-document-types-new.json'],
  ['ls_document_requirement_rules', 'lib/data/generated/ls-document-requirement-rules.json'],
  ['ls_registration_document_rules_raw', 'lib/data/generated/ls-registration-document-rules.json'],
  ['ls_variation_checklist_rules', 'lib/data/generated/ls-variation-checklist-rules.json'],
  ['ls_recommended_missing_application_parameters', 'lib/data/generated/recommended-missing-application-parameters.json'],
  ['seed_npas', 'lib/data/generated/seed-npas.json'],
  ['seed_base_document_types', 'lib/data/generated/seed-base-document-types.json'],
  ['seed_document_type_metadata', 'lib/data/generated/seed-document-type-metadata.json'],
  ['seed_base_parameters', 'lib/data/generated/seed-base-parameters.json'],
  ['seed_additional_parameters', 'lib/data/generated/seed-additional-parameters.json'],
  ['seed_product_type_labels', 'lib/data/generated/seed-product-type-labels.json'],
  ['seed_ls_base_fields', 'lib/data/generated/seed-ls-base-fields.json'],
  ['seed_ls_procedure_fields', 'lib/data/generated/seed-ls-procedure-fields.json'],
  ['seed_ls_required_fields', 'lib/data/generated/seed-ls-required-fields.json'],
  ['seed_mi_base_fields', 'lib/data/generated/seed-mi-base-fields.json'],
  ['seed_mi_procedure_fields', 'lib/data/generated/seed-mi-procedure-fields.json'],
  ['seed_mi_required_fields', 'lib/data/generated/seed-mi-required-fields.json'],
  ['seed_rules', 'lib/data/generated/seed-rules.json'],
  ['seed_default_application_values', 'lib/data/generated/seed-default-application-values.json'],
];

async function readJson(relativePath) {
  const raw = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(raw);
}

function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/А/g, 'A')
    .replace(/\s+/g, '')
    .replace(/\.+$/g, '')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\w\u0400-\u04ff\d]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dossierSourceFromVariant(value) {
  return value === 'domestic_kz' ? 'appendix-2' : 'appendix-3';
}

function buildDocumentTypeIndex(items) {
  return items.map((item) => ({
    item,
    source: item.source,
    code: normalizeCode(item.code),
    name: normalizeText(item.name),
  }));
}

function findDocumentTypeId(rule, indexedDocumentTypes) {
  const source = dossierSourceFromVariant(rule.dossier_variant);
  const code = normalizeCode(rule.doc_code);
  const name = normalizeText(rule.document_name || rule.required_document);

  const exactCode = indexedDocumentTypes.find((entry) => entry.source === source && entry.code && entry.code === code);
  if (exactCode) return exactCode.item.id;

  const exactName = indexedDocumentTypes.find((entry) => entry.source === source && entry.name && entry.name === name);
  if (exactName) return exactName.item.id;

  const looseName = indexedDocumentTypes.find((entry) => (
    entry.source === source &&
    entry.name &&
    name &&
    (entry.name.includes(name) || name.includes(entry.name))
  ));
  if (looseName) return looseName.item.id;

  const withoutSub = code.replace(/\.SUB\d+$/i, '');
  const parentCode = withoutSub !== code ? withoutSub : code.split('.').slice(0, -1).join('.');
  if (parentCode) {
    const parent = indexedDocumentTypes.find((entry) => entry.source === source && entry.code === parentCode);
    if (parent) return parent.item.id;
  }

  const anySourceCode = indexedDocumentTypes.find((entry) => entry.code && entry.code === code);
  if (anySourceCode) return anySourceCode.item.id;

  return null;
}

async function ensureDocumentRequirementRulesTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_requirement_rules (
      id text PRIMARY KEY,
      scope_object_type text NOT NULL,
      scope_procedure text NOT NULL,
      doc_code text NOT NULL,
      document_type_id text,
      document_name text NOT NULL,
      row_type text,
      upload_required boolean NOT NULL DEFAULT true,
      source_structure text,
      dossier_variant text,
      module_part text,
      domestic_equivalent text,
      required_document text,
      applicability text NOT NULL,
      show_logic text NOT NULL,
      condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      condition_text text,
      linked_params jsonb NOT NULL DEFAULT '[]'::jsonb,
      activation_missing_params jsonb NOT NULL DEFAULT '[]'::jsonb,
      recommended_params_for_validation jsonb NOT NULL DEFAULT '[]'::jsonb,
      validation_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
      normalization_status text NOT NULL,
      original_trigger_expression text,
      source_reference text,
      confidence text,
      normalization_notes text,
      active boolean NOT NULL DEFAULT true,
      version integer NOT NULL DEFAULT 1,
      source text NOT NULL DEFAULT 'imported',
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS document_requirement_rules_scope_idx
      ON document_requirement_rules(scope_object_type, scope_procedure, active);
    CREATE INDEX IF NOT EXISTS document_requirement_rules_doc_code_idx
      ON document_requirement_rules(doc_code);
    CREATE INDEX IF NOT EXISTS document_requirement_rules_document_type_idx
      ON document_requirement_rules(document_type_id);
    CREATE INDEX IF NOT EXISTS document_requirement_rules_dossier_variant_idx
      ON document_requirement_rules(dossier_variant);
  `);
}

async function seedDocumentRequirementRules(pool) {
  const source = await readJson('lib/data/generated/ls-registration-document-rules.json');
  const documentTypes = await readJson('lib/data/generated/ls-dossier-document-types-new.json');
  const indexedDocumentTypes = buildDocumentTypeIndex(documentTypes);
  const rules = Array.isArray(source.rules) ? source.rules : [];

  await ensureDocumentRequirementRulesTable(pool);

  let mapped = 0;
  let synthetic = 0;
  for (const rule of rules) {
    const documentTypeId = findDocumentTypeId(rule, indexedDocumentTypes);
    if (documentTypeId) mapped += 1;
    else synthetic += 1;

    await pool.query(
      `
        INSERT INTO document_requirement_rules (
          id,
          scope_object_type,
          scope_procedure,
          doc_code,
          document_type_id,
          document_name,
          row_type,
          upload_required,
          source_structure,
          dossier_variant,
          module_part,
          domestic_equivalent,
          required_document,
          applicability,
          show_logic,
          condition_json,
          condition_text,
          linked_params,
          activation_missing_params,
          recommended_params_for_validation,
          validation_checks,
          normalization_status,
          original_trigger_expression,
          source_reference,
          confidence,
          normalization_notes,
          active,
          source,
          updated_by_user_id,
          updated_at
        )
        VALUES (
          $1, 'LS', 'registration', $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17::jsonb, $18::jsonb,
          $19::jsonb, $20, $21, $22, $23, $24, true, 'ls-registration-document-rules', 'system', now()
        )
        ON CONFLICT (id) DO UPDATE SET
          doc_code = EXCLUDED.doc_code,
          document_type_id = EXCLUDED.document_type_id,
          document_name = EXCLUDED.document_name,
          row_type = EXCLUDED.row_type,
          upload_required = EXCLUDED.upload_required,
          source_structure = EXCLUDED.source_structure,
          dossier_variant = EXCLUDED.dossier_variant,
          module_part = EXCLUDED.module_part,
          domestic_equivalent = EXCLUDED.domestic_equivalent,
          required_document = EXCLUDED.required_document,
          applicability = EXCLUDED.applicability,
          show_logic = EXCLUDED.show_logic,
          condition_json = EXCLUDED.condition_json,
          condition_text = EXCLUDED.condition_text,
          linked_params = EXCLUDED.linked_params,
          activation_missing_params = EXCLUDED.activation_missing_params,
          recommended_params_for_validation = EXCLUDED.recommended_params_for_validation,
          validation_checks = EXCLUDED.validation_checks,
          normalization_status = EXCLUDED.normalization_status,
          original_trigger_expression = EXCLUDED.original_trigger_expression,
          source_reference = EXCLUDED.source_reference,
          confidence = EXCLUDED.confidence,
          normalization_notes = EXCLUDED.normalization_notes,
          active = EXCLUDED.active,
          source = EXCLUDED.source,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = now()
      `,
      [
        rule.rule_id,
        rule.doc_code || '',
        documentTypeId,
        rule.document_name || rule.required_document || rule.rule_id,
        rule.row_type || null,
        rule.upload_required !== false,
        rule.source_structure || null,
        rule.dossier_variant || null,
        rule.module_part || null,
        rule.domestic_equivalent || null,
        rule.required_document || null,
        rule.applicability || 'conditional_required',
        rule.show_logic || 'require_when_condition_true',
        JSON.stringify(rule.condition || {}),
        rule.condition_text || null,
        JSON.stringify(rule.linked_params || []),
        JSON.stringify(rule.activation_missing_params || []),
        JSON.stringify(rule.recommended_params_for_validation || []),
        JSON.stringify(rule.validation_checks || []),
        rule.normalization_status || 'needs_review',
        rule.original_trigger_expression || null,
        rule.source_reference || null,
        rule.confidence || null,
        rule.normalization_notes || null,
      ]
    );
  }

  console.log(`document_requirement_rules: ${rules.length} rows (${mapped} mapped, ${synthetic} synthetic)`);
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id text PRIMARY KEY,
        role text NOT NULL CHECK (role IN ('applicant', 'expert', 'admin', 'system')),
        display_name text,
        email text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO app_users (id, role, display_name)
      VALUES ('system', 'system', 'System')
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS runtime_dictionaries (
        key text PRIMARY KEY,
        data jsonb NOT NULL,
        source text NOT NULL DEFAULT 'seed',
        created_by_user_id text NOT NULL DEFAULT 'system',
        updated_by_user_id text NOT NULL DEFAULT 'system',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const [key, relativePath] of dictionaries) {
      const data = await readJson(relativePath);
      await pool.query(
        `
          INSERT INTO runtime_dictionaries (key, data, source, created_by_user_id, updated_by_user_id, updated_at)
          VALUES ($1, $2::jsonb, 'generated-json-seed', 'system', 'system', now())
          ON CONFLICT (key) DO UPDATE
            SET data = EXCLUDED.data,
                source = EXCLUDED.source,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = now()
        `,
        [key, JSON.stringify(data)]
      );
      console.log(`${key}: ${Array.isArray(data) ? data.length : 1} rows`);
    }

    await seedDocumentRequirementRules(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
