'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { Application } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusLabels: Record<Application['status'], string> = {
  draft: 'Черновик',
  submitted: 'Подана',
  checking: 'Проверяется',
  checked: 'Предпроверка завершена',
  'expert-review': 'На экспертизе',
};

const statusVariant: Record<Application['status'], 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  checking: 'secondary',
  checked: 'default',
  'expert-review': 'default',
};

function appTitle(app: Application): string {
  const v = app.values || {};
  return (
    (v['param-trade-name'] as string) ||
    (v['param-mi-name-ru'] as string) ||
    (v['param-trade-name-ru'] as string) ||
    'Без названия'
  );
}

export default function ApplicantPage() {
  const { applications, isLoading, loadError, createApplication, deleteApplication, setCurrentId } = useApplications();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<Application['status'] | 'all'>('all');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .filter((app) => statusFilter === 'all' || app.status === statusFilter),
    [applications, statusFilter],
  );

  const draftCount = applications.filter((a) => a.status === 'draft').length;

  const handleCreate = () => {
    setCreating(true);
    const app = createApplication();
    router.push(`/wizard?id=${encodeURIComponent(app.id)}`);
  };

  const handleOpen = (app: Application) => {
    setCurrentId(app.id);
    router.push(`/wizard?id=${encodeURIComponent(app.id)}`);
  };

  const handleDelete = async (app: Application) => {
    if (!window.confirm(`Удалить заявку «${appTitle(app)}»?`)) return;
    try {
      await deleteApplication(app.id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-4">
          <FadeIn>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Мои заявки</h1>
                <p className="text-sm text-muted-foreground">
                  Создавайте новые заявки, продолжайте черновики и открывайте отправленные.
                </p>
              </div>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Создать заявку
              </Button>
            </div>
          </FadeIn>

          <div className="mb-4 flex items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Application['status'] | 'all')}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы ({applications.length})</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {draftCount > 0 && <span className="text-sm text-muted-foreground">Черновиков: {draftCount}</span>}
          </div>

          {loadError && (
            <Card className="mb-4 border-destructive/40">
              <CardContent className="py-4 text-sm text-destructive">{loadError}</CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Заявок пока нет</p>
                  <p className="text-sm text-muted-foreground">Создайте первую заявку, чтобы начать.</p>
                </div>
                <Button onClick={handleCreate} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" /> Создать заявку
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rows.map((app) => (
                <Card key={app.id} className="transition-colors hover:bg-muted/40">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 py-3">
                    <button onClick={() => handleOpen(app)} className="min-w-0 flex-1 text-left">
                      <CardTitle className="truncate text-base">{appTitle(app)}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{(app.values?.['param-object-type'] as string) === 'MI' ? 'МИ' : 'ЛС'}</span>
                        <span>·</span>
                        <span>{app.files.length} файлов</span>
                        <span>·</span>
                        <span>{new Date(app.createdAt).toLocaleString('ru-KZ')}</span>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={statusVariant[app.status]}>{statusLabels[app.status]}</Badge>
                      <Button variant="outline" size="sm" onClick={() => handleOpen(app)}>
                        {app.status === 'draft' ? 'Продолжить' : 'Открыть'}
                      </Button>
                      {app.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(app)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Удалить</span>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
