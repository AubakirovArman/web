'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MiniMetric } from '@/components/expert/detail/application-summary';

export function NpaGemmaSummaryCard({ summary }: { summary: any | null }) {
  if (!summary) return null;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Сводка НПА</CardTitle>
        <p className="text-sm text-muted-foreground">Быстрый срез смысловой проверки требований по загруженным документам.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <MiniMetric label="Выполнено" value={summary.byStatus.passed || 0} />
          <MiniMetric label="Не подтверждено" value={summary.byStatus.failed || 0} />
          <MiniMetric label="Неясно" value={summary.byStatus.uncertain || 0} />
          <MiniMetric label="Не применимо" value={summary.byStatus.not_applicable || 0} />
        </div>
        {summary.topProblemDocuments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Больше всего замечаний по типам документов</div>
            <div className="grid gap-2 lg:grid-cols-2">
              {summary.topProblemDocuments.slice(0, 6).map((item: any) => (
                <div key={item.documentTypeId} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.documentTypeId}</div>
                    </div>
                    <Badge variant="outline">{item.total}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {item.critical > 0 && <Badge variant="destructive">критично: {item.critical}</Badge>}
                    {item.serious > 0 && <Badge variant="secondary">значимо: {item.serious}</Badge>}
                    {item.warning > 0 && <Badge variant="outline">предупр.: {item.warning}</Badge>}
                    {item.unknown > 0 && <Badge variant="outline">неясно: {item.unknown}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
