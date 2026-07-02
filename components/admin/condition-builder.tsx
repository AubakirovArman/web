'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, FolderPlus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/admin/searchable-select';
import type { ConditionNode } from '@/lib/types';
import {
  getConditionAttributes,
  getConditionAttribute,
  describeCondition,
  validateCondition,
  OP_LABELS,
  ORDER_OPS,
  RANGE_OPS,
  type ConditionAttribute,
  type ConditionOp,
} from '@/lib/admin/condition-attributes';

// --- внутренняя древовидная модель редактора ---
type Leaf = { kind: 'leaf'; attr: string; op: ConditionOp; val: string[] };
type Group = { kind: 'group'; join: 'and' | 'or'; negate: boolean; children: (Leaf | Group)[] };

const NO_VALUE_OPS: ConditionOp[] = ['not_empty', 'empty'];

// --- разбор ConditionNode → дерево (Leaf|Group). unknown=true → в узле есть непонятная форма. ---
function parseLeaf(node: any): Leaf | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node.eq)) return { kind: 'leaf', attr: node.eq[0], op: 'eq', val: [String(node.eq[1] ?? '')] };
  if (Array.isArray(node.neq)) return { kind: 'leaf', attr: node.neq[0], op: 'neq', val: [String(node.neq[1] ?? '')] };
  if (Array.isArray(node.in)) return { kind: 'leaf', attr: node.in[0], op: 'in', val: (node.in[1] || []).map(String) };
  if (Array.isArray(node.gt)) return { kind: 'leaf', attr: node.gt[0], op: 'gt', val: [String(node.gt[1] ?? '')] };
  if (Array.isArray(node.lt)) return { kind: 'leaf', attr: node.lt[0], op: 'lt', val: [String(node.lt[1] ?? '')] };
  if (Array.isArray(node.gte)) return { kind: 'leaf', attr: node.gte[0], op: 'gte', val: [String(node.gte[1] ?? '')] };
  if (Array.isArray(node.lte)) return { kind: 'leaf', attr: node.lte[0], op: 'lte', val: [String(node.lte[1] ?? '')] };
  if (Array.isArray(node.between)) {
    const b = Array.isArray(node.between[1]) ? node.between[1] : ['', ''];
    return { kind: 'leaf', attr: node.between[0], op: 'between', val: [String(b[0] ?? ''), String(b[1] ?? '')] };
  }
  if (Array.isArray(node.not_empty)) return { kind: 'leaf', attr: node.not_empty[0], op: 'not_empty', val: [] };
  if (Array.isArray(node.empty)) return { kind: 'leaf', attr: node.empty[0], op: 'empty', val: [] };
  // объектная форма contains {param, where} и manual — здесь не редактируем (unknown)
  if (Array.isArray(node.contains)) return { kind: 'leaf', attr: node.contains[0], op: 'contains', val: [String(node.contains[1] ?? '')] };
  return null;
}

function parseNode(node: any, flag: { unknown: boolean }): Leaf | Group | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node.not)) {
    const inner = node.not[0];
    const g = toGroup(inner, flag);
    g.negate = true;
    return g;
  }
  if (Array.isArray(node.all)) return { kind: 'group', join: 'and', negate: false, children: parseChildren(node.all, flag) };
  if (Array.isArray(node.any)) return { kind: 'group', join: 'or', negate: false, children: parseChildren(node.any, flag) };
  const leaf = parseLeaf(node);
  if (!leaf) flag.unknown = true;
  return leaf;
}

function parseChildren(items: any[], flag: { unknown: boolean }): (Leaf | Group)[] {
  return items.map((it) => parseNode(it, flag)).filter((x): x is Leaf | Group => x !== null);
}

function toGroup(node: any, flag: { unknown: boolean }): Group {
  const parsed = parseNode(node, flag);
  if (parsed && parsed.kind === 'group') return parsed;
  if (parsed && parsed.kind === 'leaf') return { kind: 'group', join: 'and', negate: false, children: [parsed] };
  return { kind: 'group', join: 'and', negate: false, children: [] };
}

function parseTop(value: ConditionNode | null | undefined): { group: Group; unknown: boolean } {
  const flag = { unknown: false };
  if (!value || typeof value !== 'object') return { group: emptyGroup(), unknown: false };
  return { group: toGroup(value, flag), unknown: flag.unknown };
}

