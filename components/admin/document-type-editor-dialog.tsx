'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { DocumentType } from '@/lib/types';
import type { DocumentTypeEditorState } from '@/lib/admin/admin-page-types';
import { parseListInput, slugifyDocumentTypeId } from '@/lib/admin/document-type-logic';
import { checkDefinitions } from '@/lib/checks/registry';
import { AdminCheckbox, AdminField } from '@/components/admin/admin-field';

export function DocumentTypeEditorDialog({
  state,
  onChange,
  onSave,
  onClose,
}: {
  state: DocumentTypeEditorState | null;
  onChange: (state: DocumentTypeEditorState | null) => void;
  onSave: (values: DocumentType) => void;
  onClose: () => void;
}) {
  const values = state?.values;
  const update = (patch: Partial<DocumentType>) => {
    if (!state) return;
    onChange({ ...state, values: { ...state.values, ...patch } });
  };

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[92vw] xl:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{state?.mode === 'edit' ? 'Редактировать тип документа' : 'Создать тип документа'}</DialogTitle>
          <DialogDescription>
            Тип документа используется в правилах комплектности, проверках и загрузке файлов заявителя.
          </DialogDescription>
        </DialogHeader>

        {values && (
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="ID типа документа" hint={state.mode === 'edit' ? 'ID существующего типа не меняем, чтобы не сломать правила.' : 'Например: doc-custom-smPC'}>
                <Input value={values.id} disabled={state.mode === 'edit'} onChange={(event) => update({ id: slugifyDocumentTypeId(event.target.value) })} />
              </AdminField>
              <AdminField label="Название">
                <Input value={values.name} onChange={(event) => update({ name: event.target.value })} />
              </AdminField>
            </div>

            <AdminField label="Описание">
              <Textarea
                value={values.description || ''}
                onChange={(event) => update({ description: event.target.value })}
                className="min-h-24"
              />
            </AdminField>

            <div className="grid gap-4 xl:grid-cols-3">
              <AdminField label="Направление">
                <Select value={values.direction} onValueChange={(direction) => update({ direction: direction as DocumentType['direction'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Общий</SelectItem>
                    <SelectItem value="LS">ЛС</SelectItem>
                    <SelectItem value="MI">МИ</SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
              <AdminField label="Форматы" hint="Через запятую: pdf, docx, jpg">
                <Input
                  value={(values.acceptedFormats || []).join(', ')}
                  onChange={(event) => update({ acceptedFormats: parseListInput(event.target.value).map((item) => item.toLowerCase()) })}
                />
              </AdminField>
              <AdminField label="Языки" hint="Например: ru, kz">
                <Input
                  value={(values.requiredLanguages || []).join(', ')}
                  onChange={(event) => update({ requiredLanguages: parseListInput(event.target.value) })}
                />
              </AdminField>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Checks" hint="ID проверок через запятую">
                <Textarea
                  value={(values.checkIds || []).join(', ')}
                  onChange={(event) => update({ checkIds: parseListInput(event.target.value) })}
                  className="min-h-28 font-mono text-xs"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Доступные checks: {checkDefinitions.map((check) => check.id).join(', ')}
                </p>
              </AdminField>
              <AdminField label="Извлекаемые поля" hint="tradeName, inn, shelfLife и т.п.">
                <Textarea
                  value={(values.expectedExtractedFields || []).join(', ')}
                  onChange={(event) => update({ expectedExtractedFields: parseListInput(event.target.value) })}
                  className="min-h-28 font-mono text-xs"
                />
              </AdminField>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Ссылки на НПА" hint="Можно через строки или запятые">
                <Textarea
                  value={(values.npaReferences || []).join('\n')}
                  onChange={(event) => update({ npaReferences: parseListInput(event.target.value) })}
                  className="min-h-28"
                />
              </AdminField>
              <AdminField label="Пояснение обязательности">
                <Textarea
                  value={values.requirednessExplanation || ''}
                  onChange={(event) => update({ requirednessExplanation: event.target.value })}
                  className="min-h-28"
                />
              </AdminField>
            </div>

            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <AdminCheckbox label="Требуется OCR" checked={!!values.needsOcr} onChange={(checked) => update({ needsOcr: checked })} />
              <AdminCheckbox label="Физический образец" checked={!!values.isPhysicalSample} onChange={(checked) => update({ isPhysicalSample: checked })} />
              <AdminCheckbox label="Проверять шрифт" checked={!!values.canCheckFont} onChange={(checked) => update({ canCheckFont: checked })} />
              <AdminCheckbox label="Проверять срок действия" checked={!!values.canCheckExpiry} onChange={(checked) => update({ canCheckExpiry: checked })} />
              <AdminCheckbox label="Проверять подпись" checked={!!values.canCheckSignature} onChange={(checked) => update({ canCheckSignature: checked })} />
              <AdminCheckbox label="Проверять печать" checked={!!values.canCheckSeal} onChange={(checked) => update({ canCheckSeal: checked })} />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Отмена</Button>
              <Button onClick={() => onSave(values)}>
                {state.mode === 'edit' ? 'Сохранить изменения' : 'Создать тип документа'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

