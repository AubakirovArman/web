'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { ExpertServerTask } from '@/components/expert/detail/expert-header';
import { formatElapsed } from '@/components/expert/detail/request-formatters';

export function ServerTaskCard({
  serverTask,
  taskResult,
  taskMessage,
  taskElapsed,
}: {
  serverTask: ExpertServerTask;
  taskResult: string | null;
  taskMessage: string | null;
  taskElapsed: number;
}) {
  if (!serverTask && !taskResult) return null;

  return (
    <Card className="mb-5 border-primary/20 bg-background/90">
      <CardContent className="py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {serverTask && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <span className="font-medium">
                {serverTask === 'extract'
                  ? 'Извлечение файлов'
                  : serverTask === 'check'
                    ? 'Серверная проверка'
                    : serverTask === 'npa-gemma'
                      ? 'Проверка НПА через Gemma'
                      : 'Последняя операция'}
              </span>
              {serverTask && <Badge variant="outline">{formatElapsed(taskElapsed)}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{serverTask ? taskMessage : taskResult}</p>
          </div>
          <div className="w-full lg:w-[360px]">
            <Progress value={serverTask ? Math.min(92, 12 + taskElapsed * 2) : 100} className="h-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              {serverTask ? 'Операция выполняется на сервере. Страницу можно оставить открытой.' : 'Операция завершена.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
