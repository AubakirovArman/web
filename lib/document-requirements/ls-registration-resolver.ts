import { ensureRuntimeSchema, getRuntimePool } from '@/lib/db/runtime-postgres';
import {
  inferLsRegistrationCheckIds,
  inferLsRegistrationExpectedFields,
} from '@/lib/document-requirements/ls-registration-check-mapping';
import { DocumentType, RequiredDoc, Severity } from '@/lib/types';
import { evaluateCondition } from '@/lib/rules/condition-evaluator';

type ApplicationValues = Record<string, unknown>;

interface DbRequirementRuleRow {
  id: string;
  doc_code: string;
  document_type_id: string | null;
  document_name: string;
  row_type: string | null;
  upload_required: boolean;
  source_structure: string | null;
  dossier_variant: string | null;
  module_part: string | null;
  required_document: string | null;
  applicability: string;
  show_logic: string;
  condition_json: unknown;
  condition_text: string | null;
  linked_params: unknown;
  activation_missing_params: unknown;
  recommended_params_for_validation: unknown;
  validation_checks: unknown;
  normalization_status: string;
  source_reference: string | null;
  confidence: string | null;
}

interface DocumentCheckProfileItem {
  id?: string;
  title?: string;
  check_text?: string;
  pass_criteria?: string;
  failure_criteria?: string;
  applicability_condition?: string;
  source_fragment?: string;
}

interface DocumentCheckProfile {
  source?: {
    source_code?: string;
    title?: string;
    document?: string;
  };
  required_checks?: DocumentCheckProfileItem[];
  conditional_checks?: DocumentCheckProfileItem[];
  cross_document_checks?: DocumentCheckProfileItem[];
  evaluation_notes?: string[];
}

interface CheckerRoutingRequirement {
  requirement_id?: string;
  requirement_text?: string;
  source_point?: string;
  check_target?: string[];
  checker_mode?: string;
  linked_application_fields?: string[];
  missing_application_fields?: string[];
  related_document_codes?: string[];
  applicability_gate_required?: boolean;
  aggregate_by_dossier_section_code?: boolean;
  expected_checker_inputs?: string[];
  implementation_buckets?: string[];
  decision_logic?: string;
  current_problem_from_audit?: string;
}

interface CheckerRoutingProfile {
  requirements?: CheckerRoutingRequirement[];
}

export interface ResolvedDocumentRequirementRule {
  ruleId: string;
  documentTypeId: string;
  docCode: string;
  documentName: string;
  applicability: string;
  conditionText?: string;
  linkedParams: string[];
  activationMissingParams: string[];
  validationChecks: string[];
  normalizationStatus: string;
  sourceReference?: string;
}

export interface ResolvedDocumentRequirements {
  source: 'db';
  requiredDocuments: RequiredDoc[];
  documentTypes: DocumentType[];
  resolvedRules: ResolvedDocumentRequirementRule[];
  databaseRulesCount: number;
  matchedRulesCount: number;
  diagnostics: string[];
}

