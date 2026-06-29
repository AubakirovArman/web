'use client';

import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ConditionNode } from '@/lib/types';
import {
  getConditionAttributes,
  getConditionAttribute,
  describeCondition,
  OP_LABELS,
  type ConditionOp,
} from '@/lib/admin/condition-attributes';

type Row = { attr: string; op: ConditionOp; val: string[] };
type Join = 'and' | 'or';

// --- разбор ConditionNode → плоские строки (для простого редактора) ---
function leafToRow(leaf: any): Row | null {
  if (!leaf || typeof leaf !== 'object') return null;
  if (Array.isArray(leaf.eq)) return { attr: leaf.eq[0], op: 'eq', val: [String(leaf.eq[1] ?? '')] };
  if (Array.isArray(leaf.neq)) return { attr: leaf.neq[0], op: 'neq', val: [String(leaf.neq[1] ?? '')] };
  if (Array.isArray(leaf.in)) return { attr: leaf.in[0], op: 'in', val: (leaf.in[1] || []).map(String) };
  if (Array.isArray(leaf.not_empty)) return { attr: leaf.not_empty[0], op: 'not_empty', val: [] };
  if (Array.isArray(leaf.empty)) return { attr: leaf.empty[0], op: 'empty', val: [] };
  if (Array.isArray(leaf.contains)) return { attr: leaf.contains[0], op: 'contains', val: [String(leaf.contains[1] ?? '')] };
  return null;
}

function parse(value: ConditionNode | null | undefined): { rows: Row[]; join: Join; complex: boolean } {
  if (!value || typeof value !== 'object') return { rows: [], join: 'and', complex: false };
  const n = value as Record<string, any>;
  let items: any[] | null = null;
  let join: Join = 'and';
  if (Array.isArray(n.all)) { items = n.all; join = 'and'; }
  else if (Array.isArray(n.any)) { items = n.any; join = 'or'; }
  else { items = [n]; } // одиночный лист
  const rows = (items || []).map(leafToRow);
  if (rows.some((r) => r === null)) return { rows: [], join, complex: true }; // вложенное/неизвестное — не упрощаем
  return { rows: rows as Row[], join, complex: false };
}

function rowToLeaf(r: Row): any {
  if (r.op === 'not_empty') return { not_empty: [r.attr] };
  if (r.op === 'empty') return { empty: [r.attr] };
  if (r.op === 'in') return { in: [r.attr, r.val] };
  return { [r.op]: [r.attr, r.val[0] ?? ''] };
}

function build(rows: Row[], join: Join): ConditionNode | null {
  const valid = rows.filter((r) => r.attr && (r.op === 'not_empty' || r.op === 'empty' || r.val.length));
  if (valid.length === 0) return null;
  if (valid.length === 1) return rowToLeaf(valid[0]) as ConditionNode;
  return (join === 'or' ? { any: valid.map(rowToLeaf) } : { all: valid.map(rowToLeaf) }) as ConditionNode;
}

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: ConditionNode | null | undefined;
  onChange: (next: ConditionNode | null) => void;
}) {
  const attrs = useMemo(() => getConditionAttributes(), []);
  const { rows, join, complex } = useMemo(() => parse(value), [value]);

  const emit = (nextRows: Row[], nextJoin: Join) => onChange(build(nextRows, nextJoin));

  if (complex) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <div className="text-muted-foreground">Сложное (вложенное) условие — редактируется в JSON, чтобы не потерять логику.</div>
        <pre className="overflow-x-auto rounded bg-background p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>
        <Button variant="outline" size="sm" onClick={() => onChange(null)}>Сбросить в «Применяется всегда»</Button>
      </div>
    );
  }

  const updateRow = (i: number, patch: Partial<Row>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    emit(next, join);
  };
  const removeRow = (i: number) => emit(rows.filter((_, idx) => idx !== i), join);
  const addRow = () => {
    const first = attrs[0];
    emit([...rows, { attr: first?.key || '', op: first?.operators[0] || 'eq', val: [] }], join);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Условие применимости</span>
        {rows.length === 0 && <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Применяется всегда</Badge>}
      </div>

      {rows.map((row, i) => {
        const attr = getConditionAttribute(row.attr);
        const ops = attr?.operators || ['eq'];
        const needsValue = row.op !== 'not_empty' && row.op !== 'empty';
        return (
          <div key={i} className="space-y-1.5">
            {i > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => emit(rows, join === 'and' ? 'or' : 'and')}
                  className="rounded border px-2 py-0.5 text-xs font-medium hover:bg-accent"
                >
                  {join === 'and' ? 'И' : 'ИЛИ'}
                </button>
                <span className="text-[10px] text-muted-foreground">переключить</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {/* поле */}
              <Select value={row.attr} onValueChange={(v) => updateRow(i, { attr: v, op: (getConditionAttribute(v)?.operators[0] || 'eq'), val: [] })}>
                <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Поле" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {attrs.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* оператор */}
              <Select value={row.op} onValueChange={(v) => updateRow(i, { op: v as ConditionOp, val: [] })}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ops.map((o) => <SelectItem key={o} value={o}>{OP_LABELS[o]}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* значение */}
              {needsValue && attr && (attr.options.length > 0 ? (
                row.op === 'in' ? (
                  <div className="flex flex-wrap gap-1">
                    {attr.options.map((o) => {
                      const on = row.val.includes(o.value);
                      return (
                        <button key={o.value} type="button"
                          onClick={() => updateRow(i, { val: on ? row.val.filter((x) => x !== o.value) : [...row.val, o.value] })}
                          className={`rounded border px-2 py-1 text-xs ${on ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Select value={row.val[0] || ''} onValueChange={(v) => updateRow(i, { val: [v] })}>
                    <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Значение" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {attr.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )
              ) : needsValue ? (
                <input
                  value={row.val[0] || ''}
                  onChange={(e) => updateRow(i, { val: [e.target.value] })}
                  placeholder="значение"
                  className="h-9 w-48 rounded-md border bg-background px-3 text-sm"
                />
              ) : null)}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(i)} aria-label="Удалить">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addRow}><Plus className="mr-1 h-4 w-4" />Добавить условие</Button>
        {rows.length > 0 && <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Сделать «всегда»</Button>}
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-2 text-sm">
          <span className="text-xs text-muted-foreground">Превью: </span>
          {describeCondition(build(rows, join))}
        </div>
      )}
    </div>
  );
}
