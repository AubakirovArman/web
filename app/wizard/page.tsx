'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { useRules } from '@/lib/hooks/useRules';
import { documentTypes, parameters, productTypeLabels } from '@/lib/data/seed';
import { getRequiredDocuments } from '@/lib/rules/engine';
import { DocumentUploader } from '@/components/applicant/document-uploader';
import { FindingCard } from '@/components/shared/finding-card';
import { SeverityBadge } from '@/components/shared/severity-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, FileStack, Settings2, Sparkles, ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { Application, UploadedFile } from '@/lib/types';

const steps = [
  { id: 'params', title: 'Параметры', icon: Settings2 },
  { id: 'docs', title: 'Документы', icon: FileStack },
  { id: 'check', title: 'Проверка', icon: Sparkles },
];

export default function WizardPage() {
  const router = useRouter();
  const { applications, currentId, setCurrentId, addApplication, updateValues, addFile, removeFile, runCheck, submitApplication } =
    useApplications();
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
    () => (app ? requiredDocs.filter((req) => app.files.some((f) => f.documentTypeId === req.documentTypeId)).length : 0),
    [app, requiredDocs]
  );
  const progress = useMemo(
    () => (requiredDocs.length ? Math.round((uploadedCount / requiredDocs.length) * 100) : 0),
    [requiredDocs.length, uploadedCount]
  );

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
    submitApplication(app.id);
    toast.success('Заявка отправлена в экспертизу');
    router.push('/expert');
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
                      {productTypeLabels[app.values['param-product-type'] as keyof typeof productTypeLabels] || 'Заявка'} ·{' '}
                      {app.values['param-trade-name'] || '—'}
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
                      onClick={() => setStep(i)}
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
                  {step === 2 && <CheckStep app={app} onRun={handleRunCheck} onSubmit={handleSubmit} />}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад
                </Button>
                {step < 2 && (
                  <Button onClick={() => setStep(step + 1)}>
                    Далее
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
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

  const visibleParamIds = new Set<string>([
    'param-object-type',
    'param-procedure',
    'param-trade-name',
    'param-inn',
    'param-dosage-form',
    'param-dosage',
    'param-manufacturer',
    'param-manufacturer-address',
    'param-applicant',
  ]);

  if (objectType === 'LS') {
    visibleParamIds.add('param-product-type');
    visibleParamIds.add('param-administration-route');
    visibleParamIds.add('param-dispensing');
    visibleParamIds.add('param-sterile');
    visibleParamIds.add('param-aseptic');
    visibleParamIds.add('param-bioequivalence-required');
    visibleParamIds.add('param-clinical-studies');
    visibleParamIds.add('param-holder');
    visibleParamIds.add('param-additional-monitoring');
  }

  if (objectType === 'LS' && (procedure === 're-registration' || procedure === 'variation')) {
    visibleParamIds.add('param-registration-number');
  }

  if (objectType === 'LS' && procedure === 'variation') {
    visibleParamIds.add('param-variation-class');
    visibleParamIds.add('param-variation-area');
    visibleParamIds.add('param-variation-old-value');
    visibleParamIds.add('param-variation-new-value');
  }

  if (objectType === 'MI') {
    visibleParamIds.add('param-mi-risk-class');
    visibleParamIds.add('param-mi-type');
    visibleParamIds.add('param-mi-sterile');
    visibleParamIds.add('param-mi-measuring');
    visibleParamIds.add('param-mi-ivd');
    visibleParamIds.add('param-mi-implantable');
  }

  if (objectType === 'MI' && (procedure === 're-registration' || procedure === 'variation')) {
    visibleParamIds.add('param-mi-registration-number');
  }

  if (objectType === 'MI' && procedure === 'variation') {
    visibleParamIds.add('param-mi-variation-class');
    visibleParamIds.add('param-mi-variation-area');
    visibleParamIds.add('param-mi-variation-old-value');
    visibleParamIds.add('param-mi-variation-new-value');
  }

  const visibleParams = parameters.filter((p) => visibleParamIds.has(p.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Параметры заявки</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {visibleParams.map((param) => (
          <div key={param.id} className="space-y-2">
            <Label htmlFor={param.id}>{param.label}</Label>
            {param.type === 'select' ? (
              <Select value={(values[param.id] as string) || ''} onValueChange={(v) => onChange(param.id, v)}>
                <SelectTrigger id={param.id}>
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
            ) : (
              <Input
                id={param.id}
                value={(values[param.id] as string) || ''}
                onChange={(e) => onChange(param.id, e.target.value)}
                placeholder={param.label}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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
    <div className="space-y-6">
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
          return (
            <DocumentUploader
              key={req.documentTypeId}
              documentTypeId={req.documentTypeId}
              files={files}
              onUpload={onUpload}
              onRemove={onRemove}
            />
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
}: {
  app: Application;
  onRun: () => void;
  onSubmit: () => void;
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
    <div className="space-y-6">
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
            {app.status === 'checked' && (
              <Button onClick={onSubmit}>
                <Send className="mr-2 h-4 w-4" />
                Отправить в экспертизу
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {app.status === 'checked' && (
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
      )}
    </div>
  );
}
