'use client';

import { checkDefinitions, getCheckDefinition } from '@/lib/checks/registry';
import { CheckMethod, Finding } from '@/lib/types';
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { ReviewCheckCell, ReviewStatus } from '@/components/expert/detail/review-types';

export function CheckChip({ check }: { check: ReviewCheckCell }) {
  const styles = {
    passed: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-100',
    failed: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/20 dark:text-yellow-100',
    skipped: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100',
  };
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${styles[check.status]}`} title={check.description || check.name}>
      <StatusIcon status={check.status} />
      <span className="truncate">{shortCheckName(check.id)}</span>
      {check.method && <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{methodLabel(check.method)}</span>}
    </span>
  );
}

export function MethodBadge({ method }: { method: CheckMethod }) {
  const styles: Record<CheckMethod, string> = {
    rule: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
    parser: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100',
    ocr: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-100',
    llm: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100',
    manual: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100',
    hybrid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[method]}`}>{methodLabel(method)}</span>;
}

export function FindingMethodBadge({ finding }: { finding: Finding }) {
  return <MethodBadge method={methodFromFinding(finding)} />;
}

function methodFromFinding(finding: Finding): CheckMethod {
  const checkerId = finding.checkerId || '';
  if (checkerId === 'npa_imported_requirement_check') return finding.id.startsWith('npa-gemma') ? 'llm' : 'manual';
  if (checkerId === 'ocr_quality_check') return 'ocr';
  const definition = getCheckDefinition(checkerId) || checkDefinitions.find((check) => check.id === checkerId);
  return definition?.method || 'manual';
}

function methodLabel(method: CheckMethod): string {
  const labels: Record<CheckMethod, string> = {
    rule: 'rule',
    parser: 'parser',
    ocr: 'ocr',
    llm: 'ИИ',
    manual: 'manual',
    hybrid: 'hybrid',
  };
  return labels[method];
}

export function StatusBadge({ status, verbose = false }: { status: ReviewStatus; verbose?: boolean }) {
  const labels = {
    passed: verbose ? 'Проверка пройдена' : 'Прошёл',
    failed: verbose ? 'Проверка не пройдена' : 'Не прошёл',
    warning: 'Предупреждение',
    skipped: 'Не применимо',
  };
  const styles = {
    passed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100',
    skipped: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-100',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}><StatusIcon status={status} />{labels[status]}</span>;
}

function StatusIcon({ status }: { status: ReviewStatus }) {
  if (status === 'passed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'warning') return <AlertTriangle className="h-3.5 w-3.5" />;
  return <CircleDashed className="h-3.5 w-3.5" />;
}

export function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const labels: Record<Finding['severity'], string> = {
    critical: 'Критично',
    serious: 'Серьёзно',
    warning: 'Предупреждение',
    unknown: 'Неизвестно',
  };
  const styles: Record<Finding['severity'], string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100',
    serious: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100',
    unknown: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-100',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}>{labels[severity]}</span>;
}

export function shortCheckName(checkId: string) {
  const names: Record<string, string> = {
    required_document_presence_check: 'наличие',
    file_format_check: 'формат',
    ocr_quality_check: 'OCR',
    core_field_consistency_check: 'сверка полей',
    gmp_certificate_check: 'GMP',
    cpp_certificate_check: 'CPP',
    shelf_life_consistency_check: 'срок годности',
    storage_consistency_check: 'хранение',
    translation_length_check: 'перевод',
    docx_format_check: 'DOCX',
    required_sections_check: 'разделы',
    bioequivalence_report_check: 'БЭ',
    bioequivalence_waiver_check: 'биовейвер',
    module3_content_check: 'модуль 3',
    pharmacovigilance_contact_check: 'фармаконадзор',
    black_triangle_check: 'мониторинг',
    sterility_validation_check: 'стерильность',
    ls_variation_consistency_check: 'изменения',
    mi_variation_consistency_check: 'изменения МИ',
  };
  return names[checkId] || checkId.replace(/_check$/, '').replace(/_/g, ' ');
}
