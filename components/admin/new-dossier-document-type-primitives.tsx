import { Badge } from '@/components/ui/badge';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';

export function RequirednessBadge({ item, hasRule = false }: { item: NewDossierDocumentType; hasRule?: boolean }) {
  if (item.kind === 'excluded' || !item.active) {
    return <Badge variant="outline">Не активен</Badge>;
  }
  if (item.kind === 'section') {
    return <Badge variant="outline">Раздел</Badge>;
  }
  if (!hasRule) {
    return <Badge variant="outline">Нет правила</Badge>;
  }
  const text = item.name.toLowerCase();
  if (text.includes('при наличии') || text.includes('при необходимости')) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-100">При наличии</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-100">Обязателен</Badge>;
}

export function DetailMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

