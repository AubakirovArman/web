import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const root = path.resolve(webRoot, '..');
const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';
const databaseUrl = process.env.NDDA_DATABASE_URL || process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const memoPath = path.join(root, 'experiments/applicant-memo-parser/applicant-memo-normalized-rules.json');
const oldTypesPath = path.join(webRoot, 'lib/data/generated/ls-dossier-document-types-new.json');
const oldRulesPath = path.join(webRoot, 'lib/data/generated/ls-registration-document-rules.json');
const latestBackupPath = path.join(root, 'backups/latest-document-types-backup-path.txt');

function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/С/g, 'S')
    .replace(/А/g, 'A')
    .replace(/\s+/g, '')
    .replace(/\.+$/g, '')
    .trim();
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[а]/g, 'a').replace(/[б]/g, 'b').replace(/[в]/g, 'v').replace(/[г]/g, 'g').replace(/[д]/g, 'd')
    .replace(/[её]/g, 'e').replace(/[ж]/g, 'zh').replace(/[з]/g, 'z').replace(/[и]/g, 'i').replace(/[й]/g, 'y')
    .replace(/[к]/g, 'k').replace(/[л]/g, 'l').replace(/[м]/g, 'm').replace(/[н]/g, 'n').replace(/[о]/g, 'o')
    .replace(/[п]/g, 'p').replace(/[р]/g, 'r').replace(/[с]/g, 's').replace(/[т]/g, 't').replace(/[у]/g, 'u')
    .replace(/[ф]/g, 'f').replace(/[х]/g, 'h').replace(/[ц]/g, 'c').replace(/[ч]/g, 'ch').replace(/[ш]/g, 'sh')
    .replace(/[щ]/g, 'sch').replace(/[ъь]/g, '').replace(/[ы]/g, 'y').replace(/[э]/g, 'e').replace(/[ю]/g, 'yu').replace(/[я]/g, 'ya')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'document';
}

function inferFormats(record, oldItem) {
  if (Array.isArray(oldItem?.acceptedFormats) && oldItem.acceptedFormats.length) return oldItem.acceptedFormats;
  const text = `${record.title} ${record.normalized_condition_text}`.toLowerCase();
  if (text.includes('jpeg') || text.includes('jpg') || text.includes('макет') || text.includes('этикет')) return ['jpg', 'jpeg', 'png'];
  if (text.includes('excel') || text.includes('xls') || text.includes('таблиц')) return ['xls', 'xlsx', 'pdf'];
  if (text.includes('word') || text.includes('doc')) return ['doc', 'docx', 'pdf'];
  return ['pdf', 'doc', 'docx'];
}

function inferCheckIds(record, oldItem) {
  if (Array.isArray(oldItem?.checkIds) && oldItem.checkIds.length) return oldItem.checkIds;
  const text = `${record.normalized_code} ${record.title} ${record.normalized_condition_text}`.toLowerCase();
  const checks = new Set(['required_document_presence_check', 'file_format_check']);
  if (!text.includes('jpg') && !text.includes('jpeg')) checks.add('ocr_quality_check');
  if (text.includes('gmp')) checks.add('gmp_certificate_check');
  if (text.includes('сертификат на фармацевтический продукт')) checks.add('cpp_certificate_check');
  if (text.includes('стабильн') || text.includes('срок год')) checks.add('shelf_life_consistency_check');
  if (text.includes('хранен') || text.includes('транспорт')) checks.add('storage_consistency_check');
  if (text.includes('охлп') || text.includes('инструкц') || text.includes('маркиров')) checks.add('core_field_consistency_check');
  if (text.includes('фармаконадзор') || text.includes('управления рисками')) checks.add('pharmacovigilance_contact_check');
  if (text.includes('стерил')) checks.add('sterility_validation_check');
  if (text.includes('модуль 3') || text.includes('качество') || record.normalized_code.startsWith('3.2.')) checks.add('module3_content_check');
  return Array.from(checks);
}

function moduleLabel(record) {
  const module = String(record.module || record.normalized_code.split('.')[0] || '').replace(/^Модуль\s*/i, '').trim();
  return module ? `Модуль ${module}` : 'Модуль';
}

function groupForRecord(record) {
  const module = moduleLabel(record);
  if (record.normalized_code.startsWith('1.')) return 'Модуль 1. Административная информация';
  if (record.normalized_code.startsWith('2.')) return 'Модуль 2. Резюме общего технического документа';
  if (record.normalized_code.startsWith('3.')) return 'Модуль 3. Качество';
  if (record.normalized_code.startsWith('4.')) return 'Модуль 4. Доклинические исследования';
  if (record.normalized_code.startsWith('5.')) return 'Модуль 5. Клинические исследования';
  return module;
}

