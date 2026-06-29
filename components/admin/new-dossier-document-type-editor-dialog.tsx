'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import type { Severity } from '@/lib/types';
import { severityLabels, type NewDossierDocumentTypeEditorState } from '@/lib/admin/admin-page-types';
import { parseListInput } from '@/lib/admin/document-type-logic';
import { AdminField } from '@/components/admin/admin-field';
import { ConditionBuilder } from '@/components/admin/condition-builder';
import { LabeledMultiSelect } from '@/components/admin/labeled-multi-select';
import { parameters } from '@/lib/data/seed';
import { checkDefinitions } from '@/lib/checks/registry';

const PARAM_OPTIONS = (() => {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const p of parameters) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ value: p.id, label: p.label || p.id });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
})();
const CHECK_OPTIONS = checkDefinitions
  .map((c) => ({ value: c.id, label: c.name }))
  .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

export function NewDossierDocumentTypeEditorDialog({
  state,
  sections,
  onClose,
  onSave,
}: {
  state: NewDossierDocumentTypeEditorState | null;
  sections: string[];
  onClose: () => void;
  onSave: (item: NewDossierDocumentType) => void;
}) {
  const [draft, setDraft] = useState<NewDossierDocumentType | null>(state?.values || null);

  useEffect(() => {
    setDraft(state?.values || null);
  }, [state]);

  const update = (patch: Partial<NewDossierDocumentType>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{state?.mode === 'create' ? 'Новый тип документа' : 'Редактировать тип документа'}</DialogTitle>
          <DialogDescription>
            Изменения сохраняются в справочнике типов документов регистрационного досье ЛС.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
              <AdminField label="Код *" hint="код документа в досье">
                <Input value={draft.code} onChange={(event) => update({ code: event.target.value })} />
              </AdminField>
              <AdminField label="Наименование *">
                <Input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
              </AdminField>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Область">
                <Select value={draft.direction} onValueChange={(value) => update({ direction: value as NewDossierDocumentType['direction'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LS">ЛС</SelectItem>
                    <SelectItem value="MI">МИ</SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
              <AdminField label="Раздел досье" hint="где документ размещается в структуре досье">
                <Select value={draft.group} onValueChange={(group) => update({ group, module: group })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section} value={section}>{section.replace(/\*/g, '')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AdminField>
            </div>
            <AdminField label="Описание">
              <Textarea value={draft.description} onChange={(event) => update({ description: event.target.value })} className="min-h-24" />
            </AdminField>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold">Логика заявки и проверки</p>
                <p className="text-xs text-muted-foreground">
                  Эти поля управляют тем, когда документ появляется на вкладке «Документы» и что по нему проверяется.
                </p>
              </div>
              <div className="space-y-4">
                <AdminField label="Когда документ обязателен" hint="Визуальный конструктор. Пусто = обязателен всегда. Документ требуется, если условие истинно для параметров заявки.">
                  <ConditionBuilder
                    value={draft.requiredWhenCondition}
                    onChange={(next) => update({ requiredWhenCondition: next as never })}
                  />
                </AdminField>
                <AdminField label="Условие обязательности (текстом, опционально)" hint="Свободное пояснение/легаси-выражение; машинно исполняется конструктор выше.">
                  <Textarea
                    value={draft.requiredWhenExpression || ''}
                    onChange={(event) => update({ requiredWhenExpression: event.target.value })}
                    className="min-h-16 font-mono text-xs"
                  />
                </AdminField>
                <AdminField label="Пояснение обязательности">
                  <Textarea
                    value={draft.requirednessExplanation || ''}
                    onChange={(event) => update({ requirednessExplanation: event.target.value })}
                    className="min-h-20"
                  />
                </AdminField>
                <div className="grid gap-4 xl:grid-cols-3">
                  <AdminField label="Критичность отсутствия">
                    <Select
                      value={draft.severityIfMissing || 'warning'}
                      onValueChange={(value) => update({ severityIfMissing: value as NewDossierDocumentType['severityIfMissing'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['critical', 'serious', 'warning', 'unknown'] as Severity[]).map((severity) => (
                          <SelectItem key={severity} value={severity}>{severityLabels[severity]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminField>
                  <AdminField label="Поля заявки, связанные с документом" hint="Выберите из списка по названию — какие данные заявки относятся к этому документу.">
                    <LabeledMultiSelect
                      options={PARAM_OPTIONS}
                      value={draft.linkedApplicationParams || []}
                      onChange={(next) => update({ linkedApplicationParams: next })}
                      placeholder="Добавить поле"
                      emptyText="Поля не выбраны"
                    />
                  </AdminField>
                  <AdminField label="Автоматические проверки" hint="Какие автоматические проверки применяются к документу.">
                    <LabeledMultiSelect
                      options={CHECK_OPTIONS}
                      value={draft.checkIds || []}
                      onChange={(next) => update({ checkIds: next })}
                      placeholder="Добавить проверку"
                      emptyText="Проверки не выбраны"
                    />
                  </AdminField>
                </div>
                <AdminField label="Что проверять внутри документа" hint="Каждое требование можно разделять символом |">
                  <Textarea
                    value={draft.validationChecks || ''}
                    onChange={(event) => update({ validationChecks: event.target.value })}
                    className="min-h-28"
                  />
                </AdminField>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Тип строки">
                <Select value={draft.kind} onValueChange={(value) => update({ kind: value as NewDossierDocumentType['kind'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Документ</SelectItem>
                    <SelectItem value="section">Секция</SelectItem>
                    <SelectItem value="excluded">Исключён</SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
              <AdminField label="Статус">
                <Select value={draft.active ? 'active' : 'inactive'} onValueChange={(value) => update({ active: value === 'active' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активен</SelectItem>
                    <SelectItem value="inactive">Не активен</SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Форматы" hint="Например: pdf, doc, docx, xls, xlsx, jpg, png">
                <Input
                  value={draft.acceptedFormats.join(', ')}
                  onChange={(event) => update({ acceptedFormats: parseListInput(event.target.value).map((format) => format.toLowerCase()) })}
                />
              </AdminField>
              <AdminField label="Источник">
                <Input value={draft.sourceName} disabled />
              </AdminField>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div>ID: {draft.id}</div>
              <div>Source: {draft.source}</div>
              <div>Sort: {draft.sortOrder}</div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Отмена</Button>
              <Button
                onClick={() => {
                  if (!draft.code.trim() || !draft.name.trim()) {
                    toast.error('Заполните код и наименование типа документа');
                    return;
                  }
                  onSave({
                    ...draft,
                    code: draft.code.trim(),
                    name: draft.name.trim(),
                    description: draft.description.trim(),
                    group: draft.group.trim(),
                    groupCode: draft.groupCode || draft.group.trim(),
                    module: draft.module || draft.group.trim(),
                    acceptedFormats: draft.acceptedFormats.length ? draft.acceptedFormats : ['pdf'],
                    requiredWhenExpression: draft.requiredWhenExpression?.trim() || undefined,
                    requirednessExplanation: draft.requirednessExplanation?.trim() || undefined,
                    validationChecks: draft.validationChecks?.trim() || undefined,
                    checkIds: draft.checkIds?.filter(Boolean),
                    linkedApplicationParams: draft.linkedApplicationParams?.filter(Boolean),
                  });
                }}
              >
                {state?.mode === 'create' ? 'Создать документ' : 'Сохранить'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

