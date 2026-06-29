import type { DocumentType, Rule } from '@/lib/types';
import type { GemmaCheckRequirement, NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { ensureRuntimeSchema, getRuntimePool, normalizeRuntimeUserId, sanitizeJsonForPostgres } from '@/lib/db/runtime-postgres';
import { pickConditionPredicate } from '@/lib/rules/condition-evaluator';

// ---------------------------------------------------------------------------
// In-process TTL cache for the full LS/registration document type list.
// readLsRegistrationDocumentTypesFromPostgres does a full table scan and is
// called on every /api/admin/config request (wizard page mount). Cache it for
// 2 minutes — acceptable staleness for an admin-managed reference table.
// ---------------------------------------------------------------------------
const globalForDocTypeCache = globalThis as unknown as {
  _lsDocTypeCache?: { data: { documentTypes: DocumentType[]; lsDossierDocumentTypes: NewDossierDocumentType[] }; at: number } | null;
};
const LS_DOC_TYPE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getLsDocTypeCache() {
  const entry = globalForDocTypeCache._lsDocTypeCache;
  if (entry && Date.now() - entry.at < LS_DOC_TYPE_CACHE_TTL_MS) return entry.data;
  return null;
}

function setLsDocTypeCache(data: { documentTypes: DocumentType[]; lsDossierDocumentTypes: NewDossierDocumentType[] }) {
  globalForDocTypeCache._lsDocTypeCache = { data, at: Date.now() };
}

/** Call this whenever an admin saves document types so the next request is fresh. */
export function invalidateLsDocTypeCache() {
  globalForDocTypeCache._lsDocTypeCache = null;
}

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
  /** id записи в document_check_profile привязанного раздела (для двусторонней связи). */
  targetRequirementId?: string;
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
    targetRequirementId: typeof source.targetRequirementId === 'string' ? source.targetRequirementId : undefined,
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

export interface AdminDocumentTypeListParams {
  page?: number;
  pageSize?: number;
  query?: string;
  source?: 'all' | 'appendix-2' | 'appendix-3';
  /** Область и процедура (scope). По умолчанию ЛС/registration. */
  objectType?: string;
  procedure?: string;
}

/** Нормализованный scope для админ-выборок. */
function adminScope(objectType?: string, procedure?: string): { objectType: string; procedure: string } {
  const ot = String(objectType || 'LS').toUpperCase() === 'MI' ? 'MI' : 'LS';
  const p = String(procedure || 'registration').trim() || 'registration';
  return { objectType: ot, procedure: p };
}

export interface AdminDocumentTypeListResult {
  items: NewDossierDocumentType[];
  total: number;
  page: number;
  pageSize: number;
  /** Все разделы досье (по всей базе, не по странице) — для выбора при создании/редактировании. */
  sections: string[];
}

/** Все разделы досье (module_part) по всем активным типам документов ЛС — независимо от пагинации. */
export async function readAdminDocumentTypeSections(objectType?: string, procedure?: string): Promise<string[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const s = adminScope(objectType, procedure);
  const { rows } = await pool.query<{ module_part: string | null }>(
    `SELECT DISTINCT module_part FROM document_requirement_rules
     WHERE scope_object_type=$1 AND scope_procedure=$2 AND active=true AND module_part IS NOT NULL
     ORDER BY module_part`,
    [s.objectType, s.procedure],
  );
  return rows.map((r) => String(r.module_part || '').trim()).filter(Boolean);
}

export async function readAdminDocumentTypesList(params: AdminDocumentTypeListParams = {}): Promise<AdminDocumentTypeListResult> {
  await ensureRuntimeSchema();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize) || 25));
  const offset = (page - 1) * pageSize;
  const scope = adminScope(params.objectType, params.procedure);
  const values: unknown[] = [scope.objectType, scope.procedure];
  const where = [
    `scope_object_type = $1`,
    `scope_procedure = $2`,
    `active = true`,
    `COALESCE(row_type, 'Документ') IN ('document', 'Документ')`,
  ];
  const normalizedQuery = String(params.query || '').trim().toLowerCase();
  if (normalizedQuery) {
    values.push(`%${normalizedQuery}%`);
    where.push(`lower(concat_ws(' ', doc_code, document_name, required_document, module_part, source_reference)) LIKE $${values.length}`);
  }
  const source = params.source || 'all';
  const appendix2Predicate = `(lower(concat_ws(' ', source_structure, dossier_variant, module_part)) LIKE '%приложение 2%' OR lower(concat_ws(' ', source_structure, dossier_variant, module_part)) LIKE '%appendix-2%' OR lower(concat_ws(' ', source_structure, dossier_variant, module_part)) LIKE '%national%')`;
  if (source === 'appendix-2') where.push(appendix2Predicate);
  if (source === 'appendix-3') where.push(`NOT ${appendix2Predicate}`);

  const pool = getRuntimePool();
  const whereSql = where.join(' AND ');
  // Single query: window function COUNT(*) OVER() avoids a second round-trip
  values.push(pageSize, offset);
  const rowsResult = await pool.query<DbDocumentRequirementRule & { _total_count: string }>(
    `
      SELECT
        id,
        doc_code,
        document_type_id,
        scope_object_type,
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
        active,
        count(*) OVER()::text AS _total_count
      FROM document_requirement_rules
      WHERE ${whereSql}
      ORDER BY dossier_variant NULLS LAST, module_part NULLS LAST, doc_code NULLS LAST, id
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  const total = Number(rowsResult.rows[0]?._total_count || 0);
  const sections = await readAdminDocumentTypeSections(scope.objectType, scope.procedure);
  return {
    items: rowsResult.rows.map((rule, index) => buildAdminDossierDocumentTypeSummary(rule, offset + index + 1)),
    total,
    page,
    pageSize,
    sections,
  };
}

export async function readAdminDocumentTypeDetail(id: string): Promise<NewDossierDocumentType | null> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query<DbDocumentRequirementRule>(
    `
      SELECT
        id,
        doc_code,
        document_type_id,
        scope_object_type,
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
      WHERE active = true
        AND (document_type_id = $1 OR ('db-rule-' || id) = $1 OR id = $1 OR doc_code = $1)
      ORDER BY dossier_variant NULLS LAST, module_part NULLS LAST, doc_code NULLS LAST, id
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ? buildAdminDossierDocumentType(rows[0], 1) : null;
}

