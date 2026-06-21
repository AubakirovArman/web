import { Application, ChecklistItem, DocumentType, Finding, RequiredDoc, RuleCondition } from '@/lib/types';
import { documentTypes, npas, rules as seedRules } from '@/lib/data/seed';
import {
  getLsDossierDocumentTypeById,
  getLsRequiredDossierDocuments,
  matchesLsRequirementTriggerExpression,
  type LsDossierSource,
} from '@/lib/data/ls-document-checks-mapping';
import { Rule } from '@/lib/types';
import { evaluateCondition, hasCondition } from '@/lib/rules/condition-evaluator';

export function getRequiredDocuments(
  app: Application,
  rules: Rule[] = seedRules,
  availableDocumentTypes?: DocumentType[],
): RequiredDoc[] {
  if (app.values['param-object-type'] === 'LS') {
    const adminConfigured = getAdminConfiguredLsRequiredDocuments(app.values, availableDocumentTypes);
    if (adminConfigured.length > 0) return adminConfigured;
    return filterByAvailableDocumentTypes(
      withoutWholeDossierDocuments(getLsRequiredDossierDocuments(app.values)),
      availableDocumentTypes,
    );
  }

  const result: RequiredDoc[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (rule.active === false) continue;
    if (!matchesConditions(app.values, rule.conditions)) continue;
    for (const req of rule.requiredDocuments) {
      if (isWholeDossierDocument(req.documentTypeId)) continue;
      if (seen.has(req.documentTypeId)) continue;
      seen.add(req.documentTypeId);
      result.push({
        documentTypeId: req.documentTypeId,
        severityIfMissing: req.severityIfMissing,
        alternativeDocumentTypeId: req.alternativeDocumentTypeId,
        checks: req.checks,
      });
    }
  }
  return filterByAvailableDocumentTypes(result, availableDocumentTypes);
}

function isWholeDossierDocument(documentTypeId: string) {
  return ['doc-registration-dossier', 'doc-mi-registration-dossier'].includes(documentTypeId);
}

function withoutWholeDossierDocuments(items: RequiredDoc[]) {
  return items.filter((item) => !isWholeDossierDocument(item.documentTypeId));
}

function filterByAvailableDocumentTypes(items: RequiredDoc[], availableDocumentTypes?: DocumentType[]) {
  if (!availableDocumentTypes?.length) return items;
  const availableIds = new Set(availableDocumentTypes.map((doc) => doc.id));
  return items.filter((item) => availableIds.has(item.documentTypeId) || !!item.alternativeDocumentTypeId && availableIds.has(item.alternativeDocumentTypeId));
}

function getAdminConfiguredLsRequiredDocuments(
  values: Application['values'],
  availableDocumentTypes?: DocumentType[],
): RequiredDoc[] {
  if (!availableDocumentTypes?.length) return [];

  const result: RequiredDoc[] = [];
  const seen = new Set<string>();

  for (const doc of availableDocumentTypes) {
    if (!isLsDossierDocumentTypeId(doc.id)) continue;
    if (doc.direction !== 'LS' && doc.direction !== 'both') continue;

    const source = inferLsDossierSourceFromDocumentTypeId(doc.id);
    const requirement = doc.importedRequirements?.[0];

    // Приоритет: структурированный предикат из condition_json (точный).
    // Fallback: устаревший текстовый триггер (хрупкий, оставлен для совместимости).
    if (hasCondition(doc.requiredWhenCondition)) {
      if (!evaluateCondition(doc.requiredWhenCondition, values)) continue;
    } else {
      const trigger = doc.requiredWhenExpression || requirement?.applicabilityCondition || '';
      if (!trigger) continue;
      if (!matchesLsRequirementTriggerExpression(trigger, values, source)) continue;
    }
    if (seen.has(doc.id)) continue;

    seen.add(doc.id);
    result.push({
      documentTypeId: doc.id,
      severityIfMissing: normalizeRequiredDocSeverity(doc.severityIfMissing || requirement?.criticality),
      checks: doc.checkIds?.length ? doc.checkIds : parseCheckIds(requirement?.checkType),
    });
  }

  return result;
}

function inferLsDossierSourceFromDocumentTypeId(documentTypeId: string): LsDossierSource | undefined {
  if (documentTypeId.includes('appendix-2')) return 'appendix-2';
  if (documentTypeId.includes('appendix-3')) return 'appendix-3';
  return undefined;
}

function isLsDossierDocumentTypeId(documentTypeId: string) {
  return documentTypeId.startsWith('new-ls-') || documentTypeId.startsWith('memo-ls-');
}

function normalizeRequiredDocSeverity(value: unknown): RequiredDoc['severityIfMissing'] {
  const text = String(value || '').toLowerCase();
  if (text.includes('critical') || text.includes('крит')) return 'critical';
  if (text.includes('serious') || text.includes('significant') || text.includes('знач')) return 'serious';
  if (text.includes('unknown') || text.includes('неиз')) return 'unknown';
  return 'warning';
}

function parseCheckIds(value: unknown): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((c) => {
    const v = values[c.parameterId];
    const target = c.value;
    switch (c.operator) {
      case 'equals':
        return v === target;
      case 'notEquals':
        return v !== target;
      case 'notEmpty':
        return typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;
      case 'includes':
        if (typeof v === 'string') return v.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(v)) return v.some((x) => x.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

export function buildChecklist(app: Application, rules: Rule[] = seedRules): ChecklistItem[] {
  const required = getRequiredDocuments(app, rules);
  return required.map((req) => {
    const file = findUploadedRequiredFile(app, req);
    return {
      documentTypeId: req.documentTypeId,
      required: true,
      uploaded: !!file,
      fileId: file?.id,
      severityIfMissing: req.severityIfMissing,
      alternativeDocumentTypeId: req.alternativeDocumentTypeId,
      matchedDocumentTypeId: file?.documentTypeId,
      checks: req.checks,
    };
  });
}

export function findUploadedRequiredFile(app: Application, req: RequiredDoc) {
  return app.files.find((file) => fileMatchesRequiredDocument(app, file, req));
}

function fileMatchesRequiredDocument(app: Application, file: Application['files'][number], req: RequiredDoc): boolean {
  if (file.documentTypeId === req.documentTypeId || file.documentTypeId === req.alternativeDocumentTypeId) return true;

  if (app.values['param-object-type'] !== 'LS') return false;
  if (!isLsDossierDocumentTypeId(req.documentTypeId)) return false;

  const requiredItem = getLsDossierDocumentTypeById(req.documentTypeId);
  if (!requiredItem) return false;

  const requiredCode = normalizeCtdCode(requiredItem.code);
  const requiredName = normalizeText(requiredItem.name);
  const fileCodes = extractFileCtdCodes(file);
  const fileText = normalizeText([
    file.name,
    file.originalName,
    file.relativePath,
    file.dossierFolderName,
    file.dossierSectionName,
    file.dossierSectionCode,
  ].filter(Boolean).join(' '));

  if (requiredCode) return fileCodes.some((code) => ctdCodeCoversRequired(requiredCode, code));
  if (requiredName) {
    const exactSectionName = normalizeText(file.dossierSectionName);
    const exactFolderName = normalizeText(file.dossierFolderName);
    return exactSectionName === requiredName || exactFolderName === requiredName;
  }

  if (requiredCode === '2.1') {
    return fileCodes.some((code) => /^(2|3|4|5)\./.test(code));
  }

  return false;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\w\u0400-\u04ff\d.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCtdCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function ctdSummaryToDetailedPrefix(code: string): string {
  if (code.startsWith('2.3.P')) return code.replace(/^2\.3\.P/, '3.2.P');
  if (code.startsWith('2.3.S')) return code.replace(/^2\.3\.S/, '3.2.S');
  if (code === '2.3') return '3.2';
  return code;
}

function ctdCodeCoversRequired(requiredCode: string, fileCode: string): boolean {
  if (!requiredCode || !fileCode) return false;
  const req = normalizeCtdCode(requiredCode);
  const file = normalizeCtdCode(fileCode);
  if (!req || !file) return false;
  if (req === file) return true;
  // Методика «укрупнённый пакет»: файл родительского раздела покрывает свои
  // подразделы (напр. файл 3.2.S засчитывается за требование 3.2.S.1).
  if (req.startsWith(file + '.')) return true;
  // Обратное: файл-подраздел засчитывается за требование родителя
  // (файл 3.2.P.3.1 покрывает требование раздела 3.2.P.3).
  if (file.startsWith(req + '.')) return true;
  // Соседнее покрытие для глубоких подразделов качества модуля 3:
  // если в секции (напр. 3.2.P.5) есть любой загруженный подраздел,
  // то требование её соседнего подраздела (3.2.P.5.1) считается покрытым.
  if (req.startsWith('3.2.P.') || req.startsWith('3.2.S.')) {
    const parent = req.split('.').slice(0, -1).join('.');
    if (parent.split('.').length >= 4 && (file === parent || file.startsWith(parent + '.'))) return true;
  }
  return false;
}

/** Свод кода подраздела к «разделу-карточке», на уровне которого подаётся пакет. */
function ctdSectionKey(code: string): string {
  const c = normalizeCtdCode(code);
  const parts = c.split('.');
  if ((c.startsWith('3.2.P.') || c.startsWith('3.2.S.')) && parts.length >= 4) return parts.slice(0, 4).join('.');
  if (c.startsWith('2.3.S')) return '2.3.S';
  if (c.startsWith('2.3.P.') && parts.length >= 4) return parts.slice(0, 4).join('.');
  return c;
}

/** Чисто структурные/административные разделы (оглавления, контактные сведения). */
const CTD_STRUCTURAL_SECTIONS = new Set(['2.1', '2.2', '3.1', '1.6.4']);

/** Коды-двойники резюме (модуль 2.3) ↔ детали (модуль 3.2) для одной темы. */
function ctdCounterpartCodes(code: string): string[] {
  const c = normalizeCtdCode(code);
  const out: string[] = [];
  if (c.startsWith('3.2.P')) out.push(c.replace(/^3\.2\.P/, '2.3.P'));
  if (c.startsWith('3.2.S')) out.push('2.3.S', c.replace(/^3\.2\.S/, '2.3.S'));
  if (c.startsWith('2.3.P')) out.push(c.replace(/^2\.3\.P/, '3.2.P'));
  if (c.startsWith('2.3.S')) out.push('3.2.S');
  return Array.from(new Set(out.map(normalizeCtdCode))).filter((x) => x && x !== c);
}

function extractFileCtdCodes(file: Application['files'][number]): string[] {
  const source = [
    file.name,
    file.originalName,
    file.relativePath,
    file.dossierFolderName,
    file.dossierSectionName,
    file.dossierSectionCode,
    getLsDossierDocumentTypeById(file.documentTypeId)?.code,
  ].filter(Boolean).join(' ');

  const matches = source.match(/\b[1-5](?:\.\d+)+(?:\.[SPР])?(?:\.\d+)*\.?/gi) || [];
  return Array.from(new Set(matches.map(normalizeCtdCode).filter(Boolean))).sort((a, b) => b.length - a.length);
}

export function evaluateMissingDocuments(
  app: Application,
  rules: Rule[] = seedRules,
  availableDocumentTypes?: DocumentType[],
): Finding[] {
  return evaluateMissingRequiredDocuments(app, getRequiredDocuments(app, rules, availableDocumentTypes), availableDocumentTypes, rules);
}

export function evaluateMissingRequiredDocuments(
  app: Application,
  requiredDocuments: RequiredDoc[],
  availableDocumentTypes?: DocumentType[],
  rules: Rule[] = [],
): Finding[] {
  const findings: Finding[] = [];
  const documentTypesCatalog = availableDocumentTypes?.length ? availableDocumentTypes : documentTypes;

  // карта: нормализованный CTD-код раздела -> человеко-читаемое имя
  const codeToName = new Map<string, string>();
  for (const d of documentTypesCatalog) {
    const dd = d as DocumentType & { docCode?: string; code?: string };
    const code = normalizeCtdCode(dd.docCode || dd.code || '');
    if (code && !codeToName.has(code)) codeToName.set(code, d.name);
  }
  const codeOfDocType = (docType?: DocumentType) => {
    const dd = docType as (DocumentType & { docCode?: string; code?: string }) | undefined;
    return normalizeCtdCode(dd?.docCode || dd?.code || '');
  };

  // надёжный набор кодов разделов, реально присутствующих в пакете
  const uploadedCodes = new Set<string>();
  for (const file of app.files) {
    const sc = normalizeCtdCode((file as { dossierSectionCode?: string }).dossierSectionCode || '');
    if (sc) uploadedCodes.add(sc);
    for (const c of extractFileCtdCodes(file)) uploadedCodes.add(c);
  }
  const uploadedCodeList = Array.from(uploadedCodes);
  const uploadedDocTypeIds = new Set(app.files.map((f) => f.documentTypeId).filter(Boolean));

  // считаем требование покрытым по: прямому documentTypeId, коду (род/потомок/сосед) или прежней логике
  const missing = requiredDocuments
    .map((req) => {
      const docType = documentTypesCatalog.find((d) => d.id === req.documentTypeId);
      const code = codeOfDocType(docType) || normalizeCtdCode(getLsDossierDocumentTypeById(req.documentTypeId)?.code || '');
      const directMatch = uploadedDocTypeIds.has(req.documentTypeId)
        || (!!req.alternativeDocumentTypeId && uploadedDocTypeIds.has(req.alternativeDocumentTypeId));
      const codeMatch = code ? uploadedCodeList.some((uc) => ctdCodeCoversRequired(code, uc)) : false;
      const uploaded = directMatch || codeMatch || !!findUploadedRequiredFile(app, req);
      const key = code ? ctdSectionKey(code) : req.documentTypeId;
      return { documentTypeId: req.documentTypeId, severityIfMissing: req.severityIfMissing, docType, code, key, uploaded };
    })
    .filter((m) => !m.uploaded);

  // группируем пропуски по разделу-карточке (а не плодим по каждому подразделу)
  const groups = new Map<string, typeof missing>();
  for (const m of missing) {
    const arr = groups.get(m.key) || [];
    arr.push(m);
    groups.set(m.key, arr);
  }

  const severityRank: Record<string, number> = { critical: 3, serious: 2, warning: 1, unknown: 0 };
  for (const [key, members] of Array.from(groups.entries())) {
    const rep = members.find((m) => m.code === key) || members[0];
    const sectionName = codeToName.get(key) || rep.docType?.name || key;
    let severity = members.reduce(
      (acc, m) => ((severityRank[m.severityIfMissing] ?? 0) > (severityRank[acc] ?? 0) ? m.severityIfMissing : acc),
      members[0].severityIfMissing,
    );

    // Понижение серьёзности там, где «отсутствие» формальное:
    // 1) чисто структурные разделы (оглавления, контакт по фармаконадзору);
    // 2) деталь модуля 3 отсутствует, но её резюме в модуле 2.3 представлено
    //    (или наоборот) — тема в досье раскрыта, отдельная карточка не выделена.
    const counterpart = ctdCounterpartCodes(key).find((cp) =>
      uploadedCodeList.some((uc) => ctdCodeCoversRequired(cp, uc)),
    );
    let downgradeNote = '';
    if (CTD_STRUCTURAL_SECTIONS.has(key)) {
      severity = 'warning';
      downgradeNote = ' Структурный/административный раздел.';
    } else if (counterpart) {
      severity = 'warning';
      downgradeNote = ` Тема раскрыта в смежном разделе ${counterpart}; отдельная карточка раздела не выделена.`;
    }

    const rule = rules.find((r) => r.requiredDocuments.some((d) => d.documentTypeId === rep.documentTypeId));
    const npa = rule?.sourceNpaId ? npas.find((n) => n.id === rule.sourceNpaId) : undefined;
    const subs = members.filter((m) => m.code && m.code !== key).map((m) => m.docType?.name || m.code);
    const subText = subs.length
      ? ` Не представлены подразделы: ${subs.slice(0, 8).join('; ')}${subs.length > 8 ? '…' : ''}.`
      : '';
    const codeLabel = /^[0-9]/.test(key) ? `${key} ` : '';
    const productType = String(app.values['param-product-type'] || 'ЛС');

    findings.push({
      id: `missing-${key}-${Date.now()}`,
      severity,
      category: 'Комплектность',
      title: `Отсутствует раздел: ${codeLabel}${sectionName}`,
      description: `Раздел «${codeLabel}${sectionName}» обязателен для данного профиля заявки (${productType}), но не найден в загруженном пакете.${subText}${downgradeNote}`,
      documents: [sectionName],
      recommendation: `Добавьте документы раздела ${codeLabel}${sectionName} в пакет досье.`,
      npaReference: npa ? `${npa.number} от ${npa.date}` : undefined,
      checkerId: 'required_document_presence_check',
      confidence: 1,
      status: 'open',
    });
  }
  return findings;
}
