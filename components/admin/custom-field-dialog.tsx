'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export interface EditableCustomField {
  id?: string;
  label: string;
  type: string;
  section?: string;
  scopeObjectType?: 'LS' | 'MI' | 'both';
  options?: { value: string; label: string }[];
  sourceNpa?: string;
  sourceFieldRef?: string;
}

const TYPE_LABELS: Record<string, string> = {
  select: 'Список (один)',
  multiselect: 'Список (несколько)',
  text: 'Текст',
  textarea: 'Многострочный текст',
  number: 'Число',
  date: 'Дата',
  boolean: 'Да/Нет',
};

export function CustomFieldDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: EditableCustomField | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [label, setLabel] = useState('');
  const [type, setType] = useState('select');
  const [scope, setScope] = useState<'LS' | 'MI' | 'both'>('LS');
  const [section, setSection] = useState('');
  const [sourceNpa, setSourceNpa] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label || '');
    setType(initial?.type || 'select');
    setScope(initial?.scopeObjectType || 'LS');
    setSection(initial?.section || '');
    setSourceNpa(initial?.sourceNpa || '');
    setOptions(initial?.options?.length ? initial.options : []);
  }, [open, initial]);

  const needsOptions = type === 'select' || type === 'multiselect';

  const addOption = () => setOptions((o) => [...o, { value: '', label: '' }]);
  const updateOption = (i: number, patch: Partial<{ value: string; label: string }>) =>
    setOptions((o) => o.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeOption = (i: number) => setOptions((o) => o.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!label.trim()) {
      toast.error('Укажите название поля');
      return;
    }
    const cleanOptions = options.map((o) => ({ value: o.value.trim(), label: o.label.trim() || o.value.trim() })).filter((o) => o.value);
    if (needsOptions && cleanOptions.length === 0) {
      toast.error('Добавьте хотя бы одно значение для списка');
      return;
    }
    setSaving(true);
    try {
      const body = { label: label.trim(), type, scopeObjectType: scope, section: section.trim() || undefined, sourceNpa: sourceNpa.trim() || undefined, options: needsOptions ? cleanOptions : undefined };
      const res = await fetch(isEdit ? `/api/admin/fields/${encodeURIComponent(initial!.id!)}` : '/api/admin/fields', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить поле');
      toast.success(isEdit ? 'Поле обновлено' : 'Поле создано — доступно в конструкторе условий');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить поле');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Изменить поле заявки' : 'Новое поле заявки'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Название поля</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="напр. Класс потенциального риска" />
            {isEdit && initial?.id && <p className="font-mono text-[11px] text-muted-foreground">{initial.id}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Показывать в области</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as 'LS' | 'MI' | 'both')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LS">ЛС</SelectItem>
                  <SelectItem value="MI">МИ</SelectItem>
                  <SelectItem value="both">ЛС и МИ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Раздел в форме (опц.)</Label>
            <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Дополнительные поля" />
          </div>
          {needsOptions && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Значения списка</Label>
                <Button type="button" size="sm" variant="outline" onClick={addOption}><Plus className="mr-1 h-3.5 w-3.5" />Добавить</Button>
              </div>
              {options.length === 0 && <p className="text-xs text-muted-foreground">Добавьте значения (код + название).</p>}
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={o.value} onChange={(e) => updateOption(i, { value: e.target.value })} placeholder="код (value)" className="h-8 font-mono text-xs" />
                  <Input value={o.label} onChange={(e) => updateOption(i, { label: e.target.value })} placeholder="название" className="h-8 text-sm" />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOption(i)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label>Источник по НПА (опц.)</Label>
            <Input value={sourceNpa} onChange={(e) => setSourceNpa(e.target.value)} placeholder="напр. Решение № 46, п. ..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