// --- дерево → ConditionNode ---
function buildLeaf(l: Leaf): ConditionNode | null {
  if (!l.attr) return null;
  if (l.op === 'not_empty') return { not_empty: [l.attr] } as ConditionNode;
  if (l.op === 'empty') return { empty: [l.attr] } as ConditionNode;
  if (l.op === 'in') return l.val.length ? ({ in: [l.attr, l.val] } as ConditionNode) : null;
  if (l.op === 'between') {
    return l.val[0] !== '' && l.val[1] !== '' && l.val[0] != null && l.val[1] != null
      ? ({ between: [l.attr, [l.val[0], l.val[1]]] } as unknown as ConditionNode)
      : null;
  }
  return l.val[0] !== '' && l.val[0] != null ? ({ [l.op]: [l.attr, l.val[0]] } as ConditionNode) : null;
}

function buildGroup(g: Group): ConditionNode | null {
  const children = g.children.map((c) => (c.kind === 'leaf' ? buildLeaf(c) : buildGroup(c))).filter((x): x is ConditionNode => x !== null);
  let inner: ConditionNode | null;
  if (children.length === 0) inner = null;
  else if (children.length === 1) inner = children[0];
  else inner = (g.join === 'or' ? { any: children } : { all: children }) as ConditionNode;
  if (inner === null) return null;
  return g.negate ? ({ not: [inner] } as ConditionNode) : inner;
}

function emptyGroup(): Group {
  return { kind: 'group', join: 'and', negate: false, children: [] };
}
function newLeaf(attrs: ConditionAttribute[]): Leaf {
  const first = attrs[0];
  return { kind: 'leaf', attr: first?.key || '', op: first?.operators[0] || 'eq', val: [] };
}

function countLeaves(g: Group): number {
  return g.children.reduce((s, c) => s + (c.kind === 'leaf' ? 1 : countLeaves(c)), 0);
}

