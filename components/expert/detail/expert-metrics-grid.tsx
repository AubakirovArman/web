'use client';

import { MetricCard } from '@/components/expert/detail/application-summary';
import type { ReviewSummaryData } from '@/components/expert/detail/review-summary';

export function ExpertMetricsGrid({
  summary,
  dossierFilesCount,
  npaGemmaSummary,
}: {
  summary: ReviewSummaryData;
  dossierFilesCount: number;
  npaGemmaSummary: any;
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Файлы досье" value={dossierFilesCount} tone="neutral" />
      <MetricCard label="Критично" value={summary.critical} tone="failed" />
      <MetricCard label="Серьёзно" value={summary.serious} tone={summary.serious ? 'failed' : 'passed'} />
      <MetricCard label="Предупреждения" value={summary.warning} tone="warning" />
    </div>
  );
}
