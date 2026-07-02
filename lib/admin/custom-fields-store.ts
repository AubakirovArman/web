import { getRuntimePool, ensureRuntimeSchema, normalizeRuntimeUserId } from '@/lib/db/runtime-postgres';
import { parameters as seedParameters } from '@/lib/data/seed';
import type { Parameter } from '@/lib/types';

/**
 * Кастомные поля заявки, заведённые администратором через UI (self-service).
 * Хранятся в runtime_dictionaries (key='custom-parameters'), мёржатся поверх
 * статических seed-параметров. Не могут переопределять seed-поля (защита ядра).
 */
const KEY = 'custom-parameters';

export type ParameterType = Parameter['type'];
export interface CustomParameter extends Parameter {
  custom: true;
  /** В каком мастере показывать поле. */
  scopeObjectType: 'LS' | 'MI' | 'both';
}

const VALID_TYPES: ParameterType[] = ['select', 'text', 'textarea', 'date', 'multiselect', 'boolean', 'number'];
const seedIds = new Set(seedParameters.map((p) => p.id));

/** id поля — ASCII, с префиксом param-. */
function slugifyFieldId(input: string): string {
  const TRANSLIT: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const base = String(input || '')
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const cleaned = base || `field-${Date.now().toString(36)}`;
  return cleaned.startsWith('param-') ? cleaned : `param-${cleaned}`;
}

function normalizeOptions(value: unknown): { value: string; label: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const v = String((o as any).value ?? '').trim();
      if (!v) return null;
      return { value: v, label: String((o as any).label ?? '').trim() || v };
    })
    .filter((x): x is { value: string; label: string } => x !== null);
  return out.length ? out : undefined;
}

function normalizeCustomParameter(input: unknown): CustomParameter | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  const id = String(p.id || '').trim();
  if (!id) return null;
  const type = VALID_TYPES.includes(p.type as ParameterType) ? (p.type as ParameterType) : 'text';
  const scope = p.scopeObjectType === 'MI' || p.scopeObjectType === 'both' ? p.scopeObjectType : 'LS';
  return {
    id,
    label: String(p.label || id).trim() || id,
    type,
    options: type === 'select' || type === 'multiselect' ? normalizeOptions(p.options) : undefined,
    section: p.section ? String(p.section) : 'Дополнительные поля',
    sourceNpa: p.sourceNpa ? String(p.sourceNpa) : undefined,
    sourceFieldRef: p.sourceFieldRef ? String(p.sourceFieldRef) : undefined,
    custom: true,
    scopeObjectType: scope as 'LS' | 'MI' | 'both',
  };
}

export async function readCustomParameters(): Promise<CustomParameter[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query(`SELECT data FROM runtime_dictionaries WHERE key = $1 LIMIT 1`, [KEY]);
  const list = Array.isArray(rows[0]?.data?.parameters) ? rows[0].data.parameters : [];
  return list.map(normalizeCustomParameter).filter((x: CustomParameter | null): x is CustomParameter => x !== null);
}

async function writeCustomParameters(list: CustomParameter[], userId: string): Promise<CustomParameter[]> {
  const pool = getRuntimePool();
  await pool.query(
    `INSERT INTO runtime_dictionaries (key, data, source, created_by_user_id, updated_by_user_id, updated_at)
     VALUES ($1, $2::jsonb, 'admin', $3, $3, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
    [KEY, JSON.stringify({ parameters: list }), normalizeRuntimeUserId(userId)],
  );
  return list;
}

/** Создать/обновить кастомное поле. Возвращает {error} при конфликте с seed или дубле id. */
export async function upsertCustomParameter(
  input: Partial<CustomParameter> & { id?: string; label: string },
  userId = 'system',
): Promise<{ parameter?: CustomParameter; error?: string }> {
  const existing = await readCustomParameters();
  const isUpdate = Boolean(input.id && existing.some((p) => p.id === input.id));
  const id = isUpdate ? String(input.id) : slugifyFieldId(input.id || input.label || '');

  if (!isUpdate) {
    if (seedIds.has(id)) return { error: `Поле «${id}» уже есть в системе (базовое) — выберите другое название` };
    if (existing.some((p) => p.id === id)) return { error: `Поле «${id}» уже существует` };
  }
  const normalized = normalizeCustomParameter({ ...input, id });
  if (!normalized) return { error: 'Некорректные данные поля' };
  if ((normalized.type === 'select' || normalized.type === 'multiselect') && !normalized.options?.length) {
    return { error: 'Для поля-списка укажите хотя бы одно значение' };
  }

  const next = isUpdate ? existing.map((p) => (p.id === id ? normalized : p)) : [...existing, normalized];
  await writeCustomParameters(next, userId);
  return { parameter: normalized };
}

export async function deleteCustomParameter(id: string, userId = 'system'): Promise<boolean> {
  const existing = await readCustomParameters();
  if (!existing.some((p) => p.id === id)) return false;
  await writeCustomParameters(existing.filter((p) => p.id !== id), userId);
  return true;
}
