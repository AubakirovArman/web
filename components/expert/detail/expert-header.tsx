'use client';

import Link from 'next/link';
import { Application } from '@/lib/types';
import { FadeIn } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CircleDashed, FileText, Loader2, PlayCircle, RotateCcw, Send } from 'lucide-react';
import { displayApplicationTitle } from '@/components/expert/detail/application-formatters';
import { labelFor } from '@/components/expert/detail/review-logic';

const statusLabels: Record<Application['status'], string> = {
  draft: 'Черновик',
  submitted: 'Подана',
  checking: 'Проверяется',
  checked: 'Предпроверка завершена',
  'expert-review': 'На экспертизе',
};

export type ExpertServerTask = 'extract' | 'check' | 'npa-gemma' | null;

export function ExpertHeader({
  app,
  serverTask,
  onExtractFiles,
  onRunCheck,
  onRunNpaGemmaCheck,
  onStatusChange,
}: {
  app: Application;
  serverTask: ExpertServerTask;
  onExtractFiles: () => void;
  onRunCheck: () => void;
  onRunNpaGemmaCheck: () => void;
  onStatusChange: (status: Application['status']) => void;
}) {
  return (
    <FadeIn>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
            <Link href="/expert">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              К списку заявок
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{displayApplicationTitle(app)}</h1>
          <p className="text-sm text-muted-foreground">
            {app.values['param-object-type'] === 'MI' ? 'Медицинское изделие' : 'Лекарственное средство'} · {labelFor('param-procedure', app.values['param-procedure'])} · {new Date(app.createdAt).toLocaleString('ru-KZ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExtractFiles} disabled={serverTask !== null}>
            {serverTask === 'extract' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Извлечь файлы
          </Button>
          <Button variant="outline" onClick={onRunCheck} disabled={serverTask !== null}>
            {serverTask === 'check' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Серверная проверка
          </Button>
          <Button variant="outline" onClick={onRunNpaGemmaCheck} disabled={serverTask !== null}>
            {serverTask === 'npa-gemma' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleDashed className="mr-2 h-4 w-4" />}
            НПА
          </Button>
          <Button variant="outline" onClick={() => onStatusChange('expert-review')}>
            <Send className="mr-2 h-4 w-4" />
            Взять в работу
          </Button>
          <Button variant="outline" onClick={() => onStatusChange('checked')}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Вернуть
          </Button>
          <Badge className="h-8 px-3" variant={app.status === 'submitted' || app.status === 'expert-review' ? 'default' : 'secondary'}>
            {statusLabels[app.status]}
          </Badge>
        </div>
      </div>
    </FadeIn>
  );
}
