'use client';

import { Application, Rule } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, LsApplicationSummary } from '@/components/expert/detail/application-summary';
import { formatConditions, labelFor } from '@/components/expert/detail/review-logic';

export function ApplicationSidePanel({ app, matrixRows, activeRules }: { app: Application; matrixRows: any[]; activeRules: Rule[] }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Параметры заявки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Тип процедуры" value={labelFor('param-procedure', app.values['param-procedure'])} />
          {app.values['param-object-type'] === 'MI' ? (
            <>
              <Field label="Класс риска" value={labelFor('param-mi-risk-class', app.values['param-mi-risk-class'])} />
              <Field label="Тип МИ" value={labelFor('param-mi-type', app.values['param-mi-type'])} />
              <Field label="Наименование МИ" value={app.values['param-mi-name-ru'] || app.values['param-trade-name']} />
              <Field label="Модель / модификация" value={app.values['param-mi-model']} />
              <Field label="Назначение" value={app.values['param-mi-purpose']} />
              <Field label="Стерильное изделие" value={labelFor('param-mi-sterile', app.values['param-mi-sterile'])} />
            </>
          ) : (
            <LsApplicationSummary values={app.values} />
          )}
          <Field label="Производитель" value={app.values['param-manufacturer']} />
          <Field label="Адрес производителя" value={app.values['param-manufacturer-address']} />
          <Field label="Заявитель" value={app.values['param-applicant']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Матрица проверки заявки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <MatrixMetric value={matrixRows.length} label="документов" />
            <MatrixMetric value={new Set(matrixRows.flatMap((row) => row.checkIds)).size} label="проверок" />
            <MatrixMetric value={new Set(matrixRows.flatMap((row) => row.runnerMethods)).size} label="методов" />
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
  );
}

function MatrixMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
