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
const oldRulesPath = path.join(webRoot, 'lib/data/generated/ls-registration-document-rules.json');

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

function baseCode(value) {
  return normalizeCode(value).replace(/\.SUB\d+$/i, '');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

const STOP_WORDS = new Set([
  'документ',
  'документа',
  'документы',
  'требуемая',
  'документация',
  'наличие',
  'условия',
  'применимость',
  'если',
  'при',
  'для',
  'или',
  'и',
  'с',
  'на',
  'по',
  'об',
  'от',
  'к',
  'в',
  'лекарственного',
  'лекарственный',
  'препарата',
]);

function candidateText(rule) {
  return [
    rule.required_document,
    rule.document_name,
    rule.when_required_source_text,
    ...(Array.isArray(rule.validation_checks) ? rule.validation_checks : []),
  ].filter(Boolean).join(' ');
}

function rowText(row) {
  const validationChecks = Array.isArray(row.validation_checks)
    ? row.validation_checks
    : typeof row.validation_checks === 'string'
      ? [row.validation_checks]
      : [];
  return [
    row.required_document,
    row.document_name,
    row.condition_text,
    ...validationChecks,
  ].filter(Boolean).join(' ');
}

function textMatches(row, rule) {
  const haystack = normalizeText(rowText(row));
  const needle = normalizeText(candidateText(rule));
  if (!haystack || !needle) return false;
  if (haystack.includes(needle.slice(0, 90))) return true;
  if (needle.includes(haystack.slice(0, 90))) return true;

  const rowWords = new Set(words(haystack));
  const ruleWords = words(needle);
  if (ruleWords.length === 0) return false;
  const hits = ruleWords.filter((word) => rowWords.has(word)).length;
  return hits >= 4 && hits / Math.min(ruleWords.length, 18) >= 0.32;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split('\n').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = typeof value === 'string' ? value : JSON.stringify(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function selectRulesForRow(row, rulesByBase) {
  const candidates = rulesByBase.get(baseCode(row.doc_code)) || [];
  if (candidates.length <= 1) return candidates;

  const matched = candidates.filter((rule) => textMatches(row, rule));
  if (matched.length > 0) return matched;

  const exact = candidates.filter((rule) => normalizeCode(rule.doc_code) === normalizeCode(row.doc_code));
  return exact.length ? exact : candidates;
}

function preserveProfile(nextCondition, existingCondition) {
  const existing = existingCondition && typeof existingCondition === 'object' ? existingCondition : {};
  const preserved = {};
  for (const key of ['document_check_profile', 'document_check_profile_updated_at']) {
    if (existing[key]) preserved[key] = existing[key];
  }
  return Object.keys(preserved).length ? { ...nextCondition, ...preserved } : nextCondition;
}

function mergeCondition(selected, existingCondition) {
  const conditions = selected.map((rule) => rule.condition).filter((condition) => condition && typeof condition === 'object');
  const next = conditions.length === 0
    ? { all: [{ eq: ['param-object-type', 'LS'] }, { eq: ['param-procedure', 'registration'] }] }
    : conditions.length === 1
      ? conditions[0]
      : { any: conditions };
  return preserveProfile(next, existingCondition);
}

function mergeConditionText(selected) {
  const parts = unique(selected.map((rule) => rule.condition_text).filter(Boolean));
  return parts.length <= 1 ? (parts[0] || '') : parts.map((part) => `(${part})`).join(' OR ');
}

function mergeApplicability(selected, current) {
  const values = selected.map((rule) => rule.applicability).filter(Boolean);
  if (values.includes('always_required')) return 'always_required';
  if (values.includes('conditional_required')) return 'conditional_required';
  if (values.includes('needs_new_param')) return 'needs_new_param';
  if (values.includes('expert_if_applicable')) return 'expert_if_applicable';
  return current;
}

function mergeShowLogic(selected, current) {
  const values = selected.map((rule) => rule.show_logic).filter(Boolean);
  if (values.includes('require_when_condition_true')) return 'require_when_condition_true';
  if (values.includes('require_when_condition_true_after_param_added')) return 'require_when_condition_true_after_param_added';
  if (values.includes('show_as_conditional_expert')) return 'show_as_conditional_expert';
  return current;
}

function mergeNormalizationStatus(selected, current) {
  const values = selected.map((rule) => rule.normalization_status).filter(Boolean);
  if (values.includes('needs_param')) return 'needs_param';
  if (values.includes('needs_review')) return 'needs_review';
  if (values.includes('ready_for_code')) return 'ready_for_code';
  return current;
}

async function main() {
  const old = JSON.parse(await fs.readFile(oldRulesPath, 'utf8'));
  const oldRules = Array.isArray(old.rules) ? old.rules : [];
  const excludedCodes = new Set((Array.isArray(old.excluded_not_registration) ? old.excluded_not_registration : []).map((item) => baseCode(item.doc_code)).filter(Boolean));
  const rulesByBase = new Map();
  for (const rule of oldRules) {
    const key = baseCode(rule.doc_code);
    if (!key) continue;
    if (!rulesByBase.has(key)) rulesByBase.set(key, []);
    rulesByBase.get(key).push(rule);
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const backupDir = path.join(root, 'backups', `ls-registration-condition-mapping-${Date.now()}`);
  await fs.mkdir(backupDir, { recursive: true });

  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM document_requirement_rules
      WHERE scope_object_type = 'LS'
        AND scope_procedure = 'registration'
        AND active = true
      ORDER BY doc_code, id
    `);
    await fs.writeFile(path.join(backupDir, 'document_requirement_rules-before-condition-mapping.json'), JSON.stringify(rows, null, 2), 'utf8');

    const updates = [];
    const unmatched = [];
    const deactivated = [];
    for (const row of rows) {
      if (excludedCodes.has(baseCode(row.doc_code))) {
        deactivated.push({ id: row.id, doc_code: row.doc_code, reason: 'excluded_not_registration' });
        continue;
      }
      const selected = selectRulesForRow(row, rulesByBase);
      if (selected.length === 0) {
        unmatched.push({ id: row.id, doc_code: row.doc_code, document_type_id: row.document_type_id, document_name: row.document_name });
        continue;
      }

      updates.push({
        id: row.id,
        doc_code: row.doc_code,
        document_type_id: row.document_type_id,
        selected_rule_ids: selected.map((rule) => rule.rule_id),
        selected_doc_codes: selected.map((rule) => rule.doc_code),
        condition_json: mergeCondition(selected, row.condition_json),
        condition_text: mergeConditionText(selected) || row.condition_text,
        linked_params: unique(selected.flatMap((rule) => asArray(rule.linked_params))),
        activation_missing_params: unique(selected.flatMap((rule) => asArray(rule.activation_missing_params))),
        recommended_params_for_validation: unique(selected.flatMap((rule) => asArray(rule.recommended_params_for_validation))),
        applicability: mergeApplicability(selected, row.applicability),
        show_logic: mergeShowLogic(selected, row.show_logic),
        normalization_status: mergeNormalizationStatus(selected, row.normalization_status),
        original_trigger_expression: unique(selected.map((rule) => rule.original_trigger_expression).filter(Boolean)).join(' OR ') || row.original_trigger_expression,
        source_reference: unique(selected.map((rule) => rule.source_reference).filter(Boolean)).join('; ') || row.source_reference,
        confidence: unique(selected.map((rule) => rule.confidence).filter(Boolean)).join('; ') || row.confidence,
      });
    }

    await fs.writeFile(path.join(backupDir, 'condition-mapping-plan.json'), JSON.stringify({ updates, unmatched, deactivated }, null, 2), 'utf8');

    await pool.query('BEGIN');
    for (const update of updates) {
      await pool.query(
        `
          UPDATE document_requirement_rules
          SET
            applicability = $2,
            show_logic = $3,
            condition_json = $4::jsonb,
            condition_text = $5,
            linked_params = $6::jsonb,
            activation_missing_params = $7::jsonb,
            recommended_params_for_validation = $8::jsonb,
            normalization_status = $9,
            original_trigger_expression = $10,
            source_reference = $11,
            confidence = $12,
            normalization_notes = concat_ws('; ', nullif(normalization_notes, ''), $13::text),
            source = 'applicant-memo-24+ls-registration-condition-matrix',
            updated_by_user_id = 'system',
            updated_at = now()
          WHERE id = $1
        `,
        [
          update.id,
          update.applicability,
          update.show_logic,
          JSON.stringify(update.condition_json),
          update.condition_text,
          JSON.stringify(update.linked_params),
          JSON.stringify(update.activation_missing_params),
          JSON.stringify(update.recommended_params_for_validation),
          update.normalization_status,
          update.original_trigger_expression,
          update.source_reference,
          update.confidence,
          `condition mapping from old LS registration matrix: ${update.selected_rule_ids.join(', ')}`,
        ],
      );
    }
    for (const item of deactivated) {
      await pool.query(
        `
          UPDATE document_requirement_rules
          SET active = false,
              normalization_notes = concat_ws('; ', nullif(normalization_notes, ''), 'deactivated for LS/registration: excluded_not_registration'),
              updated_by_user_id = 'system',
              updated_at = now()
          WHERE id = $1
        `,
        [item.id],
      );
    }
    await pool.query('COMMIT');

    const report = {
      oldRules: oldRules.length,
      dbRows: rows.length,
      updated: updates.length,
      unmatched: unmatched.length,
      deactivated: deactivated.length,
      backupDir,
      multiRuleRows: updates.filter((item) => item.selected_rule_ids.length > 1).length,
      databaseUrl: databaseUrl.replace(/:[^:@/]+@/, ':***@'),
    };
    await fs.writeFile(path.join(backupDir, 'condition-mapping-summary.json'), JSON.stringify(report, null, 2), 'utf8');
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
