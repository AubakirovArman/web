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
import { FindingCard } from '@/components/shared/finding-card';
import { SeverityBadge } from '@/components/shared/severity-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, FileStack, Settings2, Sparkles, ArrowLeft, ArrowRight, Send, Save, Loader2 } from 'lucide-react';
import { Application, Finding, UploadedFile } from '@/lib/types';

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
  onRun,
  onSubmit,
  onSaveDraft,
  mandatoryCount,
}: {
  app: Application;
  onRun: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  mandatoryCount: number;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, typeof app.findings> = {};
    for (const f of app.findings) {
      groups[f.severity] = groups[f.severity] || [];
      groups[f.severity].push(f);
    }
    return groups;
  }, [app.findings]);

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

      <div className="space-y-6">
        {(['critical', 'serious', 'warning', 'unknown'] as const).map((sev) =>
          grouped[sev]?.length ? (
            <div key={sev} className="space-y-3">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={sev} />
                <span className="text-sm text-muted-foreground">{grouped[sev].length} замечаний</span>
              </div>
              {grouped[sev].map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          ) : null
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
