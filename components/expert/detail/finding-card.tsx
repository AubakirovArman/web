'use client';

import { Finding } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FindingMethodBadge, SeverityBadge } from '@/components/expert/detail/review-badges';

export function FindingCard({
  finding,
  onPatch,
  compact = false,
}: {
  finding: Finding;
  onPatch: (patch: Partial<Finding>) => void;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-background ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <FindingMethodBadge finding={finding} />
            <span className="break-words font-medium">{finding.title}</span>
          </div>
          <p className={`mt-1 whitespace-pre-wrap text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{finding.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">{finding.npaReference || 'Источник не указан'}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <div className="flex flex-wrap justify-start gap-2 md:justify-end">
            <Button size="sm" variant={finding.status === 'accepted' || finding.accepted === true ? 'default' : 'outline'} onClick={() => onPatch({ accepted: true, status: 'accepted' })}>Принять</Button>
            <Button size="sm" variant={finding.status === 'rejected' ? 'default' : 'outline'} onClick={() => onPatch({ accepted: false, status: 'rejected' })}>Отклонить</Button>
            <Button size="sm" variant={finding.status === 'false-positive' ? 'default' : 'outline'} onClick={() => onPatch({ accepted: false, status: 'false-positive' })}>Ложное</Button>
            <Button size="sm" variant={finding.status === 'needs-clarification' ? 'default' : 'outline'} onClick={() => onPatch({ accepted: null, status: 'needs-clarification' })}>Уточнить</Button>
          </div>
          <FindingReviewStatusBadge finding={finding} />
        </div>
      </div>
    </div>
  );
}

function FindingReviewStatusBadge({ finding }: { finding: Finding }) {
  const status = findingReviewStatus(finding);
  const labels: Record<string, string> = {
    open: 'Открыто',
    accepted: 'Принято экспертом',
    rejected: 'Отклонено',
    'false-positive': 'Ложное срабатывание',
    'needs-clarification': 'Запросить уточнение',
    'not-applicable': 'Не применимо',
    resolved: 'Закрыто',
  };
  const styles: Record<string, string> = {
    open: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
    accepted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100',
    rejected: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100',
    'false-positive': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100',
    'needs-clarification': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100',
    'not-applicable': 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.open}`}>{labels[status] || status}</span>;
}

export function findingReviewStatus(finding: Finding): string {
  if (finding.status) return finding.status;
  if (finding.accepted === true) return 'accepted';
  if (finding.accepted === false) return 'rejected';
  return 'open';
}

