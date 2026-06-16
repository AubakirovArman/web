'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { documentTypes, parameters, productTypeLabels } from '@/lib/data/seed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Application } from '@/lib/types';
import { ArrowRight, CheckCircle2, ClipboardList, FileText, Loader2, Search, Sparkles, XCircle } from 'lucide-react';

const statusLabels: Record<Application['status'], string> = {
  draft: 'Черновик',
  submitted: 'Подана',
  checking: 'Проверяется',
  checked: 'Предпроверка завершена',
  'expert-review': 'На экспертизе',
};

export default function ExpertPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Загрузка…</div>}>
      <ExpertListPage />
    </Suspense>
  );
}

function ExpertListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { applications, importApplication, runCheck, setCurrentId } = useApplications();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Application['status'] | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'clean' | 'critical' | 'serious' | 'warning'>('all');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const legacyId = searchParams.get('id');
    if (legacyId) router.replace(`/expert/${legacyId}`);
  }, [router, searchParams]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...applications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((app) => {
        if (statusFilter !== 'all' && app.status !== statusFilter) return false;
        const counts = getFindingCounts(app);
        if (severityFilter === 'clean' && app.findings.length > 0) return false;
        if (severityFilter !== 'all' && severityFilter !== 'clean' && counts[severityFilter] === 0) return false;
        if (!normalizedQuery) return true;
        const searchable = [
          app.id,
          app.values['param-trade-name'],
          app.values['param-inn'],
          app.values['param-applicant'],
          app.values['param-manufacturer'],
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      });
  }, [applications, query, severityFilter, statusFilter]);

  const totals = useMemo(() => {
    const submitted = applications.filter((app) => app.status === 'submitted').length;
    const inReview = applications.filter((app) => app.status === 'expert-review').length;
    const clean = applications.filter((app) => app.findings.length === 0).length;
    const withCritical = applications.filter((app) => getFindingCounts(app).critical > 0).length;
    return { submitted, inReview, clean, withCritical };
  }, [applications]);

  const seedScenario = async (scenario: string) => {
    const res = await fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Seed failed');
    return res.json();
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const data = await seedScenario('ideal');
      importApplication(data.app);
      setCurrentId(data.app.id);
      toast.success('Эталонная заявка создана');
      router.push(`/expert/${data.app.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Не удалось создать демо-заявку');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedNegativeScenarios = async () => {
    setSeeding(true);
    try {
      const scenarios = ['missing-gmp', 'expired-cpp', 'field-mismatch', 'bad-docx-format'];
      const payloads = [];
      for (const scenario of scenarios) payloads.push(await seedScenario(scenario));
      payloads.forEach((payload) => importApplication(payload.app));
      const last = payloads[payloads.length - 1]?.app;
      if (last) setCurrentId(last.id);
      toast.success(`Созданы негативные кейсы: ${payloads.length}`);
    } catch (err: any) {
      toast.error(err.message || 'Не удалось создать негативные кейсы');
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickCheck = (app: Application) => {
    runCheck(app.id);
    toast.success('Проверка заявки обновлена');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="container mx-auto max-w-[1500px] px-4">
          <FadeIn>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Кабинет эксперта</h1>
                <p className="text-sm text-muted-foreground">Список заявок, статус предэкспертизы и быстрый вход в досье.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href="/wizard">Создать заявку</Link>
                </Button>
                <Button onClick={handleSeedDemo} disabled={seeding}>
                  {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Эталонная заявка
                </Button>
                <Button variant="secondary" onClick={handleSeedNegativeScenarios} disabled={seeding}>
                  Негативные кейсы
                </Button>
              </div>
            </div>
          </FadeIn>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Всего заявок" value={applications.length} icon={<ClipboardList className="h-4 w-4" />} />
            <MetricCard label="Поданы" value={totals.submitted} icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="На экспертизе" value={totals.inReview} icon={<ArrowRight className="h-4 w-4" />} />
            <MetricCard label="Без замечаний" value={totals.clean} icon={<CheckCircle2 className="h-4 w-4" />} />
          </div>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <CardTitle>Заявки</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-[260px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по препарату, МНН, заявителю" className="pl-8" />
                  </div>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Application['status'] | 'all')}>
                    <option value="all">Все статусы</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}>
                    <option value="all">Все результаты</option>
                    <option value="clean">Без замечаний</option>
                    <option value="critical">Есть критичные</option>
                    <option value="serious">Есть серьёзные</option>
                    <option value="warning">Есть предупреждения</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Заявка</TableHead>
                    <TableHead>Тип / процедура</TableHead>
                    <TableHead>Заявитель</TableHead>
                    <TableHead>Документы</TableHead>
                    <TableHead>Проверки</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((app) => {
                    const counts = getFindingCounts(app);
                    const clean = app.findings.length === 0;
                    return (
                      <TableRow key={app.id}>
                        <TableCell className="min-w-[260px] whitespace-normal">
                          <div className="font-medium">{app.values['param-trade-name'] || 'Без названия'}</div>
                          <div className="text-xs text-muted-foreground">{app.values['param-inn'] || 'МНН не указан'} · {new Date(app.createdAt).toLocaleString('ru-KZ')}</div>
                        </TableCell>
                        <TableCell className="min-w-[210px] whitespace-normal">
                          <div>{objectLabel(app)} · {labelFor('param-procedure', app.values['param-procedure'])}</div>
                          <div className="text-xs text-muted-foreground">{productTypeLabels[app.values['param-product-type'] as keyof typeof productTypeLabels] || app.values['param-product-type'] || '—'}</div>
                        </TableCell>
                        <TableCell className="min-w-[220px] whitespace-normal">
                          <div>{app.values['param-applicant'] || '—'}</div>
                          <div className="text-xs text-muted-foreground">{app.values['param-manufacturer'] || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{app.files.length} файлов</Badge>
                        </TableCell>
                        <TableCell className="min-w-[240px] whitespace-normal">
                          {clean ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-100">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Без замечаний
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {counts.critical > 0 && <Badge className="bg-red-600">Критично {counts.critical}</Badge>}
                              {counts.serious > 0 && <Badge className="bg-orange-600">Серьёзно {counts.serious}</Badge>}
                              {counts.warning > 0 && <Badge variant="secondary">Предупр. {counts.warning}</Badge>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={app.status === 'submitted' || app.status === 'expert-review' ? 'default' : 'secondary'}>{statusLabels[app.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleQuickCheck(app)}>
                              Проверить
                            </Button>
                            <Button size="sm" asChild>
                              <Link href={`/expert/${app.id}`}>
                                Открыть
                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        <XCircle className="mx-auto mb-2 h-6 w-6" />
                        Заявки по выбранным фильтрам не найдены.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-2 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function getFindingCounts(app: Application) {
  return {
    critical: app.findings.filter((finding) => finding.severity === 'critical').length,
    serious: app.findings.filter((finding) => finding.severity === 'serious').length,
    warning: app.findings.filter((finding) => finding.severity === 'warning').length,
    unknown: app.findings.filter((finding) => finding.severity === 'unknown').length,
  };
}

function objectLabel(app: Application) {
  return app.values['param-object-type'] === 'MI' ? 'МИ' : 'ЛС';
}

function labelFor(parameterId: string, value?: string | string[]) {
  if (Array.isArray(value)) return value.join(', ');
  const param = parameters.find((item) => item.id === parameterId);
  return param?.options?.find((option) => option.value === value)?.label || value || '—';
}