export async function resolveLsRegistrationRequiredDocuments(values: ApplicationValues): Promise<ResolvedDocumentRequirements> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query<DbRequirementRuleRow>(`
    SELECT
      id,
      doc_code,
      document_type_id,
      document_name,
      row_type,
      upload_required,
      source_structure,
      dossier_variant,
      module_part,
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
      source_reference,
      confidence
    FROM document_requirement_rules
    WHERE active = true
      AND scope_object_type = 'LS'
      AND scope_procedure = 'registration'
    ORDER BY dossier_variant NULLS LAST, module_part NULLS LAST, doc_code NULLS LAST, id
  `);

  const requiredByDocumentType = new Map<string, RequiredDoc>();
  const documentTypesById = new Map<string, DocumentType>();
  const resolvedRules: ResolvedDocumentRequirementRule[] = [];
  const diagnostics: string[] = [];

  for (const rule of rows) {
    if (!rule.upload_required) continue;
    if (!evaluateCondition(rule.condition_json, values)) continue;

    const documentTypeId = rule.document_type_id || `db-rule-${rule.id}`;
    const validationChecks = asStringArray(rule.validation_checks);
    const linkedParams = asStringArray(rule.linked_params);
    const activationMissingParams = asStringArray(rule.activation_missing_params);
    const severity = severityForRule(rule);
    const checkIds = inferLsRegistrationCheckIds(rule);

    const existing = requiredByDocumentType.get(documentTypeId);
    if (existing) {
      existing.severityIfMissing = maxSeverity(existing.severityIfMissing, severity);
      existing.checks = unique([...(existing.checks || []), ...checkIds]);
    } else {
      requiredByDocumentType.set(documentTypeId, {
        documentTypeId,
        severityIfMissing: severity,
        checks: checkIds,
      });
    }

    if (!documentTypesById.has(documentTypeId)) {
      documentTypesById.set(documentTypeId, buildRuntimeDocumentType(rule, documentTypeId, validationChecks, linkedParams, checkIds));
    }

    resolvedRules.push({
      ruleId: rule.id,
      documentTypeId,
      docCode: rule.doc_code,
      documentName: rule.document_name,
      applicability: rule.applicability,
      conditionText: rule.condition_text || undefined,
      linkedParams,
      activationMissingParams,
      validationChecks,
      normalizationStatus: rule.normalization_status,
      sourceReference: rule.source_reference || undefined,
    });
  }

  if (rows.length === 0) {
    diagnostics.push('В БД нет правил document_requirement_rules для LS/registration.');
  }

  return {
    source: 'db',
    requiredDocuments: Array.from(requiredByDocumentType.values()),
    documentTypes: Array.from(documentTypesById.values()),
    resolvedRules,
    databaseRulesCount: rows.length,
    matchedRulesCount: resolvedRules.length,
    diagnostics,
  };
}

function buildRuntimeDocumentType(
  rule: DbRequirementRuleRow,
  documentTypeId: string,
  validationChecks: string[],
  linkedParams: string[],
  checkIds: string[],
): DocumentType {
  return {
    id: documentTypeId,
    name: rule.document_name || rule.required_document || rule.id,
    description: rule.required_document || rule.document_name,
    docCode: rule.doc_code,
    modulePart: rule.module_part || undefined,
    sourceStructure: rule.source_structure || undefined,
    dossierVariant: rule.dossier_variant || undefined,
    acceptedFormats: inferAcceptedFormats(rule),
    direction: 'LS',
    needsOcr: true,
    checkIds,
    npaReferences: rule.source_reference ? [rule.source_reference] : [],
    expectedExtractedFields: inferLsRegistrationExpectedFields(rule, checkIds),
    requirednessExplanation: rule.condition_text || undefined,
    requiredWhenExpression: rule.condition_text || undefined,
    linkedApplicationParams: linkedParams,
    severityIfMissing: severityForRule(rule),
    validationChecksText: validationChecks.join('\n'),
    importedRequirements: buildImportedRequirements(rule, validationChecks),
  };
}

function buildImportedRequirements(rule: DbRequirementRuleRow, validationChecks: string[]) {
  const profile = getDocumentCheckProfile(rule.condition_json);
  const routedRequirements = buildCheckerRoutingRequirements(rule);
  const baseRequirements = profile
    ? [
        ...buildProfileRequirements(rule, profile.required_checks || [], 'required'),
        ...buildProfileRequirements(rule, profile.conditional_checks || [], 'conditional'),
        ...buildProfileRequirements(rule, profile.cross_document_checks || [], 'cross_document'),
      ]
    : buildFallbackImportedRequirements(rule, validationChecks);

  return mergeImportedRequirements(baseRequirements, routedRequirements);
}

