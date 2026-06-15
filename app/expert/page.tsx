'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { FindingCard } from '@/components/shared/finding-card';
import { SeverityBadge } from '@/components/shared/severity-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertCircle, FileText, ArrowLeft, PlayCircle, CheckSquare, RotateCcw, Send, ExternalLink, Eye, Download } from 'lucide-react';
import { Application, Finding, UploadedFile } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { documentTypes, parameters, productTypeLabels } from '@/lib/data/seed';

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
        <ExpertPageInner />
      </Suspense>
    );
  }

function ExpertPageInner() {
  const searchParams = useSearchParams();
  const { applications, runCheck, updateFinding, updateStatus, setCurrentId } = useApplications();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Finding['severity'] | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (applications.length === 0) return;
    const queryId = searchParams.get('id');
    const targetId = queryId && applications.some((a) => a.id === queryId) ? queryId : applications[0].id;
    if (selectedId !== targetId) {
      setSelectedId(targetId);
      setCurrentId(targetId);
    }
  }, [searchParams, applications, selectedId, setCurrentId]);

  const selectedApp = useMemo(() => applications.find((a) => a.id === selectedId), [applications, selectedId]);
  const findingCategories = useMemo(
    () => Array.from(new Set((selectedApp?.findings || []).map((finding) => finding.category))).sort(),
    [selectedApp]
  );
  const filteredFindings = useMemo(() => {
    const findings = selectedApp?.findings || [];
    return findings.filter((finding) => {
      if (severityFilter !== 'all' && finding.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && finding.category !== categoryFilter) return false;
      return true;
    });
  }, [selectedApp, severityFilter, categoryFilter]);
  const requestText = useMemo(() => buildApplicantRequest(selectedApp, filteredFindings), [selectedApp, filteredFindings]);

  const handleReject = (finding: Finding) => {
    if (!selectedApp) return;
    updateFinding(selectedApp.id, finding.id, { accepted: false, status: 'rejected' });
    toast.success('Замечание отклонено');
  };

  const handleAccept = (finding: Finding) => {
    if (!selectedApp) return;
    updateFinding(selectedApp.id, finding.id, { accepted: true, status: 'accepted' });
    toast.success('Замечание принято');
  };

  const handleNotApplicable = (finding: Finding) => {
    if (!selectedApp) return;
    updateFinding(selectedApp.id, finding.id, { accepted: null, status: 'not-applicable' });
    toast.success('Замечание помечено как неприменимое');
  };

  const handleCopyRequest = async () => {
    if (!requestText) return;
    try {
      await navigator.clipboard.writeText(requestText);
      toast.success('Текст запроса скопирован');
    } catch {
      toast.success('Текст запроса сформирован');
    }
  };

  const handleRunCheck = (id: string) => {
    runCheck(id);
    toast.success('Предпроверка выполнена');
  };

  const handleStatusChange = (status: Application['status']) => {
    if (!selectedApp) return;
    updateStatus(selectedApp.id, status);
    toast.success(`Статус изменён на «${statusLabels[status]}»`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="container mx-auto max-w-7xl px-4">
          <FadeIn>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Кабинет эксперта</h1>
                <p className="text-sm text-muted-foreground">Предварительные результаты проверки заявок</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/wizard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад к заявке
                </Link>
              </Button>
            </div>
          </FadeIn>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Заявки</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-14rem)]">
                  <div className="space-y-1 p-2">
                    {applications.map((app) => {
                      const critical = app.findings.filter((f) => f.severity === 'critical').length;
                      const serious = app.findings.filter((f) => f.severity === 'serious').length;
                      const active = selectedId === app.id;
                      return (
                        <button
                          key={app.id}
                          onClick={() => {
                            setSelectedId(app.id);
                            setCurrentId(app.id);
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{app.values['param-trade-name'] || 'Без названия'}</span>
                            <Badge variant="secondary">{statusLabels[app.status]}</Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{productTypeLabels[app.values['param-product-type'] as keyof typeof productTypeLabels] || app.values['param-product-type']}</span>
                            <span>·</span>
                            <span>{new Date(app.createdAt).toLocaleDateString('ru-KZ')}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {critical > 0 && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-100">
                                Критично: {critical}
                              </span>
                            )}
                            {serious > 0 && (
                              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-100">
                                Серьезно: {serious}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              {selectedApp ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedApp.values['param-trade-name'] || 'Заявка'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Тип процедуры" value={labelFor('param-procedure', selectedApp.values['param-procedure'])} />
                        <Field label="Тип продукта" value={productTypeLabels[selectedApp.values['param-product-type'] as keyof typeof productTypeLabels] || selectedApp.values['param-product-type']} />
                        <Field label="Лекарственная форма" value={labelFor('param-dosage-form', selectedApp.values['param-dosage-form'])} />
                        <Field label="Дозировка" value={selectedApp.values['param-dosage']} />
                        <Field label="МНН" value={selectedApp.values['param-inn']} />
                        <Field label="Путь введения" value={labelFor('param-administration-route', selectedApp.values['param-administration-route'])} />
                        <Field label="Форма отпуска" value={labelFor('param-dispensing', selectedApp.values['param-dispensing'])} />
                        <Field label="Производитель" value={selectedApp.values['param-manufacturer']} />
                        <Field label="Адрес производства" value={selectedApp.values['param-manufacturer-address']} />
                        <Field label="Заявитель" value={selectedApp.values['param-applicant']} />
                      </div>
                      <Separator />
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={() => handleRunCheck(selectedApp.id)}>
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Перезапустить проверку
                        </Button>
                        <Button variant="outline" onClick={() => handleStatusChange('expert-review')}>
                          <Send className="mr-2 h-4 w-4" />
                          Взять в работу
                        </Button>
                        <Button variant="outline" onClick={() => handleStatusChange('checked')}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Вернуть
                        </Button>
                        <Badge variant="outline">{statusLabels[selectedApp.status]}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <SummaryCards findings={selectedApp.findings} />

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-lg font-semibold">
                        Замечания ({filteredFindings.length} из {selectedApp.findings.length})
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={severityFilter}
                          onChange={(event) => setSeverityFilter(event.target.value as Finding['severity'] | 'all')}
                          aria-label="Фильтр по критичности"
                        >
                          <option value="all">Все уровни</option>
                          <option value="critical">Критично</option>
                          <option value="serious">Серьезно</option>
                          <option value="warning">Предупреждение</option>
                          <option value="unknown">Неизвестно</option>
                        </select>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={categoryFilter}
                          onChange={(event) => setCategoryFilter(event.target.value)}
                          aria-label="Фильтр по категории"
                        >
                          <option value="all">Все категории</option>
                          {findingCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <Button variant="outline" size="sm" onClick={handleCopyRequest} disabled={!requestText}>
                          Сформировать запрос
                        </Button>
                      </div>
                    </div>
                    {requestText && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Черновик запроса заявителю</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
                            {requestText}
                          </pre>
                        </CardContent>
                      </Card>
                    )}
                    {selectedApp.findings.length === 0 && (
                      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                        <CardContent className="flex items-center gap-3 py-6">
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                          <span className="font-medium">Замечаний нет</span>
                        </CardContent>
                      </Card>
                    )}
                    {filteredFindings.map((finding) => (
                      <div key={finding.id} className="space-y-3">
                        <FindingCard finding={finding} />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={finding.accepted === true ? 'default' : 'outline'}
                            onClick={() => handleAccept(finding)}
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            Принять
                          </Button>
                          <Button
                            size="sm"
                            variant={finding.accepted === false ? 'default' : 'outline'}
                            onClick={() => handleReject(finding)}
                          >
                            <XCircle className="mr-1.5 h-4 w-4" />
                            Отклонить
                          </Button>
                          <Button
                            size="sm"
                            variant={finding.status === 'not-applicable' ? 'default' : 'outline'}
                            onClick={() => handleNotApplicable(finding)}
                          >
                            Не применимо
                          </Button>
                          {finding.accepted === true && <span className="text-xs text-green-600">Принято</span>}
                          {finding.accepted === false && <span className="text-xs text-muted-foreground">Отклонено</span>}
                          {finding.status === 'not-applicable' && <span className="text-xs text-muted-foreground">Не применимо</span>}
                        </div>
                      </div>
                    ))}
                    {selectedApp.findings.length > 0 && filteredFindings.length === 0 && (
                      <Card>
                        <CardContent className="py-6 text-sm text-muted-foreground">
                          По выбранным фильтрам замечаний нет.
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {selectedApp.files.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Загруженные файлы
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedApp.files.map((file) => (
                          <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{file.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {documentTypes.find((d) => d.id === file.documentTypeId)?.name} · {(file.size / 1024).toFixed(1)} КБ
                              </div>
                              {file.processing?.extractionStatus && (
                                <div className="text-xs text-muted-foreground">
                                  OCR/LLM: {file.processing.extractionStatus} · hash {file.hash?.slice(0, 10) || '—'}
                                </div>
                              )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setViewingFile(file)}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Просмотр
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {viewingFile && (
                    <DocumentViewer file={viewingFile} onClose={() => setViewingFile(null)} />
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <AlertCircle className="mb-4 h-10 w-10" />
                    <p>Выберите заявку из списка</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DocumentViewer({ file, onClose }: { file: UploadedFile; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file.url) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const txtUrl = `${file.url}.txt`;
    if (['pdf', 'docx', 'doc'].includes(ext || '')) {
      setLoading(true);
      fetch(txtUrl)
        .then((res) => (res.ok ? res.text() : Promise.reject()))
        .then(setText)
        .catch(() => setText(null))
        .finally(() => setLoading(false));
    }
  }, [file]);

  const ext = file.name.split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  const docName = documentTypes.find((d) => d.id === file.documentTypeId)?.name;
  const defaultTab = text ? 'text' : 'preview';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {file.name}
          </DialogTitle>
          <DialogDescription>
            {docName} · {(file.size / 1024).toFixed(1)} КБ
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 border-t">
          {file.url ? (
            <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-2">
                {(isPdf || isImage) && <TabsTrigger value="preview">{isPdf ? 'Документ' : 'Изображение'}</TabsTrigger>}
                {text && <TabsTrigger value="text">Текст</TabsTrigger>}
                <TabsTrigger value="data">Извлечённые данные</TabsTrigger>
              </TabsList>
              {isPdf && (
                <TabsContent value="preview" className="flex-1 min-h-0 p-0">
                  <iframe src={file.url} className="w-full h-full border-0" title={file.name} />
                </TabsContent>
              )}
              {isImage && (
                <TabsContent value="preview" className="flex-1 min-h-0 overflow-auto p-4">
                  <img src={file.url} alt={file.name} className="max-w-full rounded-md border" />
                </TabsContent>
              )}
              {text && (
                <TabsContent value="text" className="flex-1 min-h-0 overflow-auto p-4">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Загрузка текста…</p>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">{text}</pre>
                  )}
                </TabsContent>
              )}
              <TabsContent value="data" className="flex-1 min-h-0 overflow-auto p-4">
                <ExtractedData file={file} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="p-4">
              <ExtractedData file={file} />
            </div>
          )}
        </div>
        <div className="border-t p-3 flex items-center justify-end gap-2 bg-muted/50">
          {file.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={file.url} target="_blank" rel="noopener noreferrer" download>
                <Download className="mr-1.5 h-4 w-4" />
                Скачать
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onClose}>Закрыть</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildApplicantRequest(app: Application | undefined, findings: Finding[]): string {
  if (!app || findings.length === 0) return '';
  const actionable = findings.filter((finding) => finding.status !== 'not-applicable' && finding.accepted !== false);
  if (actionable.length === 0) return '';
  const title = app.values['param-trade-name'] || app.id;
  const lines = actionable.map((finding, index) => {
    const docs = finding.documents.length ? ` Документы: ${finding.documents.join(', ')}.` : '';
    const npa = finding.npaReference ? ` НПА: ${finding.npaReference}.` : '';
    return `${index + 1}. ${finding.title}\n${finding.description}${docs}${npa}\nРекомендация: ${finding.recommendation}`;
  });
  return [`Запрос по заявке: ${title}`, '', ...lines].join('\n');
}

function ExtractedData({ file }: { file: UploadedFile }) {
  if (!file.extracted || Object.keys(file.extracted).length === 0) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>Для этого документа не сформированы извлечённые поля.</p>
        <p className="mt-1">
          Если файл был загружен вручную, поля появятся после распознавания. Для демо-документов некоторые
          вспомогательные файлы могут не содержать структурированных данных.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Meta label="Hash" value={file.hash} />
        <Meta label="Версия" value={file.version ? String(file.version) : undefined} />
        <Meta label="Загружен" value={file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('ru-KZ') : undefined} />
        <Meta label="Статус извлечения" value={file.processing?.extractionStatus} />
        <Meta label="Provider" value={file.processing?.provider} />
        <Meta label="Prompt" value={file.processing?.promptVersion} />
      </div>
      <Separator />
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(file.extracted).map(([key, value]) => (
          <div key={key} className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground uppercase">{key}</p>
            <p className="text-sm">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="break-all text-sm">{value || '—'}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | string[] }) {
  const display = Array.isArray(value) ? value.join(', ') : value || '—';
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{display}</p>
    </div>
  );
}

function labelFor(parameterId: string, value?: string | string[]) {
  if (Array.isArray(value)) return value.join(', ');
  const param = parameters.find((p) => p.id === parameterId);
  return param?.options?.find((o) => o.value === value)?.label || value || '—';
}

function SummaryCards({ findings }: { findings: Finding[] }) {
  const counts = useMemo(() => {
    return {
      critical: findings.filter((f) => f.severity === 'critical').length,
      serious: findings.filter((f) => f.severity === 'serious').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      unknown: findings.filter((f) => f.severity === 'unknown').length,
    };
  }, [findings]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <CountCard label="Критично" count={counts.critical} color="text-red-600" bg="bg-red-50 dark:bg-red-950/20" />
      <CountCard label="Серьезно" count={counts.serious} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-950/20" />
      <CountCard label="Предупреждения" count={counts.warning} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-950/20" />
      <CountCard label="Неизвестно" count={counts.unknown} color="text-slate-600" bg="bg-slate-50 dark:bg-slate-800" />
    </div>
  );
}

function CountCard({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
    </div>
  );
}
