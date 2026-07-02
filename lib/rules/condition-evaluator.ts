import type { ConditionNode } from '@/lib/types';

/**
 * Единый исполнитель предикатов обязательности документов (DSL из condition_json
 * НПА-правил). Используется и резолвером (/check, сервер), и движком правил
 * (getRequiredDocuments — wizard/runPreCheck), чтобы заявитель и эксперт видели
 * ОДИНАКОВЫЙ список обязательных документов.
 *
 * DSL: all/any/not (узлы) · eq/neq/in/contains/not_empty/empty (листья) · manual.
 * Поддержаны алиасы полей (param-manufacturer.country → param-manufacturer-country),
 * dotted-paths и нормализация значений (procedure/object-type/dossier-type/
 * product-type/страна, булевы синонимы да/нет/yes/no).
 */

type ConditionValues = Record<string, unknown>;

export function evaluateCondition(condition: unknown, values: ConditionValues): boolean {
  if (!condition || typeof condition !== 'object') return true;
  if (Array.isArray(condition)) return condition.every((item) => evaluateCondition(item, values));

  const node = condition as Record<string, unknown>;
  if (Array.isArray(node.all)) return node.all.every((item) => evaluateCondition(item, values));
  if (Array.isArray(node.any)) return node.any.some((item) => evaluateCondition(item, values));
  if (Array.isArray(node.not)) return !node.not.some((item) => evaluateCondition(item, values));
  if ('eq' in node) return compareBinary(node.eq, values, (actual, expected, paramId) => equalsValue(actual, expected, paramId));
  if ('neq' in node) return compareBinary(node.neq, values, (actual, expected, paramId) => hasValue(actual) && hasValue(expected) && !equalsValue(actual, expected, paramId));
  if ('in' in node) return compareBinary(node.in, values, (actual, expected, paramId) => valueIn(actual, expected, paramId));
  if ('gt' in node) return compareBinary(node.gt, values, (actual, expected) => orderCompare(actual, expected, (c) => c > 0));
  if ('lt' in node) return compareBinary(node.lt, values, (actual, expected) => orderCompare(actual, expected, (c) => c < 0));
  if ('gte' in node) return compareBinary(node.gte, values, (actual, expected) => orderCompare(actual, expected, (c) => c >= 0));
  if ('lte' in node) return compareBinary(node.lte, values, (actual, expected) => orderCompare(actual, expected, (c) => c <= 0));
  if ('between' in node) return compareBetween(node.between, values);
  if ('contains' in node) return compareContains(node.contains, values);
  if ('not_empty' in node) return compareUnary(node.not_empty, values, (actual) => hasValue(actual));
  if ('empty' in node) return compareUnary(node.empty, values, (actual) => !hasValue(actual));
  if ('manual' in node) return true;

  return false;
}

/** Распознаётся ли объект как узел condition_json (есть ли исполняемый предикат). */
export function hasCondition(node: unknown): node is ConditionNode {
  if (!node || typeof node !== 'object') return false;
  const keys = ['all', 'any', 'not', 'eq', 'neq', 'in', 'gt', 'lt', 'gte', 'lte', 'between', 'contains', 'not_empty', 'empty', 'manual'];
  return keys.some((key) => key in (node as Record<string, unknown>));
}

/**
 * Извлекает компактный предикат из сырого condition_json, отбрасывая служебную
 * метаинформацию (checker_routing, summary, rule_id, scope и т.п.) и сохраняя
 * логическое дерево как есть.
 */
export function pickConditionPredicate(json: unknown): ConditionNode | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const obj = json as Record<string, unknown>;
  if (Array.isArray(obj.all)) return { all: obj.all as ConditionNode[] };
  if (Array.isArray(obj.any)) return { any: obj.any as ConditionNode[] };
  if (Array.isArray(obj.not)) return { not: obj.not } as unknown as ConditionNode;
  for (const key of ['eq', 'neq', 'in', 'gt', 'lt', 'gte', 'lte', 'between', 'contains', 'not_empty', 'empty', 'manual'] as const) {
    if (key in obj) return { [key]: obj[key] } as ConditionNode;
  }
  return undefined;
}

function compareContains(expression: unknown, values: ConditionValues) {
  if (Array.isArray(expression)) {
    return compareBinary(expression, values, (actual, expected, paramId) => containsValue(actual, expected, paramId));
  }

  if (!expression || typeof expression !== 'object') return false;
  const source = expression as Record<string, unknown>;
  const paramId = String(source.param || '');
  const actual = getParamValue(paramId, values);
  if (!hasValue(actual)) return false;

  if (!source.where || typeof source.where !== 'object') return hasValue(actual);
  const where = source.where as Record<string, unknown>;
  const field = String(where.field || '');
  const expected = 'eq' in where ? where.eq : where.value;
  const items = normalizeCollectionValue(actual);
  return items.some((item) => {
    if (!item || typeof item !== 'object') return false;
    return equalsValue((item as Record<string, unknown>)[field], expected, paramId);
  });
}

function normalizeCollectionValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') return [value];
  return [];
}

function compareUnary(expression: unknown, values: ConditionValues, predicate: (actual: unknown) => boolean) {
  const [paramId] = Array.isArray(expression) ? expression : [expression];
  return predicate(getParamValue(String(paramId || ''), values));
}

function compareBinary(
  expression: unknown,
  values: ConditionValues,
  predicate: (actual: unknown, expected: unknown, paramId: string) => boolean,
) {
  if (!Array.isArray(expression) || expression.length < 2) return false;
  const paramId = String(expression[0] || '');
  const actual = getParamValue(paramId, values);
  const expected = resolveOperand(expression[1], values);
  return predicate(actual, expected, paramId);
}