export async function updateAdminDocumentTypeDetail(id: string, item: NewDossierDocumentType): Promise<NewDossierDocumentType | null> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const validationChecks = asStringArray(item.validationChecks).length
    ? asStringArray(item.validationChecks)
    : String(item.validationChecks || '')
        .split(/\n|\|/)
        .map((value) => value.trim())
        .filter(Boolean);
  const linkedParams = Array.isArray(item.linkedApplicationParams) ? item.linkedApplicationParams : [];
  const sourceReference = item.npaReferences?.[0] || null;

  // Если передан предикат обязательности (requiredWhenCondition) — переписать его в condition_json
  // ВЕРХНЕГО уровня, сохранив document_check_profile/checker_routing (они лежат рядом с предикатом).
  let conditionJsonParam: string | null = null;
  if (item.requiredWhenCondition !== undefined) {
    const cur = await pool.query<{ condition_json: any }>(
      `SELECT condition_json FROM document_requirement_rules
       WHERE (document_type_id=$1 OR ('db-rule-'||id)=$1 OR id=$1 OR doc_code=$1)
       ORDER BY dossier_variant NULLS LAST, module_part NULLS LAST, doc_code NULLS LAST, id LIMIT 1`,
      [id],
    );
    const cj: Record<string, any> =
      cur.rows[0]?.condition_json && typeof cur.rows[0].condition_json === 'object' ? { ...cur.rows[0].condition_json } : {};
    for (const k of ['all', 'any', 'not', 'eq', 'neq', 'in', 'contains', 'not_empty', 'empty', 'manual']) delete cj[k];
    const pred = item.requiredWhenCondition as Record<string, any> | null;
    if (pred && typeof pred === 'object') Object.assign(cj, pred);
    // null = «применяется всегда»: пустой all → evaluateCondition вернёт true (а не false на profile-only).
    else cj.all = [];
    conditionJsonParam = JSON.stringify(cj);
  }

  await pool.query(
    `
      UPDATE document_requirement_rules
      SET
        required_document = $2,
        document_name = $3,
        condition_text = $4,
        linked_params = $5::jsonb,
        validation_checks = $6::jsonb,
        source_reference = $7,
        active = $8,
        condition_json = COALESCE($9::jsonb, condition_json)
      WHERE (document_type_id = $1 OR ('db-rule-' || id) = $1 OR id = $1 OR doc_code = $1)
    `,
    [
      id,
      item.name || item.description || item.code,
      item.description || item.name || item.code,
      item.requiredWhenExpression || item.requirednessExplanation || null,
      JSON.stringify(linkedParams),
      JSON.stringify(validationChecks),
      sourceReference,
      item.active !== false,
      conditionJsonParam,
    ]
  );
  invalidateLsDocTypeCache();
  return readAdminDocumentTypeDetail(id);
}

