import type { DocumentType, Rule } from '@/lib/types';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { ensureRuntimeSchema, getRuntimePool, normalizeRuntimeUserId, sanitizeJsonForPostgres } from '@/lib/db/runtime-postgres';

export interface AdminRuntimeConfig {
  documentTypes: DocumentType[];
  rules: Rule[];
  lsDossierDocumentTypes: NewDossierDocumentType[];
  npaRegistry: AdminNpaRecord[];
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
}

export type NpaRequirementAction = 'accepted' | 'rejected';

export interface AdminNpaRequirement {
  id: string;
  code: string;
  point: string;
  requirement: string;
  criticality: string;
  action: NpaRequirementAction;
  documentCode: string;
  documentName: string;
  checkType: string;
  condition: string;
  quote: string;
  targetDocumentTypeId?: string;
}

export interface AdminNpaRecord {
  id: string;
  name: string;
  actType: string;
  number: string;
  date: string;
  revision: string;
  fileName?: string;
  fileSize?: number;
  area?: string;
  requirements: AdminNpaRequirement[];
  createdAt: string;
}

function normalizeDocumentTypes(value: unknown): DocumentType[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is Partial<DocumentType> => Boolean(item) && typeof item === 'object')
    .map((item): DocumentType => ({
      ...item,
      id: typeof item.id === 'string' ? item.id : '',
      name: typeof item.name === 'string' ? item.name : '',
      acceptedFormats: Array.isArray(item.acceptedFormats) ? item.acceptedFormats.map(String).filter(Boolean) : ['pdf'],
      direction: item.direction === 'LS' || item.direction === 'MI' || item.direction === 'both' ? item.direction : 'both',
      importedRequirements: Array.isArray(item.importedRequirements) ? item.importedRequirements : [],
    }))
    .filter((item) => Boolean(item.id && item.name));

  return normalized;
}

function normalizeRules(value: unknown): Rule[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is Partial<Rule> => Boolean(item) && typeof item === 'object')
    .map((item): Rule => ({
      id: typeof item.id === 'string' ? item.id : '',
      name: typeof item.name === 'string' ? item.name : '',
      conditions: Array.isArray(item.conditions) ? item.conditions : [],
      requiredDocuments: Array.isArray(item.requiredDocuments) ? item.requiredDocuments : [],
      sourceNpaId: item.sourceNpaId,
      sources: Array.isArray(item.sources) ? item.sources : undefined,
      active: item.active ?? true,
    }))
    .filter((item) => Boolean(item.id && item.name));

  return normalized;
}

function normalizeLsDossierDocumentTypes(value: unknown): NewDossierDocumentType[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is Partial<NewDossierDocumentType> => Boolean(item) && typeof item === 'object')
    .map((item): NewDossierDocumentType => ({
      id: typeof item.id === 'string' ? item.id : '',
      source: item.source === 'appendix-2' || item.source === 'appendix-3' ? item.source : 'appendix-3',
      sourceName: typeof item.sourceName === 'string' ? item.sourceName : '',
      group: typeof item.group === 'string' ? item.group : '',
      groupCode: typeof item.groupCode === 'string' ? item.groupCode : '',
      module: typeof item.module === 'string' ? item.module : '',
      code: typeof item.code === 'string' ? item.code : '',
      name: typeof item.name === 'string' ? item.name : '',
      description: typeof item.description === 'string' ? item.description : '',
      kind: item.kind === 'section' || item.kind === 'document' || item.kind === 'excluded' ? item.kind : 'document',
      direction: item.direction === 'LS' || item.direction === 'MI' ? item.direction : 'LS',
      acceptedFormats: Array.isArray(item.acceptedFormats) ? item.acceptedFormats.map(String).filter(Boolean) : ['pdf'],
      active: item.active ?? true,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      requiredWhenExpression: typeof item.requiredWhenExpression === 'string' ? item.requiredWhenExpression : undefined,
      requirednessExplanation: typeof item.requirednessExplanation === 'string' ? item.requirednessExplanation : undefined,
      validationChecks: typeof item.validationChecks === 'string' ? item.validationChecks : undefined,
      npaReferences: Array.isArray(item.npaReferences) ? item.npaReferences.map(String).filter(Boolean) : undefined,
      requirementSources: Array.isArray(item.requirementSources)
        ? item.requirementSources
            .filter((source) => source && typeof source === 'object')
            .map((source: any) => ({
              index: Number(source.index) || 0,
              checkText: String(source.checkText || ''),
              sourceReference: String(source.sourceReference || ''),
              sourceStatus: source.sourceStatus ? String(source.sourceStatus) : undefined,
              sourceTag: source.sourceTag ? String(source.sourceTag) : undefined,
              sourceFiles: Array.isArray(source.sourceFiles) ? source.sourceFiles.map(String).filter(Boolean) : undefined,
              sourceNote: source.sourceNote ? String(source.sourceNote) : undefined,
            }))
            .filter((source) => source.index > 0 && source.sourceReference)
        : undefined,
      checkIds: Array.isArray(item.checkIds) ? item.checkIds.map(String).filter(Boolean) : undefined,
      linkedApplicationParams: Array.isArray(item.linkedApplicationParams)
        ? item.linkedApplicationParams.map(String).filter(Boolean)
        : undefined,
      severityIfMissing:
        item.severityIfMissing === 'critical' ||
        item.severityIfMissing === 'serious' ||
        item.severityIfMissing === 'warning' ||
        item.severityIfMissing === 'unknown'
          ? item.severityIfMissing
          : undefined,
    }))
    .filter((item) => Boolean(item.id && item.name));

  return normalized;
}

