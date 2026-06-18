import { renderGemmaValue } from '@/lib/admin/document-type-logic';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';

export function GemmaObjectList({
  items,
  fields,
  emptyLabel,
}: {
  items: Record<string, unknown>[];
  fields: Array<[string, string]>;
  emptyLabel: string;
}) {
  if (!items.length) return <EmptyAdminBlock text={emptyLabel} />;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border bg-muted/20 p-4">
          <div className="space-y-2 text-sm">
            {fields.map(([key, label]) => {
              const value = renderGemmaValue(item[key]);
              if (!value) return null;
              return (
                <p key={key}>
                  <span className="font-medium">{label}: </span>
                  <span className="text-muted-foreground">{value}</span>
                </p>
              );
            })}
          </div>
          {renderGemmaValue(item.quote) && (
            <blockquote className="mt-3 rounded-lg border-l-4 border-primary/50 bg-background p-3 text-sm text-muted-foreground">
              {renderGemmaValue(item.quote)}
            </blockquote>
          )}
        </div>
      ))}
    </div>
  );
}


export function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

