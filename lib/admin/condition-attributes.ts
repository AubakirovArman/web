import { parameters } from '@/lib/data/seed';
import type { Parameter } from '@/lib/types';

/**
 * Value-aware каталог атрибутов для конструктора условий.
 * Гарантирует контракт: attr — только реальный param-id (ключ Application.values),
 * val — только из options[].value параметра, операторы — допустимые для типа поля.
 * Это устраняет класс «молча-ложных» условий (рассинхрон attr/val).
 */

export type ConditionOp = 'eq' | 'neq' | 'in' | 'contains' | 'not_empty' | 'empty';

export interface ConditionAttribute {
  key: string;
  label: string;
  type: Parameter['type'];
  options: { value: string; label: string }[];
  operators: ConditionOp[];
  /** boolean-поле — в UI показываем переключатель да/нет, val = 'yes'/'no'. */
  boolean: boolean;
}

export const OP_LABELS: Record<ConditionOp, string> = {
  eq: 'равно',
  neq: 'не равно',
  in: 'одно из',
  contains: 'содержит',
  not_empty: 'заполнено',
  empty: 'не заполнено',
};

function operatorsForType(type: Parameter['type']): ConditionOp[] {
  switch (type) {
    case 'boolean':
      return ['eq'];
    case 'select':
    case 'date':
      return ['eq', 'neq', 'in', 'not_empty', 'empty'];
    case 'multiselect':
      // массив хранится JSON-строкой → eq/in по нему молча ложны; безопасно только contains/наличие
      return ['contains', 'not_empty', 'empty'];
    case 'number':
      return ['eq', 'neq', 'not_empty', 'empty'];
    case 'text':
    case 'textarea':
    default:
      return ['eq', 'neq', 'contains', 'not_empty', 'empty'];
  }
}

/** Дедуплицированный реестр параметров (приоритет — определение с options). */
function dedupedParameters(): Parameter[] {
  const byId = new Map<string, Parameter>();
  for (const p of parameters) {
    if (!p?.id) continue;
    const prev = byId.get(p.id);
    if (!prev) byId.set(p.id, p);
    // если уже есть, но без options, а новый — с options, заменить
    else if ((!prev.options || prev.options.length === 0) && p.options && p.options.length) byId.set(p.id, p);
  }
  return Array.from(byId.values());
}

export function getConditionAttributes(): ConditionAttribute[] {
  return dedupedParameters()
    .filter((p) => p.type !== 'textarea') // длинный свободный текст не годится для условий
    .map((p) => ({
      key: p.id,
      label: p.label || p.id,
      type: p.type,
      options:
        p.type === 'boolean'
          ? [
              { value: 'yes', label: 'Да' },
              { value: 'no', label: 'Нет' },
            ]
          : p.options || [],
      operators: operatorsForType(p.type),
      boolean: p.type === 'boolean',
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

const ATTR_INDEX = new Map(getConditionAttributes().map((a) => [a.key, a]));

export function getConditionAttribute(key: string): ConditionAttribute | undefined {
  return ATTR_INDEX.get(key);
}

/** Человекочитаемое превью условия («Тип ЛС равно Генерик И …»). */
export function describeCondition(node: unknown): string {
  if (!node || typeof node !== 'object') return 'Применяется всегда';
  const n = node as Record<string, any>;
  const join = (items: any[], sep: string) => items.map(describeCondition).filter(Boolean).join(sep);
  if (Array.isArray(n.all)) return join(n.all, ' И ');
  if (Array.isArray(n.any)) return '(' + join(n.any, ' ИЛИ ') + ')';
  if (Array.isArray(n.not)) return 'НЕ (' + join(n.not, ' И ') + ')';
  const leafOps: ConditionOp[] = ['eq', 'neq', 'in', 'contains', 'not_empty', 'empty'];
  for (const op of leafOps) {
    if (op in n) {
      const expr = n[op];
      const attrKey = Array.isArray(expr) ? expr[0] : expr?.param;
      const attr = getConditionAttribute(attrKey);
      const label = attr?.label || attrKey;
      if (op === 'not_empty') return `${label} заполнено`;
      if (op === 'empty') return `${label} не заполнено`;
      const raw = Array.isArray(expr) ? expr[1] : '';
      const valText = Array.isArray(raw)
        ? raw.map((v) => attr?.options.find((o) => o.value === v)?.label || v).join(', ')
        : attr?.options.find((o) => o.value === raw)?.label || String(raw);
      return `${label} ${OP_LABELS[op]} ${valText}`;
    }
  }
  if ('manual' in n) return 'Вручную';
  return '';
}

/** Валидация предиката: attr ∈ реестр, val ∈ options (для select). Возвращает список проблем. */
export function validateCondition(node: unknown): string[] {
  const problems: string[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    for (const k of ['all', 'any', 'not'] as const) if (Array.isArray(n[k])) n[k].forEach(walk);
    for (const op of ['eq', 'neq', 'in', 'contains', 'not_empty', 'empty'] as const) {
      if (op in n) {
        const expr = n[op];
        const attrKey = Array.isArray(expr) ? expr[0] : expr?.param;
        const attr = getConditionAttribute(attrKey);
        if (!attr) {
          problems.push(`Неизвестный атрибут: ${attrKey}`);
          continue;
        }
        if ((op === 'eq' || op === 'neq') && attr.options.length && !attr.boolean) {
          const v = Array.isArray(expr) ? expr[1] : '';
          if (v && !attr.options.some((o) => o.value === v)) problems.push(`Значение «${v}» вне списка для «${attr.label}»`);
        }
      }
    }
  };
  walk(node);
  return problems;
}