function normalizeNpaRequirement(value: unknown, index: number): AdminNpaRequirement {
  const source = value && typeof value === 'object' ? (value as Partial<AdminNpaRequirement>) : {};
  return {
    id: typeof source.id === 'string' && source.id ? source.id : `req-${index + 1}`,
    code: typeof source.code === 'string' ? source.code : '',
    point: typeof source.point === 'string' ? source.point : '',
    requirement: typeof source.requirement === 'string' ? source.requirement : `Требование ${index + 1}`,
    criticality: typeof source.criticality === 'string' ? source.criticality : 'неясно',
    action: source.action === 'rejected' ? 'rejected' : 'accepted',
    documentCode: typeof source.documentCode === 'string' ? source.documentCode : '',
    documentName: typeof source.documentName === 'string' ? source.documentName : '',
    checkType: typeof source.checkType === 'string' ? source.checkType : '',
    condition: typeof source.condition === 'string' ? source.condition : '',
    quote: typeof source.quote === 'string' ? source.quote : '',
    targetDocumentTypeId: typeof source.targetDocumentTypeId === 'string' ? source.targetDocumentTypeId : undefined,
  };
}

function inferActTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('решение совета')) return 'Решение Совета ЕЭК';
  if (lower.includes('решение коллегии')) return 'Решение Коллегии ЕЭК';
  if (lower.includes('кодекс')) return 'Кодекс РК';
  if (lower.includes('приказ')) return 'Приказ';
  return 'Иное';
}

function normalizeNpaRegistry(value: unknown): AdminNpaRecord[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is Partial<AdminNpaRecord> => Boolean(item) && typeof item === 'object')
    .map((item, index): AdminNpaRecord => ({
      id: typeof item.id === 'string' && item.id ? item.id : `npa-${index + 1}`,
      name: typeof item.name === 'string' ? item.name : `НПА ${index + 1}`,
      actType: typeof item.actType === 'string' ? item.actType : inferActTypeFromName(String(item.name || '')),
      number: typeof item.number === 'string' ? item.number : '',
      date: typeof item.date === 'string' ? item.date : '',
      revision: typeof item.revision === 'string' ? item.revision : '',
      fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
      fileSize: typeof item.fileSize === 'number' ? item.fileSize : undefined,
      area: typeof item.area === 'string' ? item.area : undefined,
      requirements: Array.isArray(item.requirements)
        ? item.requirements.map((requirement, requirementIndex) => normalizeNpaRequirement(requirement, requirementIndex))
        : [],
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }))
    .filter((item) => Boolean(item.id && item.name));

  return normalized;
}

export function normalizeAdminRuntimeConfig(value: unknown): AdminRuntimeConfig {
  const source = value && typeof value === 'object' ? (value as Partial<AdminRuntimeConfig>) : {};
  return {
    documentTypes: normalizeDocumentTypes(source.documentTypes),
    rules: normalizeRules(source.rules),
    lsDossierDocumentTypes: normalizeLsDossierDocumentTypes(source.lsDossierDocumentTypes),
    npaRegistry: normalizeNpaRegistry(source.npaRegistry),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    createdByUserId: typeof source.createdByUserId === 'string' ? source.createdByUserId : undefined,
    updatedByUserId: typeof source.updatedByUserId === 'string' ? source.updatedByUserId : undefined,
  };
}

