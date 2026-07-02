'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GemmaCheckRequirement } from '@/lib/data/ls-dossier-document-types-new';
import { ConditionBuilder } from '@/components/admin/condition-builder';
import { describeCondition } from '@/lib/admin/condition-attributes';

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
      .map((r) => ({
        id: r.id || undefined,
        kind: r.kind,
        text: r.text.trim(),
        path: r.path,
        applicabilityNode: r.applicabilityNode ?? null,
        sourceReference: r.sourceReference?.trim() || undefined,
        criticality: r.criticality || undefined,
      }));
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
        Текст требования — это инструкция, которую выполняет Gemma. Под каждым требованием показано, к чему оно
        привязано (источник НПА / пункт, критичность, условие применения). Правки сохраняются в профиль проверки и
        применяются при следующей проверке заявки.
      </p>

      <div className="space-y-2">
        {rows.map((row) => {
          const fromNpa = row.sourceScope === 'npa';
          const critValue = row.criticality || '';
          const critKnown = ['critical', 'warning', 'info'].includes(critValue);
          return (
            <div key={row._localId} className="rounded-lg border bg-card p-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
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
              {/* Обоснование по НПА — теперь редактируемое (источник/пункт + критичность) */}
              <div className="mt-2 space-y-2 pl-1 sm:pl-[10.5rem]">
                {fromNpa && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    Привязано из НПА
                    {row.npaId && <Badge variant="outline" className="ml-1 font-mono text-[10px]">{row.npaId}</Badge>}
                  </span>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex-1 text-xs text-muted-foreground">
                    Источник (НПА / пункт)
                    <input
                      value={row.sourceReference || ''}
                      onChange={(e) => update(row._localId, { sourceReference: e.target.value })}
                      placeholder="напр. Решение № 78, п. 12"
                      className="mt-0.5 h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground sm:w-52">
                    Критичность
                    <Select value={critValue} onValueChange={(v) => update(row._localId, { criticality: v })}>
                      <SelectTrigger className="mt-0.5 h-9 w-full"><SelectValue placeholder="не задана" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Критично</SelectItem>
                        <SelectItem value="warning">Предупреждение</SelectItem>
                        <SelectItem value="info">Информационно</SelectItem>
                        {critValue && !critKnown && <SelectItem value={critValue}>{critValue}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                {row.applicabilityCondition && (
                  <div className="text-xs text-muted-foreground"><span className="text-muted-foreground/70">Когда применяется:</span> {row.applicabilityCondition}</div>
                )}
              </div>
              {/* Условие применимости требования (pre-gate перед Gemma) */}
              <details className="mt-2 sm:pl-[10.5rem]">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Когда проверять: {row.applicabilityNode ? describeCondition(row.applicabilityNode) : 'всегда'}
                </summary>
                <div className="mt-2 rounded-lg border bg-muted/10 p-2">
                  <ConditionBuilder
                    value={row.applicabilityNode}
                    onChange={(next) => update(row._localId, { applicabilityNode: next as never })}
                  />
                </div>
              </details>
            </div>
          );
        })}
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