function oldIndex(items) {
  const byCode = new Map();
  for (const item of items) {
    const code = normalizeCode(item.code);
    if (code && !byCode.has(code)) byCode.set(code, item);
  }
  return byCode;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function stripReferenceOnlyPhrases(value) {
  return String(value || '')
    .replace(/Представленная информация должна соответствовать разделу 3\.2\.?\s*[PSРС]\s*модуля 3\s*РД\.?/gi, '')
    .replace(/Представленная информация должна соответствовать разделу 3\.2\.?/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([.;:]){2,}/g, '$1')
    .trim();
}

function isReferenceOnlyCondition(value) {
  const text = normalizeText(value);
  if (!text) return true;
  return [
    /^Представленная информация должна соответствовать разделу 3\.2\.?\s*[PSРС]\s*модуля 3\s*РД\.?$/i,
    /^Представленная информация должна соответствовать разделу 3\.2\.?$/i,
    /^[PSРС]\s*модуля 3\s*РД\.?$/i,
  ].some((pattern) => pattern.test(text));
}

function uniqueClean(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = normalizeText(stripReferenceOnlyPhrases(value));
    if (!text || isReferenceOnlyCondition(text) || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function conditionText(record) {
  const required = uniqueClean(record.resolved_required_documentation || []);
  const conditions = uniqueClean(record.resolved_conditions || []);
  const parts = [];
  if (required.length) parts.push(`Требуемая документация: ${required.join('; ')}`);
  if (conditions.length) parts.push(`Условия: ${conditions.join('; ')}`);
  return parts.join(' ') || normalizeText(record.normalized_condition_text);
}

function validationChecks(record) {
  const checks = Array.isArray(record.validation_checks) ? record.validation_checks : [];
  const values = uniqueClean(checks.map((check) => check.what_to_check || check.title || check.source_fragment));
  if (values.length) return values;
  return [conditionText(record)].filter(Boolean);
}

function dbApplicability(record) {
  const requiredness = String(record.activation_condition?.requiredness || '').toLowerCase();
  if (requiredness === 'required') return 'always_required';
  return 'conditional_required';
}

function severity(record) {
  const requiredness = String(record.activation_condition?.requiredness || '').toLowerCase();
  return requiredness === 'required' ? 'critical' : 'warning';
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function ensureRuntimeSchema(pool) {
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

    CREATE TABLE IF NOT EXISTS admin_runtime_config (
      key text PRIMARY KEY DEFAULT 'default',
      data jsonb NOT NULL,
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS runtime_dictionaries (
      key text PRIMARY KEY,
      data jsonb NOT NULL,
      source text NOT NULL DEFAULT 'seed',
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

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
  `);
}

async function main() {
  const memo = await readJson(memoPath);
  const oldTypes = await readJson(oldTypesPath);
  const oldRules = await readJson(oldRulesPath).catch(() => ({ rules: [] }));
  const oldByCode = oldIndex(oldTypes);
  const backupDir = (await fs.readFile(latestBackupPath, 'utf8').catch(() => '')).trim();
  const backup = backupDir || path.join(root, `backups/document-types-db-import-${Date.now()}`);
  await fs.mkdir(backup, { recursive: true });

  const items = memo.records.map((record, index) => {
    const code = normalizeCode(record.normalized_code);
    const oldItem = oldByCode.get(code);
    const item = {
      id: `memo-ls-${slug(code)}-${index + 1}`,
      source: 'appendix-3',
      sourceName: 'Памятка заявителю исправленный 24 / регистрационное досье ЛС',
      group: groupForRecord(record),
      groupCode: record.dossier_section || code.split('.').slice(0, 2).join('.'),
      module: moduleLabel(record),
      code: record.display_code || record.normalized_code,
      name: record.title,
      description: conditionText(record),
      kind: 'document',
      direction: 'LS',
      acceptedFormats: inferFormats(record, oldItem),
      active: true,
      sortOrder: index + 1,
      requiredWhenExpression: 'param-object-type = "LS" AND param-procedure = "registration"',
      requirednessExplanation: conditionText(record),
      validationChecks: validationChecks(record).join(' | '),
      checkIds: inferCheckIds(record, oldItem),
      linkedApplicationParams: oldItem?.linkedApplicationParams?.length ? oldItem.linkedApplicationParams : ['param-object-type', 'param-procedure', 'param-dossier-type'],
      severityIfMissing: oldItem?.severityIfMissing || severity(record),
    };
    return item;
  });

  const requirementRules = memo.records.map((record, index) => {
    const item = items[index];
    const checks = validationChecks(record);
    return {
      id: `MEMO_LS_REG_${String(index + 1).padStart(4, '0')}`,
      scope_object_type: 'LS',
      scope_procedure: 'registration',
      doc_code: normalizeCode(record.normalized_code),
      document_type_id: item.id,
      document_name: record.title,
      row_type: 'Документ',
      upload_required: true,
      source_structure: 'Памятка заявителю / CTD',
      dossier_variant: 'ctd_foreign',
      module_part: moduleLabel(record),
      domestic_equivalent: null,
      required_document: (record.resolved_required_documentation || []).join('\n') || record.title,
      applicability: dbApplicability(record),
      show_logic: 'require_when_condition_true',
      condition_json: { all: [{ eq: ['param-object-type', 'LS'] }, { eq: ['param-procedure', 'registration'] }] },
      condition_text: conditionText(record),
      linked_params: item.linkedApplicationParams,
      activation_missing_params: [],
      recommended_params_for_validation: [],
      validation_checks: checks,
      normalization_status: checks.length ? 'ready_for_code' : 'needs_review',
      original_trigger_expression: 'param-object-type = "LS" AND param-procedure = "registration"',
      source_reference: 'Памятка заявителю исправленный 24.docx',
      confidence: 'source+normalized',
      normalization_notes: (record.quality_flags || []).join('; '),
      active: true,
      source: 'applicant-memo-24',
    };
  });

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    await ensureRuntimeSchema(pool);
    const currentAdmin = await pool.query(`SELECT data, created_at, updated_at FROM admin_runtime_config WHERE key = 'default' LIMIT 1`);
    await fs.writeFile(path.join(backup, 'db-admin-runtime-config-before-import.json'), JSON.stringify(currentAdmin.rows, null, 2), 'utf8');
    const currentRules = await pool.query(`SELECT * FROM document_requirement_rules WHERE scope_object_type = 'LS' AND scope_procedure = 'registration' ORDER BY id`);
    await fs.writeFile(path.join(backup, 'db-document-requirement-rules-before-import.json'), JSON.stringify(currentRules.rows, null, 2), 'utf8');

    const existingConfig = currentAdmin.rows[0]?.data && typeof currentAdmin.rows[0].data === 'object' ? currentAdmin.rows[0].data : {};
    const nextConfig = {
      documentTypes: Array.isArray(existingConfig.documentTypes) ? existingConfig.documentTypes : [],
      rules: Array.isArray(existingConfig.rules) ? existingConfig.rules : [],
      lsDossierDocumentTypes: items,
      npaRegistry: Array.isArray(existingConfig.npaRegistry) ? existingConfig.npaRegistry : [],
      updatedAt: new Date().toISOString(),
      updatedByUserId: 'system',
    };

    await pool.query('BEGIN');
    await pool.query(
      `INSERT INTO admin_runtime_config (key, data, created_by_user_id, updated_by_user_id, updated_at)
       VALUES ('default', $1::jsonb, 'system', 'system', now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_by_user_id = 'system', updated_at = now()`,
      [JSON.stringify(nextConfig)],
    );
    await pool.query(
      `INSERT INTO runtime_dictionaries (key, data, source, created_by_user_id, updated_by_user_id, updated_at)
       VALUES ('ls_dossier_document_types_new', $1::jsonb, 'applicant-memo-24', 'system', 'system', now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source, updated_by_user_id = 'system', updated_at = now()`,
      [JSON.stringify(items)],
    );
    await pool.query(
      `INSERT INTO runtime_dictionaries (key, data, source, created_by_user_id, updated_by_user_id, updated_at)
       VALUES ('applicant_memo_normalized_rules', $1::jsonb, 'applicant-memo-24', 'system', 'system', now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source, updated_by_user_id = 'system', updated_at = now()`,
      [JSON.stringify(memo)],
    );
    await pool.query(`DELETE FROM document_requirement_rules WHERE scope_object_type = 'LS' AND scope_procedure = 'registration'`);

    for (const rule of requirementRules) {
      await pool.query(
        `INSERT INTO document_requirement_rules (
          id, scope_object_type, scope_procedure, doc_code, document_type_id, document_name, row_type,
          upload_required, source_structure, dossier_variant, module_part, domestic_equivalent, required_document,
          applicability, show_logic, condition_json, condition_text, linked_params, activation_missing_params,
          recommended_params_for_validation, validation_checks, normalization_status, original_trigger_expression,
          source_reference, confidence, normalization_notes, active, source, updated_by_user_id, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,$22,$23,$24,$25,$26,$27,$28,'system',now()
        )`,
        [
          rule.id,
          rule.scope_object_type,
          rule.scope_procedure,
          rule.doc_code,
          rule.document_type_id,
          rule.document_name,
          rule.row_type,
          rule.upload_required,
          rule.source_structure,
          rule.dossier_variant,
          rule.module_part,
          rule.domestic_equivalent,
          rule.required_document,
          rule.applicability,
          rule.show_logic,
          JSON.stringify(rule.condition_json),
          rule.condition_text,
          JSON.stringify(rule.linked_params),
          JSON.stringify(rule.activation_missing_params),
          JSON.stringify(rule.recommended_params_for_validation),
          JSON.stringify(rule.validation_checks),
          rule.normalization_status,
          rule.original_trigger_expression,
          rule.source_reference,
          rule.confidence,
          rule.normalization_notes,
          rule.active,
          rule.source,
        ],
      );
    }

    await pool.query('COMMIT');
    const report = {
      importedDocumentTypes: items.length,
      importedRequirementRules: requirementRules.length,
      oldDbRequirementRules: currentRules.rows.length,
      backupDir: backup,
      databaseUrl: databaseUrl.replace(/:[^:@/]+@/, ':***@'),
    };
    await fs.writeFile(path.join(backup, 'applicant-memo-db-import-summary.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