export async function readAdminRuntimeConfig(): Promise<AdminRuntimeConfig> {
  return readAdminRuntimeConfigFromPostgres();
}

async function readAdminRuntimeConfigFromPostgres(): Promise<AdminRuntimeConfig> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const result = await pool.query(
    `
      SELECT data, created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM admin_runtime_config
      WHERE key = 'default'
      LIMIT 1
    `
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    const config = normalizeAdminRuntimeConfig({
      ...(row.data || {}),
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      updatedAt: row.data?.updatedAt || row.updated_at?.toISOString?.() || row.updated_at,
    });
    const dbTypes = await readLsRegistrationDocumentTypesFromPostgres();
    if (dbTypes.documentTypes.length === 0) {
      throw new Error('Postgres document_requirement_rules has no active LS/registration document types. Local fallback is disabled.');
    }
    return {
      ...config,
      documentTypes: dbTypes.documentTypes,
      lsDossierDocumentTypes: dbTypes.lsDossierDocumentTypes,
    };
  }

  throw new Error('Admin runtime config is missing in Postgres. Run the database import before starting the app.');
}

interface DbDocumentRequirementRule {
  id: string;
  doc_code: string;
  document_type_id: string | null;
  document_name: string;
  row_type: string | null;
  source_structure: string | null;
  dossier_variant: string | null;
  module_part: string | null;
  required_document: string | null;
  applicability: string;
  show_logic: string;
  condition_text: string | null;
  linked_params: unknown;
  validation_checks: unknown;
  condition_json: any;
  normalization_status: string;
  source_reference: string | null;
  active: boolean;
}

async function readLsRegistrationDocumentTypesFromPostgres(): Promise<{
  documentTypes: DocumentType[];
  lsDossierDocumentTypes: NewDossierDocumentType[];
}> {
  const pool = getRuntimePool();
  const { rows } = await pool.query<DbDocumentRequirementRule>(`
    SELECT
      id,
      doc_code,
      document_type_id,
      document_name,
      row_type,
      source_structure,
      dossier_variant,
      module_part,
      required_document,
      applicability,
      show_logic,
      condition_text,
      linked_params,
      validation_checks,
      condition_json,
      normalization_status,
      source_reference,
      active
    FROM document_requirement_rules
    WHERE scope_object_type = 'LS'
      AND scope_procedure = 'registration'
      AND active = true
    ORDER BY dossier_variant NULLS LAST, module_part NULLS LAST, doc_code NULLS LAST, id
  `);

  const lsDossierDocumentTypes = rows.map((rule, index) => buildAdminDossierDocumentType(rule, index + 1));
  const documentTypes = rows.map((rule) => buildAdminDocumentType(rule));
  return { documentTypes, lsDossierDocumentTypes };
}

function buildAdminDossierDocumentType(rule: DbDocumentRequirementRule, sortOrder: number): NewDossierDocumentType {
  const source = inferNewDossierSource(rule);
  const module = rule.module_part || moduleFromCode(rule.doc_code) || (source === 'appendix-2' ? 'Приложение 2' : 'Приложение 3');
  const name = rule.required_document || rule.document_name || rule.doc_code;
  const requirementSources = extractRequirementSources(rule);
  return {
    id: documentTypeIdForRule(rule),
    source,
    sourceName: source === 'appendix-2'
      ? 'Приложение 2. Регистрационное досье ЛС'
      : 'Приложение 3. Регистрационное досье ЛС по CTD',
    group: module,
    groupCode: module,
    module,
    code: rule.doc_code,
    name,
    description: rule.document_name || name,
    kind: rule.row_type === 'section' ? 'section' : 'document',
    direction: 'LS',
    acceptedFormats: inferAcceptedFormats(rule),
    active: rule.active,
    sortOrder,
    requiredWhenExpression: rule.condition_text || rule.show_logic || undefined,
    requirednessExplanation: rule.condition_text || rule.applicability || undefined,
    validationChecks: asStringArray(rule.validation_checks).join(' | '),
    npaReferences: rule.source_reference ? [rule.source_reference] : undefined,
    requirementSources,
    checkIds: ['required_document_presence_check', 'file_format_check', 'ocr_quality_check'],
    linkedApplicationParams: asStringArray(rule.linked_params),
    severityIfMissing: rule.applicability === 'always_required' || rule.applicability === 'conditional_required' ? 'critical' : 'warning',
  };
}

