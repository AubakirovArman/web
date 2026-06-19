'use client';

import { useMemo } from 'react';
import { Application, DocumentType, Rule } from '@/lib/types';
import { getLsDocumentRequirementByDocumentTypeId } from '@/lib/data/ls-document-checks-mapping';
import { findUploadedRequiredFile, getRequiredDocuments } from '@/lib/rules/engine';
import { SeverityBadge } from '@/components/shared/severity-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Save, Send, Sparkles } from 'lucide-react';
import { CompactMetric, StatusPill } from '@/components/applicant/wizard/check-step-primitives';
import { formatParameterTitle, formatWizardConditions, matchesWizardConditions, shortCheckName } from '@/components/applicant/wizard/check-step-formatters';

export function CheckStep({
  app,
  requiredDocs,
  documentTypesCatalog,
  rules,
  onRun,
  onSubmit,
  onTestSubmit,
  onSaveDraft,
  mandatoryCount,
}: {
  app: Application;
  requiredDocs: ReturnType<typeof getRequiredDocuments>;
  documentTypesCatalog: DocumentType[];
  rules: Rule[];
  onRun: () => void;
  onSubmit: () => void;
  onTestSubmit: () => void;
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
        const documentType = documentTypesCatalog.find((doc) => doc.id === req.documentTypeId);
        const alternativeDocumentType = req.alternativeDocumentTypeId
          ? documentTypesCatalog.find((doc) => doc.id === req.alternativeDocumentTypeId)
          : undefined;
        const uploadedFile = findUploadedRequiredFile(app, req);
        const activatingRule = activeRules.find((rule) =>
          rule.requiredDocuments.some((doc) => doc.documentTypeId === req.documentTypeId)
        );
        const matrixRule = getLsDocumentRequirementByDocumentTypeId(req.documentTypeId);

        return {
          id: req.documentTypeId,
          name: documentType?.name || req.documentTypeId,
          alternativeName: alternativeDocumentType?.name,
          uploaded: !!uploadedFile,
          uploadedName: uploadedFile?.name,
          severity: req.severityIfMissing,
          checks: req.checks || documentType?.checkIds || [],
          npaRequirementCount: documentType?.importedRequirements?.length || 0,
          ruleName: activatingRule?.name || (matrixRule ? `Матрица досье: ${matrixRule.docCode || matrixRule.modulePart}` : 'Правило из БД'),
          conditionText: activatingRule
            ? formatWizardConditions(activatingRule.conditions, app.values)
            : matrixRule?.triggerExpression || documentType?.requiredWhenExpression || '—',
          linkedParams:
            matrixRule?.applicationParamsWithTitles?.slice(0, 5) ||
            documentType?.linkedApplicationParams?.slice(0, 5) ||
            activatingRule?.conditions.map((condition) => formatParameterTitle(condition.parameterId)) ||
            [],
        };
      }),
    [activeRules, app.files, app.values, documentTypesCatalog, requiredDocs]
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
            <Button variant="secondary" onClick={onTestSubmit}>
              <Sparkles className="mr-2 h-4 w-4" />
              Создать тестовую копию и отправить в экспертизу
            </Button>
          </div>
          {mandatoryCount > 0 && (
            <p className="text-sm text-amber-600">
              Для отправки нужно устранить все замечания уровня «критично» или «серьезно».
              Для MVP можно создать тестовую копию и отправить её без снятия этих замечаний.
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
            Список формируется от параметров заявки: для ЛС используется матрица типов документов, для МИ — правила
            комплектности. Сейчас требуется типов документов: {documentRows.length}.
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
                      {row.linkedParams.length > 0 && (
                        <div className="mt-2 flex max-w-[360px] flex-wrap gap-1">
                          {row.linkedParams.map((param) => (
                            <span key={param} className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                              {param}
                            </span>
                          ))}
                        </div>
                      )}
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
                        {row.npaRequirementCount > 0 && (
                          <span className="rounded-full border bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                            НПА: {row.npaRequirementCount}
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
