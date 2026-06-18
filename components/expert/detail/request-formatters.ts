import { Application } from '@/lib/types';
import { displayApplicationTitle } from '@/components/expert/detail/application-formatters';
import { findingReviewStatus } from '@/components/expert/detail/finding-card';

export function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes} мин ${rest} сек` : `${rest} сек`;
}

export function buildApplicantRequest(app: Application | undefined): string {
  if (!app || app.findings.length === 0) return '';
  const excludedStatuses = new Set(['accepted', 'rejected', 'false-positive', 'not-applicable', 'resolved']);
  const actionable = app.findings.filter((finding) => !excludedStatuses.has(findingReviewStatus(finding)) && finding.accepted !== true);
  if (actionable.length === 0) return '';
  const title = displayApplicationTitle(app) || app.id;
  const lines = actionable.map((finding, index) => {
    const docs = finding.documents.length ? ` Документы: ${finding.documents.join(', ')}.` : '';
    const npa = finding.npaReference ? ` НПА: ${finding.npaReference}.` : '';
    return `${index + 1}. ${finding.title}\n${finding.description}${docs}${npa}\nРекомендация: ${finding.recommendation}`;
  });
  return [`Запрос по заявке: ${title}`, '', ...lines].join('\n');
}