function buildAdminDocumentType(rule: DbDocumentRequirementRule): DocumentType {
  const validationChecks = asStringArray(rule.validation_checks);
  const requirementSources = extractRequirementSources(rule) || [];
  const importedRequirements = buildAdminImportedRequirements(rule, validationChecks, requirementSources);
  return {
    id: documentTypeIdForRule(rule),
    name: rule.required_document || rule.document_name || rule.doc_code,
    description: rule.document_name,
    docCode: rule.doc_code,
    modulePart: rule.module_part || undefined,
    sourceStructure: rule.source_structure || undefined,
    dossierVariant: rule.dossier_variant || undefined,
    acceptedFormats: inferAcceptedFormats(rule),
    direction: 'LS',
    needsOcr: true,
    checkIds: ['required_document_presence_check', 'file_format_check', 'ocr_quality_check'],
    npaReferences: rule.source_reference ? [rule.source_reference] : [],
    requirednessExplanation: rule.condition_text || undefined,
    requiredWhenExpression: rule.condition_text || undefined,
    linkedApplicationParams: asStringArray(rule.linked_params),
    severityIfMissing: rule.applicability === 'always_required' || rule.applicability === 'conditional_required' ? 'critical' : 'warning',
    validationChecksText: validationChecks.join('\n'),
    importedRequirements,
  };
}

function buildAdminImportedRequirements(
  rule: DbDocumentRequirementRule,
  validationChecks: string[],
  requirementSources: NonNullable<NewDossierDocumentType['requirementSources']>,
): DocumentType['importedRequirements'] {
  const base = validationChecks.map((check, index) => ({
    id: `${rule.id}-admin-requirement-${index + 1}`,
    source: 'manual' as const,
    sourceDocumentCode: rule.doc_code,
    sourceDocumentName: rule.document_name,
    procedure: 'registration',
    checkSubject: rule.document_name,
    checkType: 'required',
    requirementText: check,
    criticality: rule.applicability === 'always_required' || rule.applicability === 'conditional_required' ? 'critical' : 'warning',
    applicabilityCondition: rule.condition_text || undefined,
    sourcePoint: requirementSources[index]?.sourceReference || rule.source_reference || rule.doc_code,
    importedAt: new Date().toISOString(),
  }));

  const routing = rule.condition_json?.checker_routing;
  const routed = Array.isArray(routing?.requirements)
    ? routing.requirements
        .filter((item: any) => String(item?.requirement_text || '').trim())
        .map((item: any, index: number) => ({
          id: String(item.requirement_id || `${rule.id}-checker-routing-${index + 1}`),
          source: 'manual' as const,
          sourceDocumentCode: rule.doc_code,
          sourceDocumentName: rule.document_name,
          procedure: 'registration',
          checkSubject: rule.document_name,
          checkType: String(item.checker_mode || 'document_content'),
          requirementText: String(item.requirement_text || '').trim(),
          criticality: item.applicability_gate_required ? 'warning' : rule.applicability === 'always_required' || rule.applicability === 'conditional_required' ? 'critical' : 'warning',
          applicabilityCondition: item.applicability_gate_required
            ? String(item.decision_logic || rule.condition_text || 'Сначала проверить применимость требования.')
            : rule.condition_text || undefined,
          sourcePoint: String(item.source_point || rule.source_reference || rule.doc_code),
          quote: String(item.current_problem_from_audit || item.requirement_text || ''),
          importedAt: new Date().toISOString(),
          checkerMode: String(item.checker_mode || 'document_content'),
          checkTarget: asStringArray(item.check_target),
          linkedApplicationFields: asStringArray(item.linked_application_fields),
          missingApplicationFields: asStringArray(item.missing_application_fields),
          relatedDocumentCodes: asStringArray(item.related_document_codes),
          expectedCheckerInputs: asStringArray(item.expected_checker_inputs),
          applicabilityGateRequired: item.applicability_gate_required === true,
          aggregateByDossierSectionCode: item.aggregate_by_dossier_section_code === true,
          decisionLogic: item.decision_logic ? String(item.decision_logic) : undefined,
        }))
    : [];

  return mergeAdminImportedRequirements([...base, ...routed]);
}

