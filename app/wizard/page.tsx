'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useApplications } from '@/lib/hooks/useApplications';
import { useResolvedRequiredDocuments } from '@/lib/hooks/useResolvedRequiredDocuments';
import { useRules } from '@/lib/hooks/useRules';
import { documentTypes, productTypeLabels } from '@/lib/data/seed';
import { getRequiredDocuments } from '@/lib/rules/engine';
import { getBlockingFindings, runSectionValidation } from '@/lib/checks';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, FileStack, Settings2, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { Application, Finding } from '@/lib/types';
import { CheckStep } from '@/components/applicant/wizard/check-step';
import { DocsStep } from '@/components/applicant/wizard/docs-step';
import { ParamsStep } from '@/components/applicant/wizard/params-step';
import { getVisibleParamsSubSteps } from '@/components/applicant/wizard/parameter-groups';
import { buildDosageValue, getDisplayTradeName, getStringValue, parseJson } from '@/components/applicant/wizard/parameter-value-helpers';

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
    createTestSubmissionCopy,
    updateStatus,
    importApplication,
  } = useApplications();
  const { rules, importRules } = useRules();
  const { store, setDocumentTypes } = useStore();
  const [step, setStep] = useState(0);
  const [paramsSubStep, setParamsSubStep] = useState(0);

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

  // Открытие конкретной заявки по ?id= (из кабинета заявителя)
  useEffect(() => {
    const idParam = new URLSearchParams(window.location.search).get('id');
    if (idParam) {
      setCurrentId(idParam);
    }
  }, [setCurrentId]);

  useEffect(() => {
    const idParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;
    if (!currentId && !idParam && applications.length > 0) {
      setCurrentId(applications[0].id);
    }
  }, [currentId, applications, setCurrentId]);

  // The global provider holds lightweight summaries (no per-file extracted
  // text). When an existing application becomes current, hydrate the full
  // version so client-side checks have the extracted data.
  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    void fetch(`/api/applications/${encodeURIComponent(currentId)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.application) importApplication(data.application);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // importApplication identity changes on every applications update; depend on currentId only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const app = useMemo(() => applications.find((a) => a.id === currentId), [applications, currentId]);
  const paramsSubSteps = useMemo(() => getVisibleParamsSubSteps(app?.values), [app?.values]);
  const isParamsSubStep = step === 0 && paramsSubSteps.length > 0;
  const isLastParamsSubStep = !isParamsSubStep || paramsSubStep >= paramsSubSteps.length - 1;

  useEffect(() => {
    if (paramsSubSteps.length === 0) {
      if (paramsSubStep !== 0) setParamsSubStep(0);
      return;
    }
    if (paramsSubStep > paramsSubSteps.length - 1) {
      setParamsSubStep(paramsSubSteps.length - 1);
    }
  }, [paramsSubStep, paramsSubSteps.length]);
  const baseDocumentTypesCatalog = store.documentTypes.length ? store.documentTypes : documentTypes;
  const legacyRequiredDocs = useMemo(
    () => (app ? getRequiredDocuments(app, rules, baseDocumentTypesCatalog) : []),
    [app, rules, baseDocumentTypesCatalog],
  );
  const resolvedRequirements = useResolvedRequiredDocuments(app, legacyRequiredDocs, baseDocumentTypesCatalog);
  const documentTypesCatalog = resolvedRequirements.documentTypesCatalog;
  const requiredDocs = resolvedRequirements.requiredDocs;
  const blockingFindings = useMemo(() => (app ? getBlockingFindings(app.findings) : []), [app]);

  const handleParamChange = (id: string, value: string | string[]) => {
    if (!app) return;
    const patch: Application['values'] = { [id]: value };
    const nextValues = { ...app.values, [id]: value };

    if (['param-trade-name-kz', 'param-trade-name-ru', 'param-trade-name-en'].includes(id)) {
      patch['param-trade-name'] = getDisplayTradeName(nextValues);
    }

    if (['param-inn-kz', 'param-inn-ru', 'param-inn-en'].includes(id)) {
      patch['param-inn'] =
        getStringValue(nextValues['param-inn-ru']).trim() ||
        getStringValue(nextValues['param-inn-kz']).trim() ||
        getStringValue(nextValues['param-inn-en']).trim();
    }

    if (id === 'param-dosage-amount' || id === 'param-dosage-unit') {
      patch['param-dosage'] = buildDosageValue(nextValues);
    }

    if (id === 'param-atc-name-ru') {
      patch['param-atc-name'] = String(value || '');
    }

    if (id === 'param-administration-routes') {
      const routes = parseJson<string[]>(String(value || ''), []);
      patch['param-administration-route'] = routes[0] || '';
    }

    updateValues(app.id, patch);
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
    router.push(`/expert/${app.id}`);
  };

  const handleTestSubmit = async () => {
    if (!app) return;
    try {
      const copy = await createTestSubmissionCopy(app.id);
      if (!copy) {
        toast.error('Не удалось найти текущую заявку для тестовой отправки');
        return;
      }
      toast.success('Создана новая тестовая заявка, полный прогон запущен');
      router.push(`/expert/${copy.id}`);
    } catch (error) {
      console.warn(error);
      toast.error('Не удалось создать тестовую копию заявки');
    }
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
    if (isParamsSubStep && !isLastParamsSubStep) {
      setParamsSubStep((current) => Math.min(paramsSubSteps.length - 1, current + 1));
      return;
    }

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
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4">
          {!app ? (
            <FadeIn>
              <div className="flex min-h-[60vh] items-center justify-center">
                <Card className="max-w-md">
                  <CardHeader>
                    <CardTitle>Нет активной заявки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => addApplication()}>Создать демо-заявку</Button>
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
                      · {getDisplayTradeName(app.values) || app.values['param-trade-name'] || '—'}
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
                  {step === 0 && (
                    <ParamsStep
                      values={app.values}
                      onChange={handleParamChange}
                      subStep={paramsSubStep}
                      onSubStepChange={setParamsSubStep}
                    />
                  )}
                  {step === 1 && (
                    <DocsStep
                      app={app}
                      requiredDocs={requiredDocs}
                      documentTypesCatalog={documentTypesCatalog}
                      requirementSource={resolvedRequirements.source}
                      requirementsLoading={resolvedRequirements.loading}
                      requirementDiagnostics={resolvedRequirements.diagnostics}
                      onUpload={(file) => addFile(app.id, file)}
                      onRemove={(fileId) => removeFile(app.id, fileId)}
                    />
                  )}
                  {step === 2 && (
                    <CheckStep
                      app={app}
                      requiredDocs={requiredDocs}
                      documentTypesCatalog={documentTypesCatalog}
                      rules={rules}
                      onRun={handleRunCheck}
                      onSubmit={handleSubmit}
                      onTestSubmit={handleTestSubmit}
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
                  {step < 2 && (!isParamsSubStep || isLastParamsSubStep) && (
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
