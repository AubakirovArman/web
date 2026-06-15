'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { useRules } from '@/lib/hooks/useRules';
import { documentTypes, getVisibleParameterIds, parameters, productTypeLabels } from '@/lib/data/seed';
import { getRequiredDocuments } from '@/lib/rules/engine';
import { getBlockingFindings, runSectionValidation } from '@/lib/checks';
import { DocumentUploader } from '@/components/applicant/document-uploader';
import { SeverityBadge } from '@/components/shared/severity-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, FileStack, Settings2, Sparkles, ArrowLeft, ArrowRight, Send, Save, Loader2, XCircle } from 'lucide-react';
import { Application, Finding, Rule, RuleCondition, UploadedFile } from '@/lib/types';

const steps = [
  { id: 'params', title: 'Параметры', icon: Settings2 },
  { id: 'docs', title: 'Документы', icon: FileStack },
  { id: 'check', title: 'Проверка', icon: Sparkles },
];

export default function WizardPage() {
  const router = useRouter();
  const {
    applications,
    currentId,
    setCurrentId,
    addApplication,
    updateValues,
    addFile,
    removeFile,
    runCheck,
    submitApplication,
    updateStatus,
  } = useApplications();
  const { rules } = useRules();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!currentId && applications.length > 0) {
      setCurrentId(applications[0].id);
    }
  }, [currentId, applications, setCurrentId]);

  const app = useMemo(() => applications.find((a) => a.id === currentId), [applications, currentId]);
  const requiredDocs = useMemo(() => (app ? getRequiredDocuments(app, rules) : []), [app, rules]);
  const uploadedCount = useMemo(
    () =>
      app
        ? requiredDocs.filter((req) =>
            app.files.some(
              (f) => f.documentTypeId === req.documentTypeId || f.documentTypeId === req.alternativeDocumentTypeId
            )
          ).length
        : 0,
    [app, requiredDocs]
  );
  const progress = useMemo(
    () => (requiredDocs.length ? Math.round((uploadedCount / requiredDocs.length) * 100) : 0),
    [requiredDocs.length, uploadedCount]
  );
  const blockingFindings = useMemo(() => (app ? getBlockingFindings(app.findings) : []), [app]);

  const handleParamChange = (id: string, value: string) => {
    if (!app) return;
    updateValues(app.id, { [id]: value });
  };

  const handleRunCheck = () => {
    if (!app) return;
    runCheck(app.id);
    setStep(2);
    toast.success('Предэкспертиза завершена');
  };

  const handleSubmit = () => {
    if (!app) return;
    const result = submitApplication(app.id);
    if (!result.success) {
      toast.error(
        `Нельзя отправить заявку: ${result.blockingFindings.length} обязательных замечаний.
Загрузка в экспертизу доступна после их устранения.`
      );
      setStep(2);
      return;
    }
    toast.success('Заявка отправлена в экспертизу');
    router.push('/expert');
  };

  const handleSaveDraft = () => {
    if (!app) return;
    updateStatus(app.id, 'draft');
    toast.success('Черновик сохранен');
  };

  const sectionValidationForNavigation = (fromStep: number, targetStep: number) => {
    if (!app || targetStep <= fromStep) return null;

    const scopes: Array<'params' | 'documents'> = [];
    if (fromStep === 0 && targetStep >= 1) {
      scopes.push('params');
    }
    if (fromStep <= 1 && targetStep === 2) {
      scopes.push('documents');
    }

    if (scopes.length === 0) return null;

    let findings: Finding[] = [];
    for (const scope of scopes) {
      const result = runSectionValidation(app, rules, scope === 'params' ? 'params' : 'documents');
      findings = findings.concat(result.findings);
    }

    return { findings };
  };

  const handleNextStep = () => {
    if (!app) return;
    const validation = sectionValidationForNavigation(step, step + 1);
    if (validation) {
      const validationBlocking = getBlockingFindings(validation.findings);
      if (validationBlocking.length > 0) {
        toast.warning(
          `Есть обязательные замечания (${validationBlocking.length}). Можно перейти дальше, но отправка будет заблокирована до устранения.`
        );
      } else if (validation.findings.length > 0) {
        toast.warning(`Есть предупреждения (${validation.findings.length}). Можно перейти дальше и доработать позже.`);
      }
    }
    setStep(Math.min(2, step + 1));
  };

  const handleStepChange = (target: number) => {
    if (!app || target <= step) {
      setStep(target);
      return;
    }
    const validation = sectionValidationForNavigation(step, target);
    if (validation) {
      const validationBlocking = getBlockingFindings(validation.findings);
      if (validationBlocking.length > 0) {
        toast.warning(
          `Есть обязательные замечания (${validationBlocking.length}). Можно перейти дальше, но отправка будет заблокирована до устранения.`
        );
      } else if (validation.findings.length > 0) {
        toast.warning(`Есть предупреждения (${validation.findings.length}). Можно перейти дальше и доработать позже.`);
      }
    }
    setStep(target);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-8">
        <div className="container mx-auto max-w-5xl px-4">
          {!app ? (
            <FadeIn>
              <div className="flex min-h-[60vh] items-center justify-center">
                <Card className="max-w-md">
                  <CardHeader>
                    <CardTitle>Нет активной заявки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => addApplication()}>Создать новую заявку</Button>
                  </CardContent>
                </Card>
              </div>
            </FadeIn>
          ) : (
            <>
              <FadeIn>
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Создание заявки</h1>
                    <p className="text-sm text-muted-foreground">
                      {app.values['param-object-type'] === 'MI'
                        ? 'Медицинское изделие'
                        : productTypeLabels[app.values['param-product-type'] as keyof typeof productTypeLabels] || 'Заявка'}{' '}
                      · {app.values['param-trade-name'] || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Шаг {step + 1} из {steps.length}
                    </span>
                    <Progress value={((step + 1) / steps.length) * 100} className="w-32" />
                  </div>
                </div>
              </FadeIn>

              <div className="mb-8 grid grid-cols-3 gap-2">
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  const active = i === step;
                  const done = i < step;
                  return (
                    <button
                      key={s.id}
                      data-testid={`wizard-step-${s.id}`}
                      aria-label={`Перейти к разделу ${s.title}`}
                      onClick={() => handleStepChange(i)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : done
                          ? 'border-primary/30 bg-primary/5 text-primary'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      <span className="hidden sm:inline">{s.title}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  {step === 0 && <ParamsStep values={app.values} onChange={handleParamChange} />}
                  {step === 1 && (
                    <DocsStep
                      app={app}
                      requiredDocs={requiredDocs}
                      progress={progress}
                      uploadedCount={uploadedCount}
                      onUpload={(file) => addFile(app.id, file)}
                      onRemove={(fileId) => removeFile(app.id, fileId)}
                    />
                  )}
                  {step === 2 && (
                    <CheckStep
                      app={app}
                      requiredDocs={requiredDocs}
                      rules={rules}
                      onRun={handleRunCheck}
                      onSubmit={handleSubmit}
                      onSaveDraft={handleSaveDraft}
                      mandatoryCount={blockingFindings.length}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleSaveDraft}>
                    Сохранить черновик
                  </Button>
                  {step < 2 && (
                    <Button onClick={handleNextStep}>
                      Далее
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ParamsStep({ values, onChange }: { values: Application['values']; onChange: (id: string, value: string) => void }) {
  const procedure = values['param-procedure'] as string;
  const objectType = values['param-object-type'] as string;
  const visibleParamIds = getVisibleParameterIds(
    objectType === 'MI' ? 'MI' : 'LS',
    procedure === 're-registration' || procedure === 'variation' ? procedure : 'registration',
    values as Record<string, string>
  );
  const visibleParams = parameters.filter((p) => visibleParamIds.includes(p.id));
  const groupedParams = visibleParams.reduce<Record<string, typeof visibleParams>>((acc, param) => {
    const section = param.section || 'Основные параметры';
    acc[section] = acc[section] || [];
    acc[section].push(param);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="wizard-params-step">
      {Object.entries(groupedParams).map(([section, sectionParams]) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle>{section}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {sectionParams.map((param) => (
              <div key={param.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={param.id}>{param.label}</Label>
                  {param.sourceFieldRef && (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] text-muted-foreground"
                      title={`${param.sourceNpa || 'Источник'}: ${param.sourceFieldRef}`}
                    >
                      ?
                    </span>
                  )}
                </div>
                {param.type === 'select' ? (
                  <Select value={(values[param.id] as string) || ''} onValueChange={(v) => onChange(param.id, v)}>
                    <SelectTrigger id={param.id} className="w-full">
                      <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : param.type === 'textarea' ? (
                  <Textarea
                    id={param.id}
                    value={(values[param.id] as string) || ''}
                    onChange={(e) => onChange(param.id, e.target.value)}
                    placeholder={param.label}
                  />
                ) : (
                  <Input
                    id={param.id}
                    type={param.type === 'date' ? 'date' : 'text'}
                    value={(values[param.id] as string) || ''}
                    onChange={(e) => onChange(param.id, e.target.value)}
                    placeholder={param.label}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DocsStep({
  app,
  requiredDocs,
  progress,
  uploadedCount,
  onUpload,
  onRemove,
}: {
  app: Application;
  requiredDocs: ReturnType<typeof getRequiredDocuments>;
  progress: number;
  uploadedCount: number;
  onUpload: (file: Omit<UploadedFile, 'id'>) => void;
  onRemove: (fileId: string) => void;
}) {
  const { importApplication } = useApplications();
  const [seeding, setSeeding] = useState(false);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Seed failed');
      const data = await res.json();
      importApplication(data.app);
      toast.success('Демо-документы загружены');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="wizard-docs-step">
      <Card>
        <CardHeader>
          <CardTitle>Загрузка документов</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Загружено {uploadedCount} из {requiredDocs.length} обязательных документов
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} />
          {app.files.length === 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="text-sm text-muted-foreground">Хотите посмотреть, как работает проверка?</span>
              <Button variant="outline" size="sm" onClick={handleSeedDemo} disabled={seeding}>
                {seeding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Загрузить демо-документы
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {requiredDocs.map((req) => {
          const files = app.files.filter((f) => f.documentTypeId === req.documentTypeId);
          const alternativeFiles = req.alternativeDocumentTypeId
            ? app.files.filter((f) => f.documentTypeId === req.alternativeDocumentTypeId)
            : [];
          return (
            <div key={req.documentTypeId} className="space-y-2">
              <DocumentUploader
                documentTypeId={req.documentTypeId}
                files={files}
                onUpload={onUpload}
                onRemove={onRemove}
              />
              {req.alternativeDocumentTypeId && (
                <div className="space-y-2 rounded-xl border border-dashed p-2">
                  <p className="px-1 text-xs text-muted-foreground">
                    Альтернатива к обязательному документу. Если она загружена, документ считается закрытым.
                  </p>
                  <DocumentUploader
                    documentTypeId={req.alternativeDocumentTypeId}
                    files={alternativeFiles}
                    onUpload={onUpload}
                    onRemove={onRemove}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckStep({
  app,
  requiredDocs,
  rules,
  onRun,
  onSubmit,
  onSaveDraft,
  mandatoryCount,
}: {
  app: Application;
  requiredDocs: ReturnType<typeof getRequiredDocuments>;
  rules: Rule[];
  onRun: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  mandatoryCount: number;
}) {
  const findingSummary = useMemo(
    () => ({
      critical: app.findings.filter((finding) => finding.severity === 'critical').length,
      serious: app.findings.filter((finding) => finding.severity === 'serious').length,
      warning: app.findings.filter((finding) => finding.severity === 'warning').length,
      unknown: app.findings.filter((finding) => finding.severity === 'unknown').length,
    }),
    [app.findings]
  );

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.active !== false && matchesWizardConditions(app.values, rule.conditions)),
    [app.values, rules]
  );

  const documentRows = useMemo(
    () =>
      requiredDocs.map((req) => {
        const documentType = documentTypes.find((doc) => doc.id === req.documentTypeId);
        const alternativeDocumentType = req.alternativeDocumentTypeId
          ? documentTypes.find((doc) => doc.id === req.alternativeDocumentTypeId)
          : undefined;
        const uploadedFile = app.files.find(
          (file) => file.documentTypeId === req.documentTypeId || file.documentTypeId === req.alternativeDocumentTypeId
        );
        const activatingRule = activeRules.find((rule) =>
          rule.requiredDocuments.some((doc) => doc.documentTypeId === req.documentTypeId)
        );

        return {
          id: req.documentTypeId,
          name: documentType?.name || req.documentTypeId,
          alternativeName: alternativeDocumentType?.name,
          uploaded: !!uploadedFile,
          uploadedName: uploadedFile?.name,
          severity: req.severityIfMissing,
          checks: req.checks || documentType?.checkIds || [],
          ruleName: activatingRule?.name || 'Правило не найдено',
          conditionText: activatingRule ? formatWizardConditions(activatingRule.conditions, app.values) : '—',
        };
      }),
    [activeRules, app.files, app.values, requiredDocs]
  );

  return (
    <div className="space-y-6" data-testid="wizard-check-step">
      <Card>
        <CardHeader>
          <CardTitle>Предварительная экспертиза</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Нажмите «Запустить проверку», чтобы получить список замечаний по комплектности и расхождениям между
            документами.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRun}>
              <Sparkles className="mr-2 h-4 w-4" />
              Запустить проверку
            </Button>
            <Button variant="outline" onClick={onSaveDraft}>
              <Save className="mr-2 h-4 w-4" />
              Сохранить черновик
            </Button>
            <Button onClick={onSubmit} disabled={mandatoryCount > 0}>
              <Send className="mr-2 h-4 w-4" />
              Отправить в экспертизу
            </Button>
          </div>
          {mandatoryCount > 0 && (
            <p className="text-sm text-amber-600">
              Для отправки нужно устранить все замечания уровня «критично» или «серьезно».
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <CompactMetric label="Критично" value={findingSummary.critical} tone="critical" />
        <CompactMetric label="Серьезно" value={findingSummary.serious} tone="serious" />
        <CompactMetric label="Предупреждения" value={findingSummary.warning} tone="warning" />
        <CompactMetric label="Документы" value={`${documentRows.filter((row) => row.uploaded).length}/${documentRows.length}`} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Комплектность документов</CardTitle>
          <p className="text-sm text-muted-foreground">
            Список формируется правилами, которые сработали от параметров заявки. Активных правил: {activeRules.length}.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Документ</th>
                  <th className="px-4 py-3 font-medium">Критичность</th>
                  <th className="px-4 py-3 font-medium">Почему требуется</th>
                  <th className="px-4 py-3 font-medium">Проверки</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <StatusPill ok={row.uploaded} okText="Есть" failText="Нет" />
                      {row.uploadedName && <div className="mt-1 max-w-40 truncate text-xs text-muted-foreground">{row.uploadedName}</div>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{row.name}</div>
                      {row.alternativeName && (
                        <div className="mt-1 text-xs text-muted-foreground">Альтернатива: {row.alternativeName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <SeverityBadge severity={row.severity} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-[280px] font-medium">{row.ruleName}</div>
                      <div className="mt-1 max-w-[320px] text-xs text-muted-foreground">{row.conditionText}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex max-w-[260px] flex-wrap gap-1.5">
                        {row.checks.slice(0, 3).map((check) => (
                          <span key={check} className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {shortCheckName(check)}
                          </span>
                        ))}
                        {row.checks.length > 3 && (
                          <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            +{row.checks.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {app.findings.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Замечания проверки</CardTitle>
              <p className="text-sm text-muted-foreground">
                Компактный список того, что блокирует отправку или требует внимания.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Уровень</th>
                      <th className="px-4 py-3 font-medium">Проверка</th>
                      <th className="px-4 py-3 font-medium">Документы</th>
                      <th className="px-4 py-3 font-medium">Замечание</th>
                      <th className="px-4 py-3 font-medium">Что сделать</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.findings.map((finding) => (
                      <tr key={finding.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 align-top">
                          <SeverityBadge severity={finding.severity} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium">{finding.category}</div>
                          {finding.npaReference && (
                            <div className="mt-1 text-xs text-muted-foreground">{finding.npaReference}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="max-w-[190px] text-xs text-muted-foreground">
                            {finding.documents.length ? finding.documents.join(', ') : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="max-w-[260px] font-medium">{finding.title}</div>
                          <div className="mt-1 max-w-[320px] text-xs text-muted-foreground">{finding.description}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="max-w-[280px] text-xs text-muted-foreground">{finding.recommendation}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        {app.findings.length === 0 && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="flex items-center gap-3 py-6">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span className="font-medium">Замечаний не выявлено. Заявка готова к подаче.</span>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'critical' | 'serious' | 'warning' | 'neutral';
}) {
  const styles = {
    critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100',
    serious: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/20 dark:text-yellow-100',
    neutral: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
    </div>
  );
}

function StatusPill({ ok, okText, failText }: { ok: boolean; okText: string; failText: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100'
          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? okText : failText}
    </span>
  );
}

function matchesWizardConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
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

function formatWizardConditions(conditions: RuleCondition[], values: Application['values']): string {
  if (conditions.length === 0) return 'Всегда';
  return conditions
    .map((condition) => {
      const parameter = parameters.find((param) => param.id === condition.parameterId);
      const currentValue = values[condition.parameterId];
      const expectedValue = condition.value;
      return `${parameter?.label || condition.parameterId}: ${operatorLabel(condition.operator)} ${formatParameterValue(
        condition.parameterId,
        expectedValue
      )}; сейчас ${formatCurrentValue(condition.parameterId, currentValue)}`;
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
    pharmacovigilance_contact_check: 'фармаконадзор',
    black_triangle_check: 'мониторинг',
    ls_variation_consistency_check: 'изменения',
    mi_variation_consistency_check: 'изменения МИ',
  };
  return names[checkId] || checkId.replace(/_check$/, '').replace(/_/g, ' ');
}
