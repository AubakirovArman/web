'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { useRules } from '@/lib/hooks/useRules';
import { getRequiredDocuments } from '@/lib/rules/engine';
import { checkDefinitions, getCheckDefinition } from '@/lib/checks/registry';
import { buildApplicationCheckMatrix } from '@/lib/checks/matrix';
import { documentTypes, parameters, productTypeLabels, rules as seedRules } from '@/lib/data/seed';
import { Application, Finding, RequiredDoc, RuleCondition, UploadedFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Download,
  Eye,
  FileText,
  PlayCircle,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';

const statusLabels: Record<Application['status'], string> = {
  draft: 'Черновик',
  submitted: 'Подана',
  checking: 'Проверяется',
  checked: 'Предпроверка завершена',
  'expert-review': 'На экспертизе',
};

type ReviewStatus = 'passed' | 'failed' | 'warning' | 'skipped';

interface ReviewCheckCell {
  id: string;
  name: string;
  status: ReviewStatus;
  severity?: Finding['severity'];
  findings: Finding[];
  description?: string;
  npaReferences?: string[];
}

interface DocumentReviewRow {
  key: string;
  documentTypeId: string;
  name: string;
  required: boolean;
  severity?: Finding['severity'];
  formats: string[];
  file?: UploadedFile;
  checks: ReviewCheckCell[];
  findings: Finding[];
  overall: ReviewStatus;
  ruleName?: string;
  conditionText?: string;
  alternativeName?: string;
}

export function ExpertApplicationDetail() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const { applications, runCheck, updateFinding, updateStatus, setCurrentId } = useApplications();
  const { rules } = useRules();
  const [viewingRow, setViewingRow] = useState<DocumentReviewRow | null>(null);

  const app = useMemo(() => applications.find((item) => item.id === applicationId), [applications, applicationId]);

  useEffect(() => {
    if (applicationId) setCurrentId(applicationId);
  }, [applicationId, setCurrentId]);

  const requiredDocs = useMemo(() => (app ? getRequiredDocuments(app, rules) : []), [app, rules]);
  const activeRules = useMemo(
    () => (app ? rules.filter((rule) => rule.active !== false && matchesConditions(app.values, rule.conditions)) : []),
    [app, rules]
  );
  const matrixRows = useMemo(() => (app ? buildApplicationCheckMatrix(app, rules) : []), [app, rules]);
  const documentRows = useMemo(
    () => (app ? buildDocumentReviewRows(app, requiredDocs, activeRules) : []),
    [activeRules, app, requiredDocs]
  );
  const summary = useMemo(() => summarizeRows(documentRows, app?.findings || []), [app?.findings, documentRows]);
  const requestText = useMemo(() => buildApplicantRequest(app), [app]);

  const handleRunCheck = () => {
    if (!app) return;
    runCheck(app.id);
    toast.success('Предпроверка выполнена');
  };

  const handleStatusChange = (status: Application['status']) => {
    if (!app) return;
    updateStatus(app.id, status);
    toast.success(`Статус изменён на «${statusLabels[status]}»`);
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

  const handleFindingStatus = (finding: Finding, patch: Partial<Finding>) => {
    if (!app) return;
    updateFinding(app.id, finding.id, patch);
  };

  if (!app) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 bg-muted/20 py-6">
          <div className="container mx-auto max-w-5xl px-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <XCircle className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h1 className="text-xl font-semibold">Заявка не найдена</h1>
                  <p className="text-sm text-muted-foreground">Возможно, она была создана в другом браузере или очищено локальное хранилище.</p>
                </div>
                <Button asChild>
                  <Link href="/expert">Вернуться к списку</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="mx-auto w-full max-w-[1920px] px-2 sm:px-3 lg:px-4">
          <FadeIn>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
                  <Link href="/expert">
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    К списку заявок
                  </Link>
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">{app.values['param-trade-name'] || 'Заявка'}</h1>
                <p className="text-sm text-muted-foreground">
                  {app.values['param-object-type'] === 'MI' ? 'Медицинское изделие' : 'Лекарственное средство'} · {labelFor('param-procedure', app.values['param-procedure'])} · {new Date(app.createdAt).toLocaleString('ru-KZ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleRunCheck}>
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
                <Badge className="h-8 px-3" variant={app.status === 'submitted' || app.status === 'expert-review' ? 'default' : 'secondary'}>{statusLabels[app.status]}</Badge>
              </div>
            </div>
          </FadeIn>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Документы" value={`${summary.presentDocuments}/${summary.totalDocuments}`} tone="neutral" />
            <MetricCard label="Пройдено" value={summary.passedDocuments} tone="passed" />
            <MetricCard label="Ошибки" value={summary.failedDocuments} tone="failed" />
            <MetricCard label="Предупреждения" value={summary.warningDocuments} tone="warning" />
            <MetricCard label="Критично" value={summary.criticalFindings} tone="failed" />
            <MetricCard label="Серьёзно" value={summary.seriousFindings} tone="serious" />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Параметры заявки</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Field label="Тип препарата" value={productTypeLabels[app.values['param-product-type'] as keyof typeof productTypeLabels] || app.values['param-product-type']} />
                  <Field label="МНН" value={app.values['param-inn']} />
                  <Field label="Лекарственная форма" value={labelFor('param-dosage-form', app.values['param-dosage-form'])} />
                  <Field label="Дозировка" value={app.values['param-dosage']} />
                  <Field label="АТС" value={`${app.values['param-atc-code'] || '—'} ${app.values['param-atc-name'] || ''}`} />
                  <Field label="Производитель" value={app.values['param-manufacturer']} />
                  <Field label="Адрес площадки" value={app.values['param-manufacturer-address']} />
                  <Field label="Заявитель" value={app.values['param-applicant']} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Матрица проверки заявки</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border bg-muted/40 p-2">
                      <div className="text-lg font-semibold">{matrixRows.length}</div>
                      <div className="text-[11px] text-muted-foreground">документов</div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-2">
                      <div className="text-lg font-semibold">{new Set(matrixRows.flatMap((row) => row.checkIds)).size}</div>
                      <div className="text-[11px] text-muted-foreground">проверок</div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-2">
                      <div className="text-lg font-semibold">{new Set(matrixRows.flatMap((row) => row.runnerMethods)).size}</div>
                      <div className="text-[11px] text-muted-foreground">методов</div>
                    </div>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {matrixRows.slice(0, 12).map((row) => (
                      <div key={`${row.ruleId}-${row.documentTypeId}`} className="rounded-lg border p-2">
                        <div className="font-medium">{row.documentName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{row.ruleName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Методы: {row.runnerMethods.join(', ')} · проверки: {row.checkIds.length}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Активные правила</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeRules.map((rule) => (
                    <div key={rule.id} className="rounded-lg border p-3">
                      <div className="font-medium">{rule.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatConditions(rule.conditions, app.values)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-5">
              <Card className="min-w-0">
                <CardHeader className="space-y-2">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-base">Документы и проверки</CardTitle>
                      <p className="text-sm text-muted-foreground">Одна строка — один документ. Внутри строки видны все проверки, которые применяются к документу.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyRequest} disabled={!requestText}>Сформировать запрос</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="min-w-0 overflow-hidden px-1 pb-1">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                      <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <th className="w-[24%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Документ</th>
                          <th className="w-[17%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Файл</th>
                          <th className="w-[9%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Итог</th>
                          <th className="w-[32%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Проверки</th>
                          <th className="w-[12%] px-2 py-3 text-left align-middle font-medium whitespace-normal text-foreground">Источник</th>
                          <th className="w-[6%] px-2 py-3 text-right align-middle font-medium whitespace-normal text-foreground">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {documentRows.map((row) => (
                          <tr key={row.key} className="border-b transition-colors hover:bg-muted/50">
                            <td className="break-words px-2 py-3 align-top whitespace-normal">
                              <div className="font-medium">{row.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {row.required ? 'Обязательный' : 'Дополнительный'} · форматы: {row.formats.join(', ') || '—'}
                              </div>
                              {row.alternativeName && <div className="mt-1 text-xs text-muted-foreground">Альтернатива: {row.alternativeName}</div>}
                            </td>
                            <td className="break-words px-2 py-3 align-top whitespace-normal">
                              {row.file ? (
                                <>
                                  <div className="font-medium">{row.file.name}</div>
                                  <div className="text-xs text-muted-foreground">{(row.file.size / 1024).toFixed(1)} КБ · {row.file.processing?.extractionStatus || 'без OCR'}</div>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Файл не загружен</span>
                              )}
                            </td>
                            <td className="px-2 py-3 align-top">
                              <StatusBadge status={row.overall} />
                              {row.findings.length > 0 && <div className="mt-1 text-xs text-muted-foreground">Замечаний: {row.findings.length}</div>}
                            </td>
                            <td className="break-words px-2 py-3 align-top whitespace-normal">
                              <div className="flex min-w-0 flex-wrap gap-1.5">
                                {row.checks.map((check) => (
                                  <CheckChip key={check.id} check={check} />
                                ))}
                              </div>
                            </td>
                            <td className="break-words px-2 py-3 align-top whitespace-normal">
                              <div className="text-xs text-muted-foreground">{row.ruleName || 'По типу документа'}</div>
                              {row.conditionText && <div className="mt-1 text-xs text-muted-foreground">{row.conditionText}</div>}
                            </td>
                            <td className="px-2 py-3 text-right align-top">
                              <Button variant="outline" size="sm" className="px-2" onClick={() => setViewingRow(row)}>
                                <Eye className="h-3.5 w-3.5" />
                                <span className="sr-only">Открыть</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Замечания эксперту</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {app.findings.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/20 dark:text-green-100">
                      <CheckCircle2 className="h-5 w-5" />
                      Замечаний нет. Эталонная заявка проходит автоматические критерии.
                    </div>
                  ) : (
                    app.findings.map((finding) => (
                      <div key={finding.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <SeverityBadge severity={finding.severity} />
                              <span className="font-medium">{finding.title}</span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{finding.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{finding.npaReference || 'Источник не указан'}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex gap-2">
                              <Button size="sm" variant={finding.accepted === true ? 'default' : 'outline'} onClick={() => handleFindingStatus(finding, { accepted: true, status: 'accepted' })}>Принять</Button>
                              <Button size="sm" variant={finding.accepted === false ? 'default' : 'outline'} onClick={() => handleFindingStatus(finding, { accepted: false, status: 'rejected' })}>Отклонить</Button>
                            </div>
                            {finding.accepted === true && <span className="text-xs text-green-600">Принято</span>}
                            {finding.accepted === false && <span className="text-xs text-muted-foreground">Отклонено</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      {viewingRow && <DocumentReviewDialog row={viewingRow} onClose={() => setViewingRow(null)} />}
    </div>
  );
}

function buildDocumentReviewRows(app: Application, requiredDocs: RequiredDoc[], activeRules: typeof seedRules): DocumentReviewRow[] {
  const rows: DocumentReviewRow[] = requiredDocs.map((req) => {
    const docType = documentTypes.find((doc) => doc.id === req.documentTypeId);
    const alternativeDocType = req.alternativeDocumentTypeId ? documentTypes.find((doc) => doc.id === req.alternativeDocumentTypeId) : undefined;
    const file = app.files.find((item) => item.documentTypeId === req.documentTypeId || item.documentTypeId === req.alternativeDocumentTypeId);
    const matchedDocType = file ? documentTypes.find((doc) => doc.id === file.documentTypeId) || docType : docType;
    const docName = matchedDocType?.name || docType?.name || req.documentTypeId;
    const rowFindings = app.findings.filter((finding) => findingMatchesDocument(finding, docName, file, req.documentTypeId));
    const activatingRule = activeRules.find((rule) => rule.requiredDocuments.some((doc) => doc.documentTypeId === req.documentTypeId));
    const checks = buildCheckCells(app, req, matchedDocType?.id || req.documentTypeId, docName, file, rowFindings);

    return {
      key: req.documentTypeId,
      documentTypeId: matchedDocType?.id || req.documentTypeId,
      name: docName,
      required: true,
      severity: req.severityIfMissing,
      formats: matchedDocType?.acceptedFormats || docType?.acceptedFormats || [],
      file,
      checks,
      findings: rowFindings,
      overall: getOverallStatus(checks),
      ruleName: activatingRule?.name,
      conditionText: activatingRule ? formatConditions(activatingRule.conditions, app.values) : undefined,
      alternativeName: alternativeDocType?.name,
    };
  });

  const coveredDocTypeIds = new Set(requiredDocs.flatMap((req) => [req.documentTypeId, req.alternativeDocumentTypeId].filter(Boolean) as string[]));
  for (const file of app.files) {
    if (coveredDocTypeIds.has(file.documentTypeId)) continue;
    const docType = documentTypes.find((doc) => doc.id === file.documentTypeId);
    const docName = docType?.name || file.documentTypeId;
    const rowFindings = app.findings.filter((finding) => findingMatchesDocument(finding, docName, file, file.documentTypeId));
    const checks = buildCheckCells(app, undefined, file.documentTypeId, docName, file, rowFindings);
    rows.push({
      key: file.id,
      documentTypeId: file.documentTypeId,
      name: docName,
      required: false,
      formats: docType?.acceptedFormats || [],
      file,
      checks,
      findings: rowFindings,
      overall: getOverallStatus(checks),
      ruleName: 'Дополнительный документ',
    });
  }

  return rows;
}

function buildCheckCells(
  app: Application,
  req: RequiredDoc | undefined,
  documentTypeId: string,
  docName: string,
  file: UploadedFile | undefined,
  rowFindings: Finding[],
): ReviewCheckCell[] {
  const docType = documentTypes.find((doc) => doc.id === documentTypeId);
  const checkIds = unique([
    'required_document_presence_check',
    'file_format_check',
    'ocr_quality_check',
    ...(req?.checks || []),
    ...(docType?.checkIds || []),
  ]);

  return checkIds.map((checkId) => {
    const definition = getCheckDefinition(checkId) || checkDefinitions.find((check) => check.id === checkId);
    if (checkId === 'required_document_presence_check') {
      return {
        id: checkId,
        name: definition?.name || 'Наличие документа',
        status: file ? 'passed' : 'failed',
        severity: file ? undefined : req?.severityIfMissing || 'critical',
        findings: file ? [] : rowFindings,
        description: definition?.description,
        npaReferences: definition?.npaReferences,
      };
    }

    if (!file) {
      return {
        id: checkId,
        name: definition?.name || shortCheckName(checkId),
        status: 'skipped',
        findings: [],
        description: 'Проверка будет выполнена после загрузки документа.',
        npaReferences: definition?.npaReferences,
      };
    }

    const relatedFindings = rowFindings.filter((finding) => finding.checkerId === checkId);
    return {
      id: checkId,
      name: definition?.name || shortCheckName(checkId),
      status: relatedFindings.length ? statusFromFindings(relatedFindings) : 'passed',
      severity: maxSeverity(relatedFindings),
      findings: relatedFindings,
      description: definition?.description,
      npaReferences: definition?.npaReferences,
    };
  });
}

function DocumentReviewDialog({ row, onClose }: { row: DocumentReviewRow; onClose: () => void }) {
  const file = row.file;
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file?.url) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext || '')) return;
    setLoading(true);
    fetch(`${file.url}.txt`)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then(setText)
      .catch(() => setText(null))
      .finally(() => setLoading(false));
  }, [file]);

  const ext = file?.name.split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[88vh] w-full max-w-6xl flex-col p-0">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {row.name}
          </DialogTitle>
          <DialogDescription>{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} КБ` : 'Файл не загружен'}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 border-t">
          <Tabs defaultValue="checks" className="flex h-full flex-col">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="checks">Проверки</TabsTrigger>
              {file && (isPdf || isImage) && <TabsTrigger value="preview">Просмотр</TabsTrigger>}
              {(text || loading) && <TabsTrigger value="text">Текст</TabsTrigger>}
              {file && <TabsTrigger value="data">Данные</TabsTrigger>}
            </TabsList>
            <TabsContent value="checks" className="min-h-0 flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {row.checks.map((check) => (
                  <div key={check.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={check.status} />
                        <span className="font-medium">{check.name}</span>
                      </div>
                      <StatusBadge status={check.status} />
                    </div>
                    {check.description && <p className="mt-2 text-sm text-muted-foreground">{check.description}</p>}
                    {check.npaReferences?.length ? <p className="mt-1 text-xs text-muted-foreground">НПА: {check.npaReferences.join('; ')}</p> : null}
                    {check.findings.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {check.findings.map((finding) => (
                          <div key={finding.id} className="rounded-md bg-muted/60 p-2 text-sm">
                            <div className="font-medium">{finding.title}</div>
                            <div className="text-muted-foreground">{finding.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
            {file && isPdf && (
              <TabsContent value="preview" className="min-h-0 flex-1 p-0">
                <iframe src={file.url} className="h-full w-full border-0" title={file.name} />
              </TabsContent>
            )}
            {file && isImage && (
              <TabsContent value="preview" className="min-h-0 flex-1 overflow-auto p-4">
                <img src={file.url} alt={file.name} className="max-w-full rounded-md border" />
              </TabsContent>
            )}
            {(text || loading) && (
              <TabsContent value="text" className="min-h-0 flex-1 overflow-auto p-4">
                {loading ? <p className="text-sm text-muted-foreground">Загрузка текста…</p> : <pre className="whitespace-pre-wrap text-sm">{text}</pre>}
              </TabsContent>
            )}
            {file && (
              <TabsContent value="data" className="min-h-0 flex-1 overflow-auto p-4">
                <ExtractedData file={file} />
              </TabsContent>
            )}
          </Tabs>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/50 p-3">
          {file?.url && (
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

function ExtractedData({ file }: { file: UploadedFile }) {
  const entries = Object.entries(file.extracted || {});
  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3">
        <Meta label="Hash" value={file.hash} />
        <Meta label="Статус извлечения" value={file.processing?.extractionStatus} />
        <Meta label="OCR качество" value={file.ocrQuality ? `${Math.round(file.ocrQuality * 100)}%` : undefined} />
      </div>
      <Separator />
      {entries.length === 0 ? (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Извлечённые поля отсутствуют.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-md border p-2">
              <p className="text-xs uppercase text-muted-foreground">{key}</p>
              <p className="break-words text-sm">{value}</p>
            </div>
          ))}
        </div>
      )}
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

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone: 'neutral' | 'passed' | 'failed' | 'warning' | 'serious' }) {
  const styles = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-100',
    passed: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-100',
    failed: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-950/20 dark:text-yellow-100',
    serious: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
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

function CheckChip({ check }: { check: ReviewCheckCell }) {
  const styles = {
    passed: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-100',
    failed: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/20 dark:text-yellow-100',
    skipped: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100',
  };
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${styles[check.status]}`} title={check.description || check.name}>
      <StatusIcon status={check.status} />
      <span className="truncate">{shortCheckName(check.id)}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const labels = {
    passed: 'Прошёл',
    failed: 'Не прошёл',
    warning: 'Предупреждение',
    skipped: 'Не применимо',
  };
  const styles = {
    passed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100',
    skipped: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-100',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}><StatusIcon status={status} />{labels[status]}</span>;
}

function StatusIcon({ status }: { status: ReviewStatus }) {
  if (status === 'passed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'warning') return <AlertTriangle className="h-3.5 w-3.5" />;
  return <CircleDashed className="h-3.5 w-3.5" />;
}

function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const labels: Record<Finding['severity'], string> = {
    critical: 'Критично',
    serious: 'Серьёзно',
    warning: 'Предупреждение',
    unknown: 'Неизвестно',
  };
  const styles: Record<Finding['severity'], string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100',
    serious: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100',
    unknown: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-100',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}>{labels[severity]}</span>;
}

function summarizeRows(rows: DocumentReviewRow[], findings: Finding[]) {
  return {
    totalDocuments: rows.length,
    presentDocuments: rows.filter((row) => !!row.file).length,
    passedDocuments: rows.filter((row) => row.overall === 'passed').length,
    failedDocuments: rows.filter((row) => row.overall === 'failed').length,
    warningDocuments: rows.filter((row) => row.overall === 'warning').length,
    criticalFindings: findings.filter((finding) => finding.severity === 'critical').length,
    seriousFindings: findings.filter((finding) => finding.severity === 'serious').length,
  };
}

function getOverallStatus(checks: ReviewCheckCell[]): ReviewStatus {
  if (checks.some((check) => check.status === 'failed')) return 'failed';
  if (checks.some((check) => check.status === 'warning')) return 'warning';
  if (checks.every((check) => check.status === 'skipped')) return 'skipped';
  return 'passed';
}

function statusFromFindings(findings: Finding[]): ReviewStatus {
  if (findings.some((finding) => finding.severity === 'critical' || finding.severity === 'serious')) return 'failed';
  if (findings.length > 0) return 'warning';
  return 'passed';
}

function maxSeverity(findings: Finding[]): Finding['severity'] | undefined {
  const order: Record<Finding['severity'], number> = { critical: 4, serious: 3, warning: 2, unknown: 1 };
  return findings.sort((a, b) => order[b.severity] - order[a.severity])[0]?.severity;
}

function findingMatchesDocument(finding: Finding, docName: string, file: UploadedFile | undefined, documentTypeId: string): boolean {
  const targets = [docName, file?.name, documentTypeId].filter(Boolean).map((item) => normalize(String(item)));
  if (finding.evidence?.some((evidence) => evidence.documentTypeId === documentTypeId)) return true;
  return finding.documents.some((document) => {
    const normalizedDocument = normalize(document);
    return targets.some((target) => normalizedDocument.includes(target) || target.includes(normalizedDocument));
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '');
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchesConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((condition) => {
    const value = values[condition.parameterId];
    const target = condition.value;
    switch (condition.operator) {
      case 'equals':
        return value === target;
      case 'notEquals':
        return value !== target;
      case 'notEmpty':
        return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : false;
      case 'includes':
        if (typeof value === 'string') return value.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(value)) return value.some((item) => item.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

function formatConditions(conditions: RuleCondition[], values: Application['values']): string {
  if (conditions.length === 0) return 'Всегда';
  return conditions
    .map((condition) => {
      const parameter = parameters.find((param) => param.id === condition.parameterId);
      const currentValue = values[condition.parameterId];
      return `${parameter?.label || condition.parameterId}: ${operatorLabel(condition.operator)} ${formatParameterValue(condition.parameterId, condition.value)}; сейчас ${formatCurrentValue(condition.parameterId, currentValue)}`;
    })
    .join(' · ');
}

function operatorLabel(operator: RuleCondition['operator']) {
  const labels: Record<RuleCondition['operator'], string> = {
    equals: '=',
    notEquals: '≠',
    includes: 'содержит',
    notEmpty: 'заполнено',
  };
  return labels[operator];
}

function formatCurrentValue(parameterId: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map((item) => formatParameterValue(parameterId, item)).join(', ') || '—';
  return formatParameterValue(parameterId, value);
}

function labelFor(parameterId: string, value?: string | string[]) {
  return formatCurrentValue(parameterId, value);
}

function formatParameterValue(parameterId: string, value?: string) {
  if (!value) return '—';
  const parameter = parameters.find((param) => param.id === parameterId);
  return parameter?.options?.find((option) => option.value === value)?.label || value;
}

function shortCheckName(checkId: string) {
  const names: Record<string, string> = {
    required_document_presence_check: 'наличие',
    file_format_check: 'формат',
    ocr_quality_check: 'OCR',
    core_field_consistency_check: 'сверка полей',
    gmp_certificate_check: 'GMP',
    cpp_certificate_check: 'CPP',
    shelf_life_consistency_check: 'срок годности',
    storage_consistency_check: 'хранение',
    translation_length_check: 'перевод',
    docx_format_check: 'DOCX',
    required_sections_check: 'разделы',
    bioequivalence_report_check: 'БЭ',
    bioequivalence_waiver_check: 'биовейвер',
    module3_content_check: 'модуль 3',
    pharmacovigilance_contact_check: 'фармаконадзор',
    black_triangle_check: 'мониторинг',
    sterility_validation_check: 'стерильность',
    ls_variation_consistency_check: 'изменения',
    mi_variation_consistency_check: 'изменения МИ',
  };
  return names[checkId] || checkId.replace(/_check$/, '').replace(/_/g, ' ');
}

function buildApplicantRequest(app: Application | undefined): string {
  if (!app || app.findings.length === 0) return '';
  const actionable = app.findings.filter((finding) => finding.status !== 'not-applicable' && finding.accepted !== false);
  if (actionable.length === 0) return '';
  const title = app.values['param-trade-name'] || app.id;
  const lines = actionable.map((finding, index) => {
    const docs = finding.documents.length ? ` Документы: ${finding.documents.join(', ')}.` : '';
    const npa = finding.npaReference ? ` НПА: ${finding.npaReference}.` : '';
    return `${index + 1}. ${finding.title}\n${finding.description}${docs}${npa}\nРекомендация: ${finding.recommendation}`;
  });
  return [`Запрос по заявке: ${title}`, '', ...lines].join('\n');
}
