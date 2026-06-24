'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import { StatusBadge } from '@/components/expert/detail/review-badges';
import { DocumentReviewRow, ReviewStatus } from '@/components/expert/detail/review-types';
import { ExpertiseStage, STAGE_HINTS, checksForStage, overallForChecks } from '@/components/expert/detail/review-stages';

export function DocumentsReviewCard({
  rows,
  requestText,
  stage = 'primary',
  onCopyRequest,
  onOpenRow,
}: {
  rows: DocumentReviewRow[];
  requestText: string;
  stage?: ExpertiseStage;
  onCopyRequest: () => void;
  onOpenRow: (row: DocumentReviewRow) => void;
}) {
  const sorted = [...rows].sort((a, b) => compareSection(sectionCode(a), sectionCode(b)));
  // Первичный этап — все разделы (комплектность). Специализированный — только разделы с содержательными проверками.
  const allRows = stage === 'specialized' ? sorted.filter((row) => checksForStage(row, 'specialized').length > 0) : sorted;
  const loadedCount = rows.filter((row) => row.file || row.files?.length).length;

  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Документы и проверки</CardTitle>
            <p className="text-sm text-muted-foreground">
              {stage === 'specialized'
                ? STAGE_HINTS.specialized
                : `Показаны все разделы по порядку: загружено ${loadedCount} из ${rows.length}. Незагруженные разделы отмечены «Файл не загружен».`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCopyRequest} disabled={!requestText}>Сформировать запрос</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        <div className="min-w-0 overflow-hidden px-1 pb-1">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="w-[11%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Код раздела</th>
                <th className="w-[31%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Тип документа</th>
                <th className="w-[25%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Файлы</th>
                <th className="w-[20%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Проверки</th>
                <th className="w-[8%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Итог</th>
                <th className="w-[5%] px-2 py-3 text-right align-middle font-medium whitespace-normal text-foreground">Открыть</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Разделы не найдены.
                  </td>
                </tr>
              ) : allRows.map((row) => {
                const loaded = Boolean(row.file || row.files?.length);
                const stageChecks = checksForStage(row, stage);
                const counts = countStatuses(stageChecks);
                const stageOverall = overallForChecks(stageChecks);
                const technicalChecksCount = row.checks.filter((check) => !isContentCheck(check)).length;
                return (
                  <tr key={row.key} className={`border-b transition-colors hover:bg-muted/50 ${loaded ? '' : 'bg-muted/10 text-muted-foreground'}`}>
                  <td className="break-words px-2 py-3 align-top whitespace-normal">
                    <div className="font-semibold">{sectionCode(row)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.documentTypeId}</div>
                  </td>
                  <td className="break-words px-2 py-3 align-top whitespace-normal">
                    <div className="font-medium">{row.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.required ? 'Обязательный' : 'Дополнительный'} · форматы: {row.formats.join(', ') || '—'}</div>
                    {row.alternativeName && <div className="mt-1 text-xs text-muted-foreground">Альтернатива: {row.alternativeName}</div>}
                  </td>
                  <td className="break-words px-2 py-3 align-top whitespace-normal">
                    {row.files?.length ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">{row.files.length} файл(ов) в разделе</div>
                        {row.files.slice(0, 4).map((file) => (
                          <div key={file.id} className="text-sm">
                            <div className="break-words font-medium">{file.name}</div>
                            <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} КБ · {file.processing?.extractionStatus || 'без OCR'}</div>
                          </div>
                        ))}
                        {row.files.length > 4 && (
                          <div className="text-xs text-muted-foreground">ещё {row.files.length - 4} файл(ов)</div>
                        )}
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Файл не загружен</span>}
                  </td>
                  <td className="px-2 py-3 align-top">
                    {!loaded ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <>
                        {counts.total > 0 ? (
                          <div className="grid grid-cols-5 border text-center text-xs">
                            <CheckCount label="Проверок" value={counts.total} />
                            <CheckCount label="ОК" value={counts.passed} tone="passed" />
                            <CheckCount label="Вопр." value={counts.warning} tone="warning" />
                            <CheckCount label="Нет" value={counts.failed} tone="failed" />
                            <CheckCount label="Н/П" value={counts.skipped} />
                          </div>
                        ) : (
                          <div className="border bg-muted/30 px-2 py-2 text-xs text-muted-foreground">
                            {stage === 'specialized' ? 'Содержательных проверок нет' : 'Проверок этапа нет'}
                          </div>
                        )}
                        {stage === 'primary' && (
                          <div className="mt-1 text-xs text-muted-foreground">Технических проверок файла: {technicalChecksCount}</div>
                        )}
                        {row.findings.length > 0 && <div className="mt-1 text-xs text-muted-foreground">Замечаний: {row.findings.length}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-3 align-top">
                    {loaded ? <StatusBadge status={stageOverall} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-3 text-right align-top">
                    <Button variant="outline" size="sm" className="px-2" onClick={() => onOpenRow(row)}>
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">Открыть</span>
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function sectionCode(row: DocumentReviewRow) {
  const code = row.sectionCode || row.file?.dossierSectionCode || row.documentTypeId;
  return code
    .replace(/^ls-ctd-/i, '')
    .replace(/^ls-national-/i, '')
    .replace(/^mi-/i, '')
    .replace(/-/g, '.');
}

// Натуральная сортировка по коду раздела: "1.2" < "1.6.4" < "3.2.P.8" < "10.1"
function compareSection(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? '';
    const sb = pb[i] ?? '';
    const na = parseInt(sa, 10);
    const nb = parseInt(sb, 10);
    const aNum = !Number.isNaN(na) && /^\d+$/.test(sa);
    const bNum = !Number.isNaN(nb) && /^\d+$/.test(sb);
    if (aNum && bNum) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = sa.localeCompare(sb, 'ru');
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

function isContentCheck(check: DocumentReviewRow['checks'][number]) {
  return check.id.startsWith('npa-requirement-') || check.id.startsWith('fallback-gemma-');
}

function countStatuses(checks: DocumentReviewRow['checks']): Record<ReviewStatus | 'total', number> {
  const counts: Record<ReviewStatus | 'total', number> = {
    total: checks.length,
    passed: 0,
    failed: 0,
    warning: 0,
    skipped: 0,
  };
  for (const check of checks) counts[check.status] += 1;
  return counts;
}

function CheckCount({ label, value, tone }: { label: string; value: number; tone?: 'passed' | 'failed' | 'warning' }) {
  const toneClass = tone === 'passed'
    ? 'text-green-700 dark:text-green-300'
    : tone === 'failed'
      ? 'text-red-700 dark:text-red-300'
      : tone === 'warning'
        ? 'text-yellow-700 dark:text-yellow-300'
        : 'text-muted-foreground';

  return (
    <div className="border-r px-1.5 py-1 last:border-r-0">
      <div className={`font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