/**
 * Создать новый тип документа: INSERT новой строки в document_requirement_rules с
 * минимальным document_check_profile (требования добавляются потом в карточке).
 */
export async function createAdminDocumentType(item: NewDossierDocumentType): Promise<NewDossierDocumentType | null> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const objectType = item.direction === 'MI' ? 'MI' : 'LS';
  const procedure = String((item as any).scopeProcedure || 'registration').trim() || 'registration';
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
  const documentTypeId = `memo-${objectType.toLowerCase()}-custom-${suffix}`;
  const ruleId = `MEMO_${objectType}_CUSTOM_${suffix.toUpperCase()}`;
  const rowType = item.kind === 'section' ? 'Раздел' : item.kind === 'excluded' ? 'Исключен' : 'Документ';
  const validationChecks = asStringArray(item.validationChecks).length
    ? asStringArray(item.validationChecks)
    : String(item.validationChecks || '')
        .split(/\n|\|/)
        .map((value) => value.trim())
        .filter(Boolean);
  const conditionJson = {
    document_check_profile: { required_checks: [], conditional_checks: [], cross_document_checks: [] },
    checker_routing: { requirements: [] },
  };
  await pool.query(
    `INSERT INTO document_requirement_rules
       (id, scope_object_type, scope_procedure, doc_code, document_type_id, document_name, row_type,
        source_structure, dossier_variant, module_part, applicability, show_logic, condition_json, condition_text,
        linked_params, validation_checks, normalization_status, source_reference, active, source,
        created_by_user_id, updated_by_user_id)
     VALUES ($1,$15,$16,$2,$3,$4,$5,$6,$7,$8,'always_required','require_when_condition_true',
        $9::jsonb,$10,$11::jsonb,$12::jsonb,'document_profile_normalized',$13,$14,'manual','admin','admin')`,
    [
      ruleId,
      item.code || documentTypeId,
      documentTypeId,
      item.name || item.code || documentTypeId,
      rowType,
      'Ручное добавление (админ)',
      null, // dossier_variant — организационное поле, для кастомных оставляем пустым
      item.group || item.module || null,
      JSON.stringify(conditionJson),
      item.requiredWhenExpression || item.requirednessExplanation || null,
      JSON.stringify(Array.isArray(item.linkedApplicationParams) ? item.linkedApplicationParams : []),
      JSON.stringify(validationChecks),
      item.npaReferences?.[0] || null,
      item.active !== false,
      objectType,
      procedure,
    ],
  );
  invalidateLsDocTypeCache();
  return readAdminDocumentTypeDetail(documentTypeId);
}

/**
 * Записывает отредактированный набор требований в condition_json (то, что реально
 * читает Gemma при проверке): document_check_profile.{required/conditional/cross}.check_text
 * и checker_routing.requirements.requirement_text. У существующих сохраняем метаданные,
 * меняем только текст; удалённые — выпадают; новые — добавляются.
 */
