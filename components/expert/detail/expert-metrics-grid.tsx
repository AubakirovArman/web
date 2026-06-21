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
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      <MetricCard label="Разделы" value={`${summary.sectionsPresent}/${summary.sectionsRequired}`} tone="neutral" />
      <MetricCard label="Файлы досье" value={dossierFilesCount} tone="neutral" />
      <MetricCard label="Не хватает разделов" value={summary.sectionsMissing} tone={summary.sectionsMissing ? 'warning' : 'passed'} />
      <MetricCard label="Критично" value={summary.critical} tone="failed" />
      <MetricCard label="Предупреждения" value={summary.warning} tone="warning" />
      <MetricCard label="Неясно" value={summary.unknown} tone="neutral" />
      <MetricCard
        label="НПА"
        value={`${npaGemmaSummary.passed}/${npaGemmaSummary.total}`}
        tone={npaGemmaSummary.failed || npaGemmaSummary.uncertain ? 'warning' : npaGemmaSummary.total ? 'passed' : 'neutral'}
      />
    </div>
  );
}