// --- редактор одной строки-листа ---
function LeafRow({
  leaf,
  attrOptions,
  onChange,
  onRemove,
}: {
  leaf: Leaf;
  attrOptions: { value: string; label: string }[];
  onChange: (next: Leaf) => void;
  onRemove: () => void;
}) {
  const attr = getConditionAttribute(leaf.attr);
  const ops = attr?.operators || ['eq'];
  const needsValue = !NO_VALUE_OPS.includes(leaf.op);
  const isOrder = ORDER_OPS.includes(leaf.op);
  const isRange = RANGE_OPS.includes(leaf.op);
  const useOptions = Boolean(attr && attr.options.length > 0 && !isOrder);
  const inputType = attr?.type === 'number' ? 'number' : attr?.type === 'date' ? 'date' : 'text';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableSelect
        options={attrOptions}
        value={leaf.attr}
        onChange={(v) => onChange({ ...leaf, attr: v, op: getConditionAttribute(v)?.operators[0] || 'eq', val: [] })}
        placeholder="Поле"
        className="w-56"
      />
      <Select value={leaf.op} onValueChange={(v) => onChange({ ...leaf, op: v as ConditionOp, val: [] })}>
        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ops.map((o) => <SelectItem key={o} value={o}>{OP_LABELS[o]}</SelectItem>)}
        </SelectContent>
      </Select>

      {needsValue && isRange ? (
        <div className="flex items-center gap-1">
          <input type={inputType} value={leaf.val[0] || ''} onChange={(e) => onChange({ ...leaf, val: [e.target.value, leaf.val[1] || ''] })}
            placeholder="от" className="h-9 w-24 rounded-md border bg-background px-2 text-sm" />
          <span className="text-xs text-muted-foreground">…</span>
          <input type={inputType} value={leaf.val[1] || ''} onChange={(e) => onChange({ ...leaf, val: [leaf.val[0] || '', e.target.value] })}
            placeholder="до" className="h-9 w-24 rounded-md border bg-background px-2 text-sm" />
        </div>
      ) : needsValue && useOptions ? (
        leaf.op === 'in' ? (
          <div className="flex flex-wrap gap-1">
            {attr!.options.map((o) => {
              const on = leaf.val.includes(o.value);
              return (
                <button key={o.value} type="button"
                  onClick={() => onChange({ ...leaf, val: on ? leaf.val.filter((x) => x !== o.value) : [...leaf.val, o.value] })}
                  className={`rounded border px-2 py-1 text-xs ${on ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}>
                  {o.label}
                </button>
              );
            })}
          </div>
        ) : (
          <Select value={leaf.val[0] || ''} onValueChange={(v) => onChange({ ...leaf, val: [v] })}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Значение" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {attr!.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      ) : needsValue ? (
        <input type={inputType} value={leaf.val[0] || ''} onChange={(e) => onChange({ ...leaf, val: [e.target.value] })}
          placeholder="значение" className="h-9 w-48 rounded-md border bg-background px-3 text-sm" />
      ) : null}

      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} aria-label="Удалить">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// --- рекурсивный редактор группы (И/ИЛИ + НЕ) ---
function GroupEditor({
  group,
  attrs,
  attrOptions,
  onChange,
  onRemove,
  depth,
}: {
  group: Group;
  attrs: ConditionAttribute[];
  attrOptions: { value: string; label: string }[];
  onChange: (next: Group) => void;
  onRemove?: () => void;
  depth: number;
}) {
  const setChild = (i: number, child: Leaf | Group) => onChange({ ...group, children: group.children.map((c, idx) => (idx === i ? child : c)) });
  const removeChild = (i: number) => onChange({ ...group, children: group.children.filter((_, idx) => idx !== i) });
  const addLeaf = () => onChange({ ...group, children: [...group.children, newLeaf(attrs)] });
  const addGroup = () => onChange({ ...group, children: [...group.children, emptyGroup()] });

  return (
    <div className={depth > 0 ? 'rounded-lg border bg-muted/20 p-2 space-y-1.5' : 'space-y-1.5'}>
      {(depth > 0 || group.children.length > 1 || group.negate) && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange({ ...group, negate: !group.negate })}
            className={`rounded border px-2 py-0.5 text-xs font-medium ${group.negate ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'hover:bg-accent'}`}>
            НЕ
          </button>
          {group.children.length > 1 && (
            <button type="button" onClick={() => onChange({ ...group, join: group.join === 'and' ? 'or' : 'and' })}
              className="rounded border px-2 py-0.5 text-xs font-medium hover:bg-accent">
              {group.join === 'and' ? 'И (все)' : 'ИЛИ (любое)'}
            </button>
          )}
          {onRemove && (
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-destructive" onClick={onRemove} aria-label="Удалить группу">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {group.children.map((child, i) => (
        <div key={i} className="space-y-1.5">
          {i > 0 && <div className="pl-1 text-[10px] font-medium uppercase text-muted-foreground">{group.join === 'and' ? 'И' : 'ИЛИ'}</div>}
          {child.kind === 'leaf' ? (
            <LeafRow leaf={child} attrOptions={attrOptions} onChange={(l) => setChild(i, l)} onRemove={() => removeChild(i)} />
          ) : (
            <GroupEditor group={child} attrs={attrs} attrOptions={attrOptions} onChange={(g) => setChild(i, g)} onRemove={() => removeChild(i)} depth={depth + 1} />
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addLeaf}><Plus className="mr-1 h-4 w-4" />Условие</Button>
        <Button variant="ghost" size="sm" onClick={addGroup}><FolderPlus className="mr-1 h-4 w-4" />Группа</Button>
      </div>
    </div>
  );
}

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: ConditionNode | null | undefined;
  onChange: (next: ConditionNode | null) => void;
}) {
  const attrs = useMemo(() => getConditionAttributes(), []);
  const attrOptions = useMemo(() => attrs.map((a) => ({ value: a.key, label: a.label })), [attrs]);
  const parsed = useMemo(() => parseTop(value), [value]);

  const [group, setGroup] = useState<Group>(parsed.group);
  const lastEmitted = useRef<ConditionNode | null | undefined>(value);
  useEffect(() => {
    if (JSON.stringify(value ?? null) !== JSON.stringify(lastEmitted.current ?? null)) {
      setGroup(parsed.group);
      lastEmitted.current = value;
    }
  }, [value, parsed]);

  const emit = (next: Group) => {
    setGroup(next);
    const built = buildGroup(next);
    lastEmitted.current = built;
    onChange(built);
  };

  // Непонятная (объектная contains / manual / незнакомая) форма — безопасный JSON-fallback.
  if (parsed.unknown) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <div className="text-muted-foreground">Особое условие (объектная форма / ручная проверка) — редактируется в JSON, чтобы не потерять логику.</div>
        <pre className="overflow-x-auto rounded bg-background p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>
        <Button variant="outline" size="sm" onClick={() => onChange(null)}>Сбросить в «Применяется всегда»</Button>
      </div>
    );
  }

  const built = buildGroup(group);
  const problems = validateCondition(built);
  const isEmpty = countLeaves(group) === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Условие применимости</span>
        {isEmpty && <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Применяется всегда</Badge>}
      </div>

      <GroupEditor group={group} attrs={attrs} attrOptions={attrOptions} onChange={emit} depth={0} />

      <div className="flex items-center gap-2">
        {!isEmpty && <Button variant="ghost" size="sm" onClick={() => emit(emptyGroup())}>Сделать «всегда»</Button>}
      </div>

      {problems.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
          {problems.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{p}</div>
          ))}
        </div>
      )}

      {!isEmpty && (
        <div className="rounded-lg border bg-muted/30 p-2 text-sm">
          <span className="text-xs text-muted-foreground">Превью: </span>
          {describeCondition(built)}
        </div>
      )}
    </div>
  );
}
