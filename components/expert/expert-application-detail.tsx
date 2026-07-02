'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { useResolvedRequiredDocuments } from '@/lib/hooks/useResolvedRequiredDocuments';
import { useRules } from '@/lib/hooks/useRules';
import { findUploadedRequiredFile, getRequiredDocuments } from '@/lib/rules/engine';
import { checkDefinitions, getCheckDefinition } from '@/lib/checks/registry';
import { buildApplicationCheckMatrix } from '@/lib/checks/matrix';
import { documentTypes, parameters, productTypeLabels, rules as seedRules } from '@/lib/data/seed';
import { useStore } from '@/lib/store';
import { getLsDocumentRequirementByDocumentTypeId } from '@/lib/data/ls-document-checks-mapping';
import { getDossierSectionById } from '@/lib/dossier/sections';
import { Application, CheckMethod, DocumentRequirementCheckResult, DocumentType, Finding, RequiredDoc, RuleCondition, UploadedFile } from '@/lib/types';
import { DossierExpertPanel } from '@/components/expert/detail/dossier-panel';
import { ApplicationSidePanel } from '@/components/expert/detail/application-side-panel';
import { DocumentsReviewCard } from '@/components/expert/detail/documents-review-card';
import { ExpertHeader } from '@/components/expert/detail/expert-header';
import { ExpertMetricsGrid } from '@/components/expert/detail/expert-metrics-grid';
import { ExpertConclusionPanel } from '@/components/expert/detail/expert-conclusion-panel';
import { FileProcessingProgressCard } from '@/components/expert/detail/file-processing-progress-card';
import { FindingsPanel } from '@/components/expert/detail/findings-panel';
import { NpaGemmaSummaryCard } from '@/components/expert/detail/npa-gemma-summary-card';
import { ServerTaskCard } from '@/components/expert/detail/server-task-card';
import { DocumentReviewDialog } from '@/components/expert/detail/document-review-dialog';
import { ExpertiseStage, STAGE_LABELS, STAGE_HINTS, checksForStage, overallForChecks } from '@/components/expert/detail/review-stages';
import { FindingCard } from '@/components/expert/detail/finding-card';
import { Field, LsApplicationSummary, MetricCard, MiniMetric } from '@/components/expert/detail/application-summary';
import { displayApplicationTitle } from '@/components/expert/detail/application-formatters';
import { CheckChip, StatusBadge } from '@/components/expert/detail/review-badges';
import { buildDocumentReviewRows, buildNpaGemmaReviewSummary, labelFor, matchesConditions, npaFilterLabel, summarizeNpaGemmaResults } from '@/components/expert/detail/review-logic';
import { computeReviewSummary } from '@/components/expert/detail/review-summary';
import { buildApplicantRequest, formatElapsed } from '@/components/expert/detail/request-formatters';
import { DocumentReviewRow, NpaFindingFilter } from '@/components/expert/detail/review-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
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
  Loader2,
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

