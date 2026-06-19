import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';
import { Severity } from '@/lib/types';

// Soft "tint" pills, tuned for both light and dark themes. Single source of truth.
const styles: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-100',
  serious: 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-100',
  warning: 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-100',
  unknown: 'bg-muted text-muted-foreground hover:bg-muted',
};

const labels: Record<Severity, string> = {
  critical: 'Критично',
  serious: 'Серьёзно',
  warning: 'Предупреждение',
  unknown: 'Неизвестно',
};

export function SeverityBadge({
  severity,
  count,
  label,
  className,
}: {
  severity: Severity;
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(styles[severity], className)}>
      {label ?? labels[severity]}
      {typeof count === 'number' ? ` ${count}` : ''}
    </Badge>
  );
}

/** "Без замечаний" pill — uses the success token so it tracks both themes. */
export function CleanBadge({ className, label = 'Без замечаний' }: { className?: string; label?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn('border-success/30 bg-success/10 text-success hover:bg-success/10 dark:bg-success/15', className)}
    >
      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
