import { Finding } from '@/lib/types';
import { SeverityBadge } from './severity-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Quote, BookOpen } from 'lucide-react';

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <Card className="border-l-4 border-l-primary/20 hover:border-l-primary/60 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{finding.category}</p>
            <CardTitle className="text-base font-semibold">{finding.title}</CardTitle>
          </div>
          <SeverityBadge severity={finding.severity} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>

        {finding.quotes && finding.quotes.length > 0 && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Quote className="h-3.5 w-3.5" />
              <span>Фрагменты документов</span>
            </div>
            <ul className="space-y-2">
              {finding.quotes.map((q, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-foreground">{q.source}:</span>{' '}
                  <span className="italic text-muted-foreground">«{q.text}»</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Затронутые документы</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {finding.documents.map((doc, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                {doc}
              </span>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">Рекомендация</p>
          <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
        </div>

        {finding.npaReference && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <span>НПА: {finding.npaReference}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
