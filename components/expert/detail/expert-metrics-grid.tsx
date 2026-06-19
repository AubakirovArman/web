'use client';

import { MetricCard } from '@/components/expert/detail/application-summary';

export function ExpertMetricsGrid({ summary, dossierFilesCount, npaGemmaSummary }: { summary: any; dossierFilesCount: number; npaGemmaSummary: any }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      <MetricCard label="Документы" value={`${summary.presentDocuments}/${summary.totalDocuments}`} tone="neutral" />
      <MetricCard label="Файлы досье" value={dossierFilesCount} tone="neutral" />
      <MetricCard label="Пройдено" value={summary.passedDocuments} tone="passed" />
      <MetricCard label="Ошибки" value={summary.failedDocuments} tone="failed" />
      <MetricCard label="Предупреждения" value={summary.warningDocuments} tone="warning" />
      <MetricCard label="Критично" value={summary.criticalFindings} tone="failed" />
      <MetricCard
        label="НПА"
        value={`${npaGemmaSummary.passed}/${npaGemmaSummary.total}`}
        tone={npaGemmaSummary.failed || npaGemmaSummary.uncertain ? 'warning' : npaGemmaSummary.total ? 'passed' : 'neutral'}
      />
    </div>
  );
}