function buildFallbackImportedRequirements(rule: DbRequirementRuleRow, validationChecks: string[]) {
  const checks = validationChecks.length ? validationChecks : [rule.required_document || rule.document_name];
  return checks.map((check, index) => ({
    id: `${rule.id}-db-requirement-${index + 1}`,
    source: 'manual' as const,
    sourceDocumentCode: rule.doc_code,
    sourceDocumentName: rule.document_name,
    procedure: 'registration',
    requirementText: check,
    criticality: severityForRule(rule),
    applicabilityCondition: rule.condition_text || undefined,
    sourcePoint: rule.doc_code || undefined,
    importedAt: new Date().toISOString(),
  }));
}

function buildCheckerRoutingRequirements(rule: DbRequirementRuleRow) {
  const routing = getCheckerRouting(rule.condition_json);
  if (!routing?.requirements?.length) return [];

  return routing.requirements
    .map((item, index) => {
      const text = String(item.requirement_text || '').trim();
      if (!text) return null;
      const checkTarget = asStringArray(item.check_target);
      const checkerMode = String(item.checker_mode || checkTarget.join('+') || 'document_content').trim();
      // Кросс-проверки (сверка со смежными разделами) — вторичные консистентности:
      // их частый провал — отсутствие смежного раздела в пакете, а не дефект самого
      // документа. Не эскалируем до critical, понижаем до warning (требует уточнения).
      const isCrossDocument = checkTarget.includes('related_documents') || /related_documents/.test(checkerMode);
      return {
        id: String(item.requirement_id || `${rule.id}-checker-routing-${index + 1}`),
        source: 'manual' as const,
        sourceDocumentCode: rule.doc_code,
        sourceDocumentName: rule.document_name,
        procedure: 'registration',
        checkSubject: rule.document_name,
        checkType: checkerMode,
        requirementText: text,
        criticality: item.applicability_gate_required || isCrossDocument ? 'warning' : severityForRule(rule),
        applicabilityCondition: item.applicability_gate_required
          ? item.decision_logic || rule.condition_text || 'Сначала проверить применимость требования.'
          : rule.condition_text || undefined,
        sourcePoint: item.source_point || rule.source_reference || rule.doc_code,
        quote: item.current_problem_from_audit || text,
        importedAt: new Date().toISOString(),
        checkerMode,
        checkTarget,
        linkedApplicationFields: asStringArray(item.linked_application_fields),
        missingApplicationFields: asStringArray(item.missing_application_fields),
        relatedDocumentCodes: asStringArray(item.related_document_codes),
        expectedCheckerInputs: asStringArray(item.expected_checker_inputs),
        applicabilityGateRequired: item.applicability_gate_required === true,
        aggregateByDossierSectionCode: item.aggregate_by_dossier_section_code === true,
        decisionLogic: item.decision_logic,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function getCheckerRouting(conditionJson: unknown): CheckerRoutingProfile | undefined {
  if (!conditionJson || typeof conditionJson !== 'object') return undefined;
  const routing = (conditionJson as Record<string, unknown>).checker_routing;
  if (!routing || typeof routing !== 'object') return undefined;
  const typed = routing as CheckerRoutingProfile;
  return Array.isArray(typed.requirements) && typed.requirements.length > 0 ? typed : undefined;
}

function mergeImportedRequirements<T extends ReturnType<typeof buildFallbackImportedRequirements>[number]>(baseRequirements: T[], routedRequirements: T[]) {
  const byKey = new Map<string, T>();
  for (const requirement of baseRequirements) byKey.set(requirementKey(requirement), requirement);
  for (const requirement of routedRequirements) byKey.set(requirementKey(requirement), requirement);
  return Array.from(byKey.values());
}

function requirementKey(requirement: { sourceDocumentCode?: string; requirementText?: string }) {
  return [
    normalizeRequirementText(requirement.sourceDocumentCode),
    normalizeRequirementText(requirement.requirementText),
  ].join('|');
}

function normalizeRequirementText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/р/g, 'p')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();
}

function getDocumentCheckProfile(conditionJson: unknown): DocumentCheckProfile | undefined {
  if (!conditionJson || typeof conditionJson !== 'object') return undefined;
  const profile = (conditionJson as Record<string, unknown>).document_check_profile;
  if (!profile || typeof profile !== 'object') return undefined;
  const typed = profile as DocumentCheckProfile;
  const hasChecks =
    (Array.isArray(typed.required_checks) && typed.required_checks.length > 0) ||
    (Array.isArray(typed.conditional_checks) && typed.conditional_checks.length > 0) ||
    (Array.isArray(typed.cross_document_checks) && typed.cross_document_checks.length > 0);
  return hasChecks ? typed : undefined;
}

function buildProfileRequirements(
  rule: DbRequirementRuleRow,
  checks: DocumentCheckProfileItem[],
  checkType: 'required' | 'conditional' | 'cross_document',
) {
  return checks
    .map((check, index) => {
      const text = String(check.check_text || check.title || '').trim();
      if (!text) return null;
      const stableId = String(check.id || `${checkType}-${index + 1}`).replace(/[^a-zA-Z0-9_-]+/g, '_');
      return {
        id: `${rule.id}-profile-${checkType}-${stableId}`,
        source: 'manual' as const,
        sourceDocumentCode: rule.doc_code,
        sourceDocumentName: rule.document_name,
        procedure: 'registration',
        checkSubject: rule.document_name,
        checkType,
        requirementText: text,
        criticality: checkType === 'required' ? severityForRule(rule) : 'warning',
        applicabilityCondition: checkType === 'conditional' || checkType === 'cross_document'
          ? check.applicability_condition || 'Применяется только при выполнении условия из профиля проверки.'
          : undefined,
        sourcePoint: `${rule.doc_code}${check.title ? ` / ${check.title}` : ''}`,
        quote: check.source_fragment || check.pass_criteria || check.failure_criteria || text,
        importedAt: new Date().toISOString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

/*
 * The legacy implementation below was intentionally replaced by the merged
 * document_check_profile + checker_routing builder above. Keep helpers below
 * focused on formats, severity and condition evaluation.
 */
/*
  if (profile) {
    return [
      ...buildProfileRequirements(rule, profile.required_checks || [], 'required'),
      ...buildProfileRequirements(rule, profile.conditional_checks || [], 'conditional'),
      ...buildProfileRequirements(rule, profile.cross_document_checks || [], 'cross_document'),
    ];
  }

  const checks = validationChecks.length ? validationChecks : [rule.required_document || rule.document_name];
  return checks.map((check, index) => ({
    id: `${rule.id}-db-requirement-${index + 1}`,
    source: 'manual' as const,
    sourceDocumentCode: rule.doc_code,
    sourceDocumentName: rule.document_name,
    procedure: 'registration',
    requirementText: check,
    criticality: severityForRule(rule),
    applicabilityCondition: rule.condition_text || undefined,
    sourcePoint: rule.doc_code || undefined,
    importedAt: new Date().toISOString(),
  }));
}
*/

function inferAcceptedFormats(rule: DbRequirementRuleRow) {
  const text = `${rule.document_name} ${rule.required_document || ''}`.toLowerCase();
  if (text.includes('макет') || text.includes('jpeg') || text.includes('jpg') || text.includes('этикет')) {
    return ['jpg', 'jpeg', 'png'];
  }
  if (text.includes('таблиц') || text.includes('excel') || text.includes('xls')) {
    return ['xls', 'xlsx', 'pdf'];
  }
  return ['pdf', 'doc', 'docx'];
}

function severityForRule(rule: DbRequirementRuleRow): Severity {
  if (rule.normalization_status === 'needs_param' || rule.applicability === 'expert_if_applicable') return 'warning';
  if (rule.normalization_status === 'needs_review') return 'warning';
  if (rule.applicability === 'always_required' || rule.applicability === 'conditional_required') return 'critical';
  return 'warning';
}

function maxSeverity(left: Severity, right: Severity): Severity {
  const rank: Record<Severity, number> = { critical: 4, serious: 3, warning: 2, unknown: 1 };
  return rank[right] > rank[left] ? right : left;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch {
      return value.split('\n').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}