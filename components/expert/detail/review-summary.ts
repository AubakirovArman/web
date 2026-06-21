import type { Application, DocumentType, RequiredDoc } from '@/lib/types';

/**
 * Единый корректный подсчёт сводки заявки для карточек-метрик.
 * Использует ту же логику покрытия (родитель/потомок/сосед) и свода до раздела,
 * что и /check (lib/rules/engine.ts), поэтому цифры на странице совпадают с
 * консолидированными находками (Замечания эксперту), а не с «сырыми» строками.
 */

function normalizeCtdCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/С/g, 'C')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function codeCovers(requiredCode: string, fileCode: string): boolean {
  const req = normalizeCtdCode(requiredCode);
  const file = normalizeCtdCode(fileCode);
  if (!req || !file) return false;
  if (req === file) return true;
  if (req.startsWith(file + '.')) return true; // файл — родитель требования (укрупнённо)
  if (file.startsWith(req + '.')) return true; // файл — подраздел требования
  if (req.startsWith('3.2.P.') || req.startsWith('3.2.S.')) {
    const parent = req.split('.').slice(0, -1).join('.');
    if (parent.split('.').length >= 4 && (file === parent || file.startsWith(parent + '.'))) return true;
  }
  return false;
}

function ctdSectionKey(code: string): string {
  const c = normalizeCtdCode(code);
  const parts = c.split('.');
  if ((c.startsWith('3.2.P.') || c.startsWith('3.2.S.')) && parts.length >= 4) return parts.slice(0, 4).join('.');
  if (c.startsWith('2.3.S')) return '2.3.S';
  if (c.startsWith('2.3.P.') && parts.length >= 4) return parts.slice(0, 4).join('.');
  return c;
}

function codeOfDocType(docType?: DocumentType): string {
  const dd = docType as (DocumentType & { docCode?: string; code?: string }) | undefined;
  return normalizeCtdCode(dd?.docCode || dd?.code || '');
}

export interface ReviewSummaryData {
  filesTotal: number;
  sectionsRequired: number;
  sectionsPresent: number;
  sectionsMissing: number;
  findingsTotal: number;
  critical: number;
  serious: number;
  warning: number;
  unknown: number;
}

export function computeReviewSummary(
  app: Application,
  requiredDocs: RequiredDoc[],
  documentTypesCatalog: DocumentType[],
): ReviewSummaryData {
  // коды разделов, реально присутствующих в пакете
  const uploaded = new Set<string>();
  for (const file of app.files) {
    const sc = normalizeCtdCode((file as { dossierSectionCode?: string }).dossierSectionCode || '');
    if (sc) uploaded.add(sc);
  }
  const uploadedList = Array.from(uploaded);

  // требуемые разделы, свёрнутые до карточки-раздела
  const requiredKeys = new Set<string>();
  for (const req of requiredDocs) {
    const docType = documentTypesCatalog.find((doc) => doc.id === req.documentTypeId);
    const code = codeOfDocType(docType);
    if (code) requiredKeys.add(ctdSectionKey(code));
  }
  const keys = Array.from(requiredKeys);
  const present = keys.filter((key) => uploadedList.some((code) => codeCovers(key, code)));

  const findings = app.findings || [];
  const bySeverity = (severity: string) => findings.filter((finding) => finding.severity === severity).length;

  return {
    filesTotal: app.files.length,
    sectionsRequired: keys.length,
    sectionsPresent: present.length,
    sectionsMissing: keys.length - present.length,
    findingsTotal: findings.length,
    critical: bySeverity('critical'),
    serious: bySeverity('serious'),
    warning: bySeverity('warning'),
    unknown: bySeverity('unknown'),
  };
}
