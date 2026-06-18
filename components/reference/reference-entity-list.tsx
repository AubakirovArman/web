import { Badge } from '@/components/ui/badge';
import { EmptyState } from './reference-common';
import { renderValue } from './reference-utils';
import type { IntelligenceItem } from './reference-types';

export function EntityList({ items, fields, empty }: { items: IntelligenceItem[]; fields: Array<[string, string]>; empty: string }) {
  if (!items.length) return <EmptyState title="Пусто" text={empty} />;
  const hasQuote = items.some((item) => renderValue(item.quote));
  const hasKeywords = items.some((item) => Array.isArray(item.keywords) && item.keywords.length > 0);

  return (
    <div className="overflow-x-auto border bg-background">
      <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-[56px] px-3 py-3 font-medium">№</th>
            {fields.map(([key, label]) => (
              <th key={key} className="min-w-[180px] px-3 py-3 font-medium">{label}</th>
            ))}
            {hasQuote && <th className="min-w-[260px] px-3 py-3 font-medium">Цитата</th>}
            {hasKeywords && <th className="min-w-[180px] px-3 py-3 font-medium">Ключевые слова</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="px-3 py-3 align-top text-xs text-muted-foreground">{index + 1}</td>
              {fields.map(([key]) => {
                const value = renderValue(item[key]);
                return (
                  <td key={key} className="px-3 py-3 align-top">
                    <div className="max-w-[360px] whitespace-pre-wrap break-words leading-6 text-muted-foreground">
                      {value || '—'}
                    </div>
                  </td>
                );
              })}
              {hasQuote && (
                <td className="px-3 py-3 align-top">
                  <div className="max-w-[420px] whitespace-pre-wrap break-words border-l-2 border-primary/50 pl-3 text-xs leading-5 text-muted-foreground">
                    {renderValue(item.quote) || '—'}
                  </div>
                </td>
              )}
              {hasKeywords && (
                <td className="px-3 py-3 align-top">
                  {Array.isArray(item.keywords) && item.keywords.length > 0 ? (
                    <div className="flex max-w-[260px] flex-wrap gap-1.5">
                      {(item.keywords as unknown[]).map((keyword) => <Badge key={String(keyword)} variant="outline">{String(keyword)}</Badge>)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