export function ExpertApplicationDetail() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const { applications, importApplication, updateFinding, updateStatus, setCurrentId, setCheckDecision, setExpertConclusion } = useApplications();
  const { rules, importRules } = useRules();
  const { store, setDocumentTypes } = useStore();
  const [viewingRow, setViewingRow] = useState<DocumentReviewRow | null>(null);
  const [stage, setStage] = useState<ExpertiseStage>('primary');
  const [detailLoading, setDetailLoading] = useState(true);
  const [serverTask, setServerTask] = useState<'extract' | 'check' | 'npa-gemma' | null>(null);
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const [npaFindingFilter, setNpaFindingFilter] = useState<NpaFindingFilter>('all');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/config?lite=1')
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (cancelled || !config) return;
        if (Array.isArray(config.documentTypes) && config.documentTypes.length > 0) {
          setDocumentTypes(config.documentTypes);
        }
        if (Array.isArray(config.rules) && config.rules.length > 0) {
          importRules(config.rules);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // hydrate runtime admin config once on page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const app = useMemo(() => applications.find((item) => item.id === applicationId), [applications, applicationId]);

  useEffect(() => {
    if (applicationId) setCurrentId(applicationId);
  }, [applicationId, setCurrentId]);

  // The global list provider only holds lightweight summaries (no per-file
  // extracted text). Fetch the full application once on open so the detail
  // view has the complete data.
  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    setDetailLoading(true);
    void fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.application) importApplication(data.application);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // importApplication identity changes on every applications update; depend on applicationId only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    const shouldPoll = Boolean(serverTask) || app?.status === 'checking';
    if (!shouldPoll) return;

    let cancelled = false;
    const refreshApplication = async () => {
      try {
        const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.application) {
          importApplication(data.application);
        }
      } catch {
        // keep the current screen state; the next tick may succeed
      }
    };

    void refreshApplication();
    const interval = window.setInterval(refreshApplication, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applicationId, app?.status, importApplication, serverTask]);

  useEffect(() => {
    if (!serverTask || !taskStartedAt) return;
    const interval = window.setInterval(() => {
      setTaskElapsed(Math.max(0, Math.floor((Date.now() - taskStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [serverTask, taskStartedAt]);

  const isLsRegistration = app?.values['param-object-type'] === 'LS' && app.values['param-procedure'] === 'registration';
  const runtimeLsDocumentTypes = store.documentTypes.filter((docType) =>
    docType.id.startsWith('memo-ls-') ||
    docType.direction === 'LS' && Boolean(docType.docCode && docType.sourceStructure)
  );
  const baseDocumentTypesCatalog = isLsRegistration
    ? runtimeLsDocumentTypes
    : store.documentTypes.length ? store.documentTypes : documentTypes;
  const legacyRequiredDocs = useMemo(
    () => (app ? getRequiredDocuments(app, rules, baseDocumentTypesCatalog) : []),
    [app, rules, baseDocumentTypesCatalog],
  );
  const resolvedRequirements = useResolvedRequiredDocuments(app, legacyRequiredDocs, baseDocumentTypesCatalog);
  const documentTypesCatalog = resolvedRequirements.documentTypesCatalog;
  const requiredDocs = resolvedRequirements.requiredDocs;
  const activeRules = useMemo(
    () => (app ? rules.filter((rule) => rule.active !== false && matchesConditions(app.values, rule.conditions)) : []),
    [app, rules]
  );
  const matrixRows = useMemo(
    () => (app ? buildApplicationCheckMatrix(app, rules, documentTypesCatalog) : []),
    [app, rules, documentTypesCatalog]
  );
  const documentRows = useMemo(
    () => (app ? buildDocumentReviewRows(app, requiredDocs, activeRules, documentTypesCatalog) : []),
    [activeRules, app, documentTypesCatalog, requiredDocs]
  );
  const dossierFiles = useMemo(
    () => (app ? app.files.filter((file) => file.source === 'dossier-folder' || file.dossierSectionId) : []),
    [app]
  );
  const summary = useMemo(
    () => (app ? computeReviewSummary(app, requiredDocs, documentTypesCatalog) : null),
    [app, requiredDocs, documentTypesCatalog],
  );
  const npaGemmaSummary = useMemo(() => summarizeNpaGemmaResults(app?.files || []), [app?.files]);
  const npaGemmaReviewSummary = useMemo(
    () => (app ? buildNpaGemmaReviewSummary(app, documentTypesCatalog) : null),
    [app, documentTypesCatalog]
  );
  const npaGemmaFindings = useMemo(
    () => (app?.findings || []).filter((finding) => finding.checkerId === 'npa_imported_requirement_check'),
    [app?.findings]
  );
  const filteredNpaGemmaFindings = useMemo(
    () => npaFindingFilter === 'all' ? npaGemmaFindings : npaGemmaFindings.filter((finding) => finding.severity === npaFindingFilter),
    [npaFindingFilter, npaGemmaFindings]
  );
  const requestText = useMemo(() => buildApplicantRequest(app), [app]);

  const handleExtractFiles = async () => {
    if (!app) return;
    setServerTask('extract');
    setTaskStartedAt(Date.now());
    setTaskElapsed(0);
    setTaskResult(null);
    setTaskMessage(`Извлекаю текст и OCR по ${app.files.length} файлам. Для больших досье это может занять несколько минут.`);
    try {
      const response = await fetch(`/api/applications/${app.id}/extract`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Не удалось извлечь файлы');
      if (data.application) importApplication(data.application);
      const stats = data.stats ? Object.entries(data.stats).map(([key, value]) => `${key}: ${value}`).join(', ') : '';
      setTaskResult(`Извлечение завершено${stats ? `: ${stats}` : ''}.`);
      toast.success(`Извлечение файлов завершено${stats ? ` (${stats})` : ''}`);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось извлечь файлы');
    } finally {
      setServerTask(null);
      setTaskStartedAt(null);
    }
  };

  const handleRunCheck = async () => {
    if (!app) return;
    setServerTask('check');
    setTaskStartedAt(Date.now());
    setTaskElapsed(0);
    setTaskResult(null);
    setTaskMessage('Пересчитываю комплектность, форматы, OCR-статусы и содержательные проверки по документам.');
    try {
      const response = await fetch(`/api/applications/${app.id}/check`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Не удалось выполнить проверку');
      if (data.application) importApplication(data.application);
      setTaskResult(`Проверка завершена: ${data.findings?.length || 0} замечаний.`);
      toast.success(`Серверная проверка выполнена: ${data.findings?.length || 0} замечаний`);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось выполнить проверку');
    } finally {
      setServerTask(null);
      setTaskStartedAt(null);
    }
  };

  const handleRunNpaGemmaCheck = async () => {
    if (!app) return;
    setServerTask('npa-gemma');
    setTaskStartedAt(Date.now());
    setTaskElapsed(0);
    setTaskResult(null);
    setTaskMessage('Считаю оставшиеся требования для автоматической проверки.');
    try {
      const dryRunResponse = await fetch(`/api/applications/${app.id}/npa-gemma-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: true,
          skipCompleted: true,
          maxFiles: 200,
          maxTotalRequirements: 500,
        }),
      });
      const dryRunData = await dryRunResponse.json();
      if (!dryRunResponse.ok) throw new Error(dryRunData?.error || 'Не удалось подготовить автоматическую проверку НПА');

      const totalRequirements = dryRunData.totalRequirements || 0;
      if (totalRequirements === 0) {
        setTaskResult('Автоматическая проверка НПА не запускалась: непроверенных требований не осталось.');
        toast.success('Непроверенных требований НПА не осталось');
        return;
      }

      let processed = 0;
      let passed = 0;
      let failed = 0;
      let uncertain = 0;
      let skipped = 0;

      for (let iteration = 0; iteration < 100 && processed < totalRequirements; iteration += 1) {
        setTaskMessage(`Автоматическая проверка анализирует требования чанками: ${processed}/${totalRequirements} обработано.`);
        const response = await fetch(`/api/applications/${app.id}/npa-gemma-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skipCompleted: true,
            maxFiles: 6,
            maxRequirementsPerFile: 4,
            maxTotalRequirements: 12,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Не удалось выполнить автоматическую проверку НПА');
        if (data.application) importApplication(data.application);

        const stats = data.stats || {};
        const chunkRequirements = stats.requirements || 0;
        if (chunkRequirements === 0) break;
        processed += chunkRequirements;
        passed += stats.passed || 0;
        failed += stats.failed || 0;
        uncertain += stats.uncertain || 0;
        skipped += stats.skipped || 0;
      }

      const result = `обработано: ${processed}/${totalRequirements}, пройдено: ${passed}, не подтверждено: ${failed}, неясно: ${uncertain}, пропущено: ${skipped}`;
      setTaskResult(`Автоматическая проверка НПА завершена: ${result}.`);
      toast.success(`Автоматическая проверка НПА завершена: ${result}`);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось выполнить автоматическую проверку НПА');
    } finally {
      setServerTask(null);
      setTaskStartedAt(null);
    }
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
      <div className="flex min-h-screen">
        <SiteHeader />
        <main className="flex-1 bg-muted/20 py-6">
          <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                {detailLoading ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Загрузка заявки…</p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <h1 className="text-xl font-semibold">Заявка не найдена</h1>
                      <p className="text-sm text-muted-foreground">Возможно, она была создана в другом браузере или очищено локальное хранилище.</p>
                    </div>
                    <Button asChild>
                      <Link href="/expert">Вернуться к списку</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="mx-auto w-full max-w-[1920px] px-2 sm:px-3 lg:px-4">
          <ExpertHeader
            app={app}
            serverTask={serverTask}
            onExtractFiles={handleExtractFiles}
            onRunCheck={handleRunCheck}
            onRunNpaGemmaCheck={handleRunNpaGemmaCheck}
            onStatusChange={handleStatusChange}
          />
          <ServerTaskCard serverTask={serverTask} taskResult={taskResult} taskMessage={taskMessage} taskElapsed={taskElapsed} />
          <FileProcessingProgressCard app={app} />
          {summary && <ExpertMetricsGrid summary={summary} dossierFilesCount={dossierFiles.length} npaGemmaSummary={npaGemmaSummary} />}

          <ExpertConclusionPanel app={app} onSave={(c) => setExpertConclusion(app.id, c)} />

          <Tabs defaultValue="documents" className="mt-4 min-w-0">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-none bg-transparent p-0">
              <TabsTrigger
                value="documents"
                className="rounded-none border border-r-0 px-3 py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Документы и проверки
              </TabsTrigger>
              <TabsTrigger
                value="parameters"
                className="rounded-none border border-r-0 px-3 py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Параметры заявки
              </TabsTrigger>
              <TabsTrigger
                value="dossier"
                className="rounded-none border px-3 py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Регистрационное досье
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-4 min-w-0 space-y-4">
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-md border p-0.5">
                  {(['primary', 'specialized'] as ExpertiseStage[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStage(s)}
                      className={[
                        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                        stage === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      {STAGE_LABELS[s]}
                    </button>
                  ))}
                </div>
                {(() => {
                  const failed = documentRows.filter(
                    (r) => (r.file || r.files?.length) && overallForChecks(checksForStage(r, 'primary')) === 'failed',
                  ).length;
                  const missing = documentRows.filter((r) => r.required && !(r.file || r.files?.length)).length;
                  const ok = failed === 0 && missing === 0;
                  return (
                    <div className={`text-sm font-medium ${ok ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      Первичная экспертиза: {ok ? 'замечаний нет' : `${missing ? `не хватает ${missing} разд.` : ''}${missing && failed ? ', ' : ''}${failed ? `${failed} с замечаниями` : ''}`}
                    </div>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">{STAGE_HINTS[stage]}</p>
              {stage === 'specialized' && <NpaGemmaSummaryCard summary={npaGemmaReviewSummary} />}
              <DocumentsReviewCard rows={documentRows} requestText={requestText} stage={stage} onCopyRequest={handleCopyRequest} onOpenRow={setViewingRow} />
            </TabsContent>

            <TabsContent value="parameters" className="mt-4 min-w-0">
              <ApplicationSidePanel app={app} matrixRows={matrixRows} activeRules={activeRules} />
            </TabsContent>

            <TabsContent value="dossier" className="mt-4 min-w-0">
              <DossierExpertPanel
                files={dossierFiles}
                objectType={app.values['param-object-type'] === 'MI' ? 'MI' : 'LS'}
              />
            </TabsContent>

          </Tabs>
        </div>
      </main>
      {viewingRow && (
        <DocumentReviewDialog
          row={viewingRow}
          decisions={app.expertCheckDecisions || {}}
          onDecision={(checkKey, decision) => setCheckDecision(app.id, checkKey, decision)}
          stage={stage}
          onClose={() => setViewingRow(null)}
        />
      )}
    </div>
  );
}