function resolveOperand(operand: unknown, values: ConditionValues): unknown {
  if (typeof operand === 'string' && operand.startsWith('param-')) {
    return getParamValue(operand, values);
  }
  return operand;
}

function getParamValue(paramId: string, values: ConditionValues): unknown {
  const aliases: Record<string, string[]> = {
    'param-applicant': ['param-applicant-name'],
    'param-manufacturer': ['param-manufacturer-name'],
    'param-manufacturer.country': ['param-manufacturer-country'],
    'param-payment-request': ['param-application-payment'],
    'param-dosage-form.category': ['param-dosage-form'],
  };

  const direct = values[paramId];
  if (hasValue(direct)) return direct;

  for (const alias of aliases[paramId] || []) {
    const aliased = values[alias];
    if (hasValue(aliased)) return aliased;
  }

  if (paramId.includes('.')) {
    const [root, ...path] = paramId.split('.');
    let current = values[root] as unknown;
    for (const segment of path) {
      if (!current || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  return direct;
}

function equalsValue(actual: unknown, expected: unknown, paramId: string): boolean {
  if (Array.isArray(actual)) return actual.some((item) => equalsValue(item, expected, paramId));
  if (Array.isArray(expected)) return expected.some((item) => equalsValue(actual, item, paramId));
  return normalizeComparable(actual, paramId) === normalizeComparable(expected, paramId);
}

function valueIn(actual: unknown, expected: unknown, paramId: string): boolean {
  const expectedItems = Array.isArray(expected) ? expected : [expected];
  return expectedItems.some((item) => equalsValue(actual, item, paramId));
}

/**
 * Порядковое сравнение (числа → даты → строки). Возвращает -1/0/1 или null,
 * если значения несравнимы (одно из них пустое). test получает знак сравнения.
 */
function orderCompare(actual: unknown, expected: unknown, test: (sign: number) => boolean): boolean {
  if (!hasValue(actual) || !hasValue(expected)) return false;
  const sign = compareOrder(actual, expected);
  return sign === null ? false : test(sign);
}

function compareOrder(a: unknown, b: unknown): number | null {
  const na = toNumberOrNull(a);
  const nb = toNumberOrNull(b);
  if (na !== null && nb !== null) return na < nb ? -1 : na > nb ? 1 : 0;
  const ta = toTimeOrNull(a);
  const tb = toTimeOrNull(b);
  if (ta !== null && tb !== null) return ta < tb ? -1 : ta > tb ? 1 : 0;
  const sa = String(a ?? '').trim().toLowerCase();
  const sb = String(b ?? '').trim().toLowerCase();
  if (!sa || !sb) return null;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').replace(',', '.').trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toTimeOrNull(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!/\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}/.test(text)) return null;
  const t = Date.parse(text);
  return Number.isNaN(t) ? null : t;
}

function compareBetween(expression: unknown, values: ConditionValues): boolean {
  if (!Array.isArray(expression) || expression.length < 2) return false;
  const paramId = String(expression[0] || '');
  const bounds = expression[1];
  if (!Array.isArray(bounds) || bounds.length < 2) return false;
  const actual = getParamValue(paramId, values);
  if (!hasValue(actual)) return false;
  const lo = resolveOperand(bounds[0], values);
  const hi = resolveOperand(bounds[1], values);
  const lowSign = compareOrder(actual, lo);
  const highSign = compareOrder(actual, hi);
  return lowSign !== null && highSign !== null && lowSign >= 0 && highSign <= 0;
}

function containsValue(actual: unknown, expected: unknown, paramId: string): boolean {
  if (Array.isArray(actual)) return actual.some((item) => equalsValue(item, expected, paramId));
  const actualText = String(normalizeComparable(actual, paramId) || '');
  const expectedText = String(normalizeComparable(expected, paramId) || '');
  return Boolean(actualText && expectedText && actualText.includes(expectedText));
}

function normalizeComparable(value: unknown, paramId: string): unknown {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim();
  if (!text) return '';

  const lower = text.toLowerCase();
  if (['true', 'yes', 'да', '1'].includes(lower)) return true;
  if (['false', 'no', 'нет', '0'].includes(lower)) return false;

  if (paramId === 'param-object-type') return text.toUpperCase();
  if (paramId === 'param-procedure') {
    if (['регистрация', 'registration'].includes(lower)) return 'registration';
    if (['перерегистрация', 're-registration', 'reregistration'].includes(lower)) return 're-registration';
    if (['внесение изменений', 'variation'].includes(lower)) return 'variation';
  }
  if (paramId === 'param-dossier-type') {
    if (lower === 'ctd') return 'ctd';
    if (['ctd_foreign', 'foreign', 'иностранное', 'зарубежное'].includes(lower)) return 'ctd_foreign';
    if (['domestic', 'domestic_kz', 'kz', 'казахстан', 'отечественное'].includes(lower)) return 'domestic_kz';
  }
  if (paramId === 'param-manufacturer.country' || paramId === 'param-manufacturer-country') {
    if (['kz', 'kazakhstan', 'казахстан', 'республика казахстан'].includes(lower)) return 'KZ';
    return text.toUpperCase();
  }
  if (paramId === 'param-product-type') {
    if (['biosimilar', 'bioanalog', 'биоаналог', 'биоподобный'].includes(lower)) return 'bioanalog';
    if (['generic', 'generics', 'воспроизведенный', 'генерик'].includes(lower)) return 'generic';
  }

  return lower;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => hasValue(item));
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