export async function updateCheckProfileRequirements(
  id: string,
  requirements: Array<{ id?: string; kind: GemmaCheckRequirement['kind']; text: string; path?: { array: string; index: number } }>,
): Promise<NewDossierDocumentType | null> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query<{ id: string; condition_json: any }>(
    `SELECT id, condition_json FROM document_requirement_rules
     WHERE active=true
       AND (document_type_id=$1 OR ('db-rule-'||id)=$1 OR id=$1 OR doc_code=$1)
     ORDER BY dossier_variant NULLS LAST, module_part NULLS LAST, doc_code NULLS LAST, id LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const ruleId = rows[0].id;
  const cj: Record<string, any> = rows[0].condition_json && typeof rows[0].condition_json === 'object' ? rows[0].condition_json : {};
  const profile: Record<string, any> = cj.document_check_profile && typeof cj.document_check_profile === 'object' ? cj.document_check_profile : {};
  const routing: Record<string, any> = cj.checker_routing && typeof cj.checker_routing === 'object' ? cj.checker_routing : {};

  const kindToArray: Record<string, string> = {
    required: 'document_check_profile.required_checks',
    conditional: 'document_check_profile.conditional_checks',
    cross_document: 'document_check_profile.cross_document_checks',
    routing: 'checker_routing.requirements',
  };
  const orig: Record<string, any[]> = {
    'document_check_profile.required_checks': Array.isArray(profile.required_checks) ? profile.required_checks : [],
    'document_check_profile.conditional_checks': Array.isArray(profile.conditional_checks) ? profile.conditional_checks : [],
    'document_check_profile.cross_document_checks': Array.isArray(profile.cross_document_checks) ? profile.cross_document_checks : [],
    'checker_routing.requirements': Array.isArray(routing.requirements) ? routing.requirements : [],
  };
  const next: Record<string, any[]> = {
    'document_check_profile.required_checks': [],
    'document_check_profile.conditional_checks': [],
    'document_check_profile.cross_document_checks': [],
    'checker_routing.requirements': [],
  };

  let counter = 0;
  for (const req of requirements) {
    const text = String(req?.text || '').trim();
    if (!text) continue;
    const arrayKey = kindToArray[req?.kind] || 'document_check_profile.required_checks';
    const isRouting = arrayKey === 'checker_routing.requirements';
    if (req.path && req.path.array === arrayKey && orig[arrayKey][req.path.index]) {
      const existing = { ...orig[arrayKey][req.path.index] };
      if (isRouting) existing.requirement_text = text;
      else existing.check_text = text;
      next[arrayKey].push(existing);
    } else {
      counter += 1;
      const genId = `${ruleId}-manual-${counter}`;
      next[arrayKey].push(
        isRouting
          ? { requirement_id: genId, requirement_text: text }
          : { id: genId, title: text.slice(0, 80), check_text: text, source_status: 'manual', source_scope: 'document_type_rule' },
      );
    }
  }

  const nextCj = {
    ...cj,
    document_check_profile: {
      ...profile,
      required_checks: next['document_check_profile.required_checks'],
      conditional_checks: next['document_check_profile.conditional_checks'],
      cross_document_checks: next['document_check_profile.cross_document_checks'],
    },
    checker_routing: { ...routing, requirements: next['checker_routing.requirements'] },
  };

  await pool.query(`UPDATE document_requirement_rules SET condition_json = $2::jsonb WHERE id = $1`, [
    ruleId,
    JSON.stringify(nextCj),
  ]);
  invalidateLsDocTypeCache();
  return readAdminDocumentTypeDetail(id);
}

/**
 * Привязать/отвязать требование НПА к разделу типа документа — это АССОЦИАЦИЯ
 * (НПА-требование ↔ тип документа), без добавления новой проверки в Gemma.
 * Мастер-проверки уже живут в document_check_profile типа документа; их видно/редактируют
 * во вкладке «Тексты для Gemma». targetDocumentTypeId='' — снять привязку.
 */
export async function bindNpaRequirementToDocumentType(
  npaId: string,
  requirementId: string,
  targetDocumentTypeId: string,
): Promise<AdminNpaRecord | null> {
  const config = await readAdminRuntimeConfig();
  const registry: AdminNpaRecord[] = Array.isArray((config as any).npaRegistry) ? (config as any).npaRegistry : [];
  const record = registry.find((item) => item.id === npaId);
  if (!record) return null;
  const requirement = record.requirements.find((req) => req.id === requirementId);
  if (!requirement) return null;

  const nextTargetId = targetDocumentTypeId && targetDocumentTypeId !== 'none' ? targetDocumentTypeId : '';
  requirement.targetDocumentTypeId = nextTargetId || undefined;
  requirement.targetRequirementId = undefined;

  const nextRegistry = registry.map((item) => (item.id === npaId ? record : item));
  await writeAdminRuntimeConfig({ ...config, npaRegistry: nextRegistry }, 'admin');
  return record;
}

/**
 * Массовое применение привязок (ассоциаций) из сопоставления: один проход, одна запись.
 * Возвращает число применённых привязок.
 */
export async function bindNpaRequirementsBulk(
  items: Array<{ npaId: string; requirementId: string; documentTypeId: string }>,
): Promise<number> {
  const config = await readAdminRuntimeConfig();
  const registry: AdminNpaRecord[] = Array.isArray((config as any).npaRegistry) ? (config as any).npaRegistry : [];
  const byNpa = new Map<string, Map<string, string>>();
  for (const it of items) {
    if (!it?.npaId || !it?.requirementId || !it?.documentTypeId) continue;
    if (!byNpa.has(it.npaId)) byNpa.set(it.npaId, new Map());
    byNpa.get(it.npaId)!.set(it.requirementId, it.documentTypeId);
  }
  let applied = 0;
  for (const record of registry) {
    const map = byNpa.get(record.id);
    if (!map) continue;
    for (const req of record.requirements) {
      const target = map.get(req.id);
      if (target) {
        req.targetDocumentTypeId = target;
        req.targetRequirementId = undefined;
        applied += 1;
      }
    }
  }
  await writeAdminRuntimeConfig({ ...config, npaRegistry: registry }, 'admin');
  return applied;
}

/**
 * Добавить НОВЫЕ требования в реестр НПА (обратное заполнение из типов документов,
 * подтверждённое по текстам актов). Каждое требование сразу привязано к своему типу документа.
 * Возвращает число добавленных.
 */
export async function addNpaRequirements(
  additions: Array<{
    documentTypeId: string;
    code?: string;
    npaId: string;
    requirement: string;
    point?: string;
    quote?: string;
    kind?: string;
    documentName?: string;
    criticality?: string;
  }>,
): Promise<number> {
  const config = await readAdminRuntimeConfig();
  const registry: AdminNpaRecord[] = Array.isArray((config as any).npaRegistry) ? (config as any).npaRegistry : [];
  const recById = new Map(registry.map((r) => [r.id, r]));
  let added = 0;
  let seq = 0;
  for (const a of additions) {
    const rec = recById.get(a.npaId);
    if (!rec || !a?.requirement || !a?.documentTypeId) continue;
    seq += 1;
    rec.requirements.push({
      id: `synth-${a.documentTypeId}-${seq}`,
      code: a.code || '',
      point: a.point || '',
      requirement: a.requirement,
      criticality: a.criticality || 'неясно',
      action: 'accepted',
      documentCode: a.code || '',
      documentName: a.documentName || a.code || '',
      checkType: a.kind === 'conditional' ? 'условная проверка' : 'обязательная проверка',
      condition: '',
      quote: a.quote || '',
      targetDocumentTypeId: a.documentTypeId,
      targetRequirementId: undefined,
    });
    added += 1;
  }
  await writeAdminRuntimeConfig({ ...config, npaRegistry: registry }, 'admin');
  return added;
}

export async function deactivateAdminDocumentType(id: string): Promise<boolean> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const result = await pool.query(
    `
      UPDATE document_requirement_rules
      SET active = false
      WHERE (document_type_id = $1 OR ('db-rule-' || id) = $1 OR id = $1 OR doc_code = $1)
    `,
    [id]
  );
  invalidateLsDocTypeCache();
  return Number(result.rowCount || 0) > 0;
}

export async function readAdminNpaRegistryOnly(): Promise<AdminNpaRecord[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const result = await pool.query(`SELECT data->'npaRegistry' AS npa_registry FROM admin_runtime_config WHERE key = 'default' LIMIT 1`);
  return normalizeNpaRegistry(result.rows[0]?.npa_registry || []);
}

export async function readAdminNpaDetail(id: string): Promise<AdminNpaRecord | null> {
  const records = await readAdminNpaRegistryOnly();
  return records.find((record) => record.id === id) || null;
}

export async function readAdminApplicationFieldsView() {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query<{ doc_code: string; document_name: string; linked_params: unknown }>(
    `
      SELECT doc_code, document_name, linked_params
      FROM document_requirement_rules
      WHERE scope_object_type = 'LS'
        AND scope_procedure = 'registration'
        AND active = true
        AND linked_params IS NOT NULL
    `
  );
  return rows.map((row) => ({
    code: row.doc_code,
    name: row.document_name,
    linkedParams: asStringArray(row.linked_params),
  }));
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
  scope_object_type?: string;
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
  const cached = getLsDocTypeCache();
  if (cached) return cached;

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
  const result = { documentTypes, lsDossierDocumentTypes };
  setLsDocTypeCache(result);
  return result;
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
    direction: rule.scope_object_type === 'MI' ? 'MI' : 'LS',
    acceptedFormats: inferAcceptedFormats(rule),
    active: rule.active,
    sortOrder,
    requiredWhenExpression: rule.condition_text || rule.show_logic || undefined,
    requiredWhenCondition: pickConditionPredicate(rule.condition_json),
    requirednessExplanation: rule.condition_text || rule.applicability || undefined,
    validationChecks: asStringArray(rule.validation_checks).join(' | '),
    npaReferences: rule.source_reference ? [rule.source_reference] : undefined,
    requirementSources,
    checkProfileRequirements: extractCheckProfileRequirements(rule.condition_json),
    checkIds: ['required_document_presence_check', 'file_format_check', 'ocr_quality_check'],
    linkedApplicationParams: asStringArray(rule.linked_params),
    severityIfMissing: rule.applicability === 'always_required' || rule.applicability === 'conditional_required' ? 'critical' : 'warning',
  };
}

function buildAdminDossierDocumentTypeSummary(rule: DbDocumentRequirementRule, sortOrder: number): NewDossierDocumentType {
  const full = buildAdminDossierDocumentType(rule, sortOrder);
  return {
    ...full,
    validationChecks: undefined,
    requirementSources: undefined,
    npaReferences: rule.source_reference ? [rule.source_reference] : undefined,
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
    direction: rule.scope_object_type === 'MI' ? 'MI' : 'LS',
    needsOcr: true,
    checkIds: ['required_document_presence_check', 'file_format_check', 'ocr_quality_check'],
    npaReferences: rule.source_reference ? [rule.source_reference] : [],
    requirednessExplanation: rule.condition_text || undefined,
    requiredWhenExpression: rule.condition_text || undefined,
    requiredWhenCondition: pickConditionPredicate(rule.condition_json),
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

/**
 * Извлекает требования, реально уходящие в Gemma при проверке заявки:
 *  - document_check_profile.{required_checks, conditional_checks, cross_document_checks} → check_text;
 *  - checker_routing.requirements → requirement_text.
 * Возвращает плоский список с путём для будущей записи правок.
 */
function extractCheckProfileRequirements(conditionJson: unknown): GemmaCheckRequirement[] {
  if (!conditionJson || typeof conditionJson !== 'object') return [];
  const cj = conditionJson as Record<string, any>;
  const out: GemmaCheckRequirement[] = [];
  const s = (v: unknown) => {
    const t = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
    return t || undefined;
  };

  const profile = cj.document_check_profile;
  const pushProfile = (arr: unknown, kind: GemmaCheckRequirement['kind'], arrayName: string) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((c: any, index: number) => {
      const text = s(c?.check_text);
      if (!text) return;
      out.push({
        id: s(c?.id) || `${kind}-${index}`,
        kind,
        text,
        title: s(c?.title),
        passCriteria: s(c?.pass_criteria),
        failureCriteria: s(c?.failure_criteria),
        applicabilityCondition: s(c?.applicability_condition ?? c?.condition),
        sourceReference: s(c?.source_reference),
        sourceScope: s(c?.source_scope),
        npaId: s(c?.npa_id),
        npaRequirementId: s(c?.npa_requirement_id),
        path: { array: `document_check_profile.${arrayName}`, index },
      });
    });
  };
  if (profile && typeof profile === 'object') {
    pushProfile(profile.required_checks, 'required', 'required_checks');
    pushProfile(profile.conditional_checks, 'conditional', 'conditional_checks');
    pushProfile(profile.cross_document_checks, 'cross_document', 'cross_document_checks');
  }

  // Схлопываем дубли: маршрутные требования часто повторяют текст условных/обязательных
  // (движок их потом мёрджит). Для отображения показываем требование один раз.
  const norm = (t: string) => t.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const seen = new Set(out.map((r) => norm(r.text)));

  const routing = cj.checker_routing?.requirements;
  if (Array.isArray(routing)) {
    routing.forEach((r: any, index: number) => {
      const text = s(r?.requirement_text);
      if (!text || seen.has(norm(text))) return; // дубль — пропускаем
      seen.add(norm(text));
      out.push({
        id: s(r?.requirement_id) || `routing-${index}`,
        kind: 'routing',
        text,
        criticality: s(r?.criticality),
        applicabilityCondition: s(r?.decision_logic),
        path: { array: 'checker_routing.requirements', index },
      });
    });
  }

  return out;
}

export async function writeAdminRuntimeConfig(config: unknown, userId = 'system'): Promise<AdminRuntimeConfig> {
  const normalized = normalizeAdminRuntimeConfig({
    ...(config && typeof config === 'object' ? config : {}),
    updatedAt: new Date().toISOString(),
    updatedByUserId: normalizeRuntimeUserId(userId),
  });
  await writeAdminRuntimeConfigToPostgres(normalized, userId);
  // Invalidate the document-type cache so the next read reflects the new data
  invalidateLsDocTypeCache();
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
