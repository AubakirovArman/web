'use client';

import { Application } from '@/lib/types';
import { getVisibleParameterIds, getRequiredParameterIds, parameters } from '@/lib/data/seed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { renderCustomParameter } from '@/components/applicant/wizard/parameter-custom-fields';
import { getLsParameterGroups, getMiParameterGroups, shouldShowWizardParameter } from '@/components/applicant/wizard/parameter-groups';
import { getStringValue } from '@/components/applicant/wizard/parameter-value-helpers';

export function ParamsStep({
  values,
  onChange,
  subStep,
  onSubStepChange,
}: {
  values: Application['values'];
  onChange: (id: string, value: string | string[]) => void;
  subStep: number;
  onSubStepChange: (step: number) => void;
}) {
  const procedure = values['param-procedure'] as string;
  const objectType = values['param-object-type'] as string;
  const visibleParamIds = getVisibleParameterIds(
    objectType === 'MI' ? 'MI' : 'LS',
    procedure === 're-registration' || procedure === 'variation' ? procedure : 'registration',
    values as Record<string, string>
  );
  const visibleParams = parameters.filter((p) => visibleParamIds.includes(p.id) && shouldShowWizardParameter(p.id, values, objectType));
  const requiredIds = new Set(
    getRequiredParameterIds(
      objectType === 'MI' ? 'MI' : 'LS',
      procedure === 're-registration' || procedure === 'variation' ? procedure : 'registration',
    ),
  );
  const parameterGroups = objectType === 'MI' ? getMiParameterGroups(procedure) : getLsParameterGroups(procedure);
  const activeParameterGroups = parameterGroups
    .map((group) => ({
      ...group,
      params: visibleParams.filter((param) => group.fieldIds.includes(param.id)),
    }))
    .filter((group) => group.params.length > 0);
  const safeSubStep = Math.min(subStep, Math.max(0, activeParameterGroups.length - 1));
  const activeParameterGroup = activeParameterGroups[safeSubStep];
  const paramsForRender = activeParameterGroup?.params || visibleParams;
  const groupedParams = paramsForRender.reduce<Record<string, typeof visibleParams>>((acc, param) => {
    const section = param.section || 'Основные параметры';
    acc[section] = acc[section] || [];
    acc[section].push(param);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="wizard-params-step">
      {activeParameterGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Раздел параметров: {activeParameterGroup?.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Шаг {safeSubStep + 1} из {activeParameterGroups.length}. Заполняйте форму блоками, без длинного скролла по всем параметрам.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeParameterGroups.map((group, index) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onSubStepChange(index)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    index === safeSubStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : index < safeSubStep
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {index + 1}. {group.title}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => onSubStepChange(Math.max(0, safeSubStep - 1))} disabled={safeSubStep === 0}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Назад по параметрам
              </Button>
              <Button
                size="sm"
                onClick={() => onSubStepChange(Math.min(activeParameterGroups.length - 1, safeSubStep + 1))}
                disabled={safeSubStep >= activeParameterGroups.length - 1}
              >
                Далее по параметрам
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(groupedParams).map(([section, sectionParams]) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle>{section}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {sectionParams.map((param) => (
              <ParameterField key={param.id} param={param} values={values} onChange={onChange} required={requiredIds.has(param.id)} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ParameterField({
  param,
  values,
  onChange,
  required,
}: {
  param: typeof parameters[number];
  values: Application['values'];
  onChange: (id: string, value: string | string[]) => void;
  required?: boolean;
}) {
  const custom = renderCustomParameter(param.id, values, onChange);
  if (custom) return custom;

  return (
    <div className={param.type === 'textarea' ? 'space-y-2 sm:col-span-2' : 'space-y-2'}>
      <ParameterLabel param={param} required={required} />
      {param.type === 'select' ? (
        <Select value={getStringValue(values[param.id])} onValueChange={(v) => onChange(param.id, v)}>
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
      ) : param.type === 'boolean' ? (
        <BooleanControl id={param.id} checked={getStringValue(values[param.id]) === 'yes'} onChange={(checked) => onChange(param.id, checked ? 'yes' : 'no')} />
      ) : param.type === 'textarea' ? (
        <Textarea
          id={param.id}
          value={getStringValue(values[param.id])}
          onChange={(e) => onChange(param.id, e.target.value)}
          placeholder={param.label}
        />
      ) : (
        <Input
          id={param.id}
          type={param.type === 'date' ? 'date' : param.type === 'number' || param.id === 'param-dosage-amount' ? 'number' : 'text'}
          value={getStringValue(values[param.id])}
          onChange={(e) => onChange(param.id, e.target.value)}
          placeholder={param.label}
        />
      )}
    </div>
  );
}

function ParameterLabel({ param, required }: { param: typeof parameters[number]; required?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={param.id}>
        {param.label}
        {required && <span className="ml-0.5 text-destructive" title="Обязательное поле" aria-hidden>*</span>}
      </Label>
      {param.sourceFieldRef && (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] text-muted-foreground"
          title={`${param.sourceNpa || 'Источник'}: ${param.sourceFieldRef}`}
        >
          ?
        </span>
      )}
    </div>
  );
}

function BooleanControl({ id, checked, onChange }: { id: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      <span>{checked ? 'Да' : 'Нет'}</span>
    </label>
  );
}