function mergeAdminImportedRequirements(requirements: NonNullable<DocumentType['importedRequirements']>) {
  const byKey = new Map<string, NonNullable<DocumentType['importedRequirements']>[number]>();
  for (const requirement of requirements) {
    byKey.set([
      normalizeAdminRequirementText(requirement.sourceDocumentCode),
      normalizeAdminRequirementText(requirement.requirementText),
    ].join('|'), requirement);
  }
  return Array.from(byKey.values());
}

function normalizeAdminRequirementText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/р/g, 'p')
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '')
    .trim();
}

function documentTypeIdForRule(rule: DbDocumentRequirementRule) {
  return rule.document_type_id || `db-rule-${rule.id}`;
}

function inferNewDossierSource(rule: DbDocumentRequirementRule): NewDossierDocumentType['source'] {
  const text = `${rule.source_structure || ''} ${rule.dossier_variant || ''} ${rule.module_part || ''}`.toLowerCase();
  if (text.includes('приложение 2') || text.includes('appendix-2') || text.includes('national')) return 'appendix-2';
  return 'appendix-3';
}

function moduleFromCode(code: string) {
  const trimmed = code.trim();
  if (/^1(\.|$)/.test(trimmed)) return 'Модуль 1';
  if (/^2(\.|$)/.test(trimmed)) return 'Модуль 2';
  if (/^3(\.|$)/.test(trimmed)) return 'Модуль 3';
  if (/^4(\.|$)/.test(trimmed)) return 'Модуль 4';
  if (/^5(\.|$)/.test(trimmed)) return 'Модуль 5';
  return '';
}

function inferAcceptedFormats(rule: DbDocumentRequirementRule) {
  const text = `${rule.document_name} ${rule.required_document || ''}`.toLowerCase();
  if (text.includes('макет') || text.includes('jpeg') || text.includes('jpg') || text.includes('этикет')) return ['jpg', 'jpeg', 'png'];
  if (text.includes('таблиц') || text.includes('excel') || text.includes('xls')) return ['xls', 'xlsx', 'pdf'];
  return ['pdf', 'doc', 'docx'];
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

function extractRequirementSources(rule: DbDocumentRequirementRule): NewDossierDocumentType['requirementSources'] {
  const raw = rule.condition_json?.requirement_sources;
  if (!Array.isArray(raw)) return undefined;
  const sources = raw
    .filter((source) => source && typeof source === 'object')
    .map((source: any) => ({
      index: Number(source.index) || 0,
      checkText: String(source.check_text || source.checkText || '').trim(),
      sourceReference: String(source.source_reference || source.sourceReference || '').trim(),
      sourceStatus: source.source_status || source.sourceStatus ? String(source.source_status || source.sourceStatus) : undefined,
      sourceTag: source.source_tag || source.sourceTag ? String(source.source_tag || source.sourceTag) : undefined,
      sourceFiles: Array.isArray(source.source_files || source.sourceFiles)
        ? (source.source_files || source.sourceFiles).map(String).filter(Boolean)
        : undefined,
      sourceNote: source.source_note || source.sourceNote ? String(source.source_note || source.sourceNote) : undefined,
    }))
    .filter((source) => source.index > 0 && source.sourceReference);
  return sources.length ? sources : undefined;
}

export async function writeAdminRuntimeConfig(config: unknown, userId = 'system'): Promise<AdminRuntimeConfig> {
  const normalized = normalizeAdminRuntimeConfig({
    ...(config && typeof config === 'object' ? config : {}),
    updatedAt: new Date().toISOString(),
    updatedByUserId: normalizeRuntimeUserId(userId),
  });
  await writeAdminRuntimeConfigToPostgres(normalized, userId);
  return normalized;
}

async function writeAdminRuntimeConfigToPostgres(config: AdminRuntimeConfig, userId = 'system') {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const normalizedUserId = normalizeRuntimeUserId(userId);
  await pool.query(
    `
      INSERT INTO admin_runtime_config (key, data, created_by_user_id, updated_by_user_id, updated_at)
      VALUES ('default', $1::jsonb, $2, $2, now())
      ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = now()
    `,
    [JSON.stringify(sanitizeJsonForPostgres(config)), normalizedUserId]
  );
}
