import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="bg-background/90">
      <CardContent className="flex gap-3 py-5 text-sm">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted-foreground">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}
