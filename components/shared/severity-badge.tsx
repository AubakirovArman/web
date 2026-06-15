import { Badge } from '@/components/ui/badge';
import { Severity } from '@/lib/types';

const styles: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-100',
  serious: 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-100',
  warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-100',
  unknown: 'bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100',
};

const labels: Record<Severity, string> = {
  critical: 'Критично',
  serious: 'Серьезно',
  warning: 'Предупреждение',
  unknown: 'Неизвестно',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge className={styles[severity]} variant="secondary">
      {labels[severity]}
    </Badge>
  );
}
