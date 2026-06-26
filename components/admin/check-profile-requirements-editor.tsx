'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GemmaCheckRequirement } from '@/lib/data/ls-dossier-document-types-new';

const KIND_LABEL: Record<GemmaCheckRequirement['kind'], string> = {
  required: 'Обязательное',
  conditional: 'Условное',
  cross_document: 'Сверка',
  routing: 'Маршрут',
};

type Row = GemmaCheckRequirement & { _localId: string };

let seq = 0;
const localId = () => `local-${(seq += 1)}`;

export function CheckProfileRequirementsEditor({
  documentTypeId,
  initial,
  onSaved,
}: {
  documentTypeId: string;
  initial: GemmaCheckRequirement[];
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(initial.map((r) => ({ ...r, _localId: localId() })));
  }, [initial]);

  const update = (lid: string, patch: Partial<Row>) =>
    setRows((cur) => cur.map((r) => (r._localId === lid ? { ...r, ...patch } : r)));
  const remove = (lid: string) => setRows((cur) => cur.filter((r) => r._localId !== lid));
  const add = () =>
    setRows((cur) => [...cur, { _localId: localId(), id: '', kind: 'required', text: '' }]);

  const save = async () => {
    const payload = rows
      .filter((r) => r.text.trim())
      .map((r) => ({ id: r.id || undefined, kind: r.kind, text: r.text.trim(), path: r.path }));
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/document-types/${encodeURIComponent(documentTypeId)}/requirements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить требования');
      toast.success('Сохранено — следующая проверка заявки использует обновлённые требования');
      if (Array.isArray(data.item?.checkProfileRequirements)) {
        setRows(data.item.checkProfileRequirements.map((r: GemmaCheckRequirement) => ({ ...r, _localId: localId() })));
      }
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить требования');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Gemma читает загруженный документ и по каждому требованию ставит «пройдено / не пройдено / неприменимо».
        Текст требования — это инструкция, которую выполняет Gemma. Правки сохраняются в профиль проверки и
        применяются при следующей проверке заявки.
      </p>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row._localId} className="flex flex-col gap-2 rounded-lg border bg-card p-2 sm:flex-row sm:items-start">
            <Select value={row.kind} onValueChange={(value) => update(row._localId, { kind: value as Row['kind'] })}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as GemmaCheckRequirement['kind'][]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={row.text}
              onChange={(event) => update(row._localId, { text: event.target.value })}
              rows={2}
              className="min-h-0 flex-1 text-sm"
              placeholder="Текст требования (инструкция для Gemma)"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
              onClick={() => remove(row._localId)}
              aria-label="Удалить требование"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Требований нет. Добавьте первое.
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Добавить требование
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Сохранить
        </Button>
      </div>
    </div>
  );
}
