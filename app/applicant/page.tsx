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
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

function appSubtype(app: Application): string {
  return (app.values?.['param-object-type'] as string) === 'MI' ? 'МИ' : 'ЛС';
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

  const metrics = useMemo(() => {
    const by = (s: Application['status']) => applications.filter((a) => a.status === s).length;
    return {
      draft: by('draft'),
      submitted: by('submitted'),
      inWork: applications.filter((a) => ['checking', 'checked', 'expert-review'].includes(a.status)).length,
      total: applications.length,
    };
  }, [applications]);

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
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="min-w-0 flex-1 bg-muted/20">
        <div className="w-full px-4 py-4">
          <FadeIn>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Мои заявки</h1>
                <p className="text-sm text-muted-foreground">
                  Создавайте новые заявки, продолжайте черновики и открывайте отправленные.
                </p>
              </div>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Создать заявку
              </Button>
            </div>
          </FadeIn>

          {/* KPI */}
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Черновики', value: metrics.draft, tone: '' },
              { label: 'Поданы', value: metrics.submitted, tone: '' },
              { label: 'В работе', value: metrics.inWork, tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Всего', value: metrics.total, tone: '' },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border bg-card px-3 py-2.5">
                <div className={`text-2xl font-semibold leading-none tabular-nums ${m.tone}`}>{m.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Application['status'] | 'all')}>
              <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы ({applications.length})</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {metrics.draft > 0 && <span className="text-sm text-muted-foreground">Черновиков: {metrics.draft}</span>}
          </div>

          {loadError && (
            <Card className="mb-4 border-destructive/40">
              <CardContent className="py-4 text-sm text-destructive">{loadError}</CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
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
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 px-3">Наименование</TableHead>
                    <TableHead className="h-9 w-16 px-3">Объект</TableHead>
                    <TableHead className="h-9 w-20 px-3 text-right">Файлов</TableHead>
                    <TableHead className="h-9 w-44 px-3">Создана</TableHead>
                    <TableHead className="h-9 w-52 px-3">Статус</TableHead>
                    <TableHead className="h-9 w-32 px-3 text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((app) => (
                    <TableRow
                      key={app.id}
                      className="cursor-pointer"
                      onClick={() => handleOpen(app)}
                    >
                      <TableCell className="px-3 py-2 font-medium">{appTitle(app)}</TableCell>
                      <TableCell className="px-3 py-2 text-muted-foreground">{appSubtype(app)}</TableCell>
                      <TableCell className="px-3 py-2 text-right tabular-nums">{app.files.length}</TableCell>
                      <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString('ru-KZ')}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge variant={statusVariant[app.status]}>{statusLabels[app.status]}</Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-7" onClick={() => handleOpen(app)}>
                            {app.status === 'draft' ? 'Продолжить' : 'Открыть'}
                          </Button>
                          {app.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(app)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Удалить</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
