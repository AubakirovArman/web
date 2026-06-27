import { getRuntimePool, ensureRuntimeSchema } from '@/lib/db/runtime-postgres';
import { BUILTIN_ROLE_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/auth/permissions';

export interface AppRole {
  id: string;
  name: string;
  permissions: string[];
  builtin?: boolean;
  description?: string;
}

const ROLES_KEY = 'roles';

export const BUILTIN_ROLES: AppRole[] = [
  { id: 'admin', name: 'Администратор', permissions: ['*'], builtin: true, description: 'Полный доступ ко всему' },
  {
    id: 'expert',
    name: 'Эксперт',
    permissions: BUILTIN_ROLE_PERMISSIONS.expert,
    builtin: true,
    description: 'Экспертиза заявок, справочник, чат',
  },
  {
    id: 'applicant',
    name: 'Заявитель',
    permissions: BUILTIN_ROLE_PERMISSIONS.applicant,
    builtin: true,
    description: 'Подача и просмотр своих заявок',
  },
];

function sanitizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>([...ALL_PERMISSION_KEYS, '*', 'admin']);
  return Array.from(new Set(value.map((v) => String(v)).filter((v) => valid.has(v))));
}

function normalizeRole(value: unknown): AppRole | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<AppRole>;
  const id = String(r.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(r.name || id).trim() || id,
    permissions: r.permissions?.includes('*') ? ['*'] : sanitizePermissions(r.permissions),
    builtin: Boolean(r.builtin),
    description: r.description ? String(r.description) : undefined,
  };
}

/** Слить встроенные роли с сохранёнными (встроенные всегда присутствуют). */
function mergeWithBuiltins(stored: AppRole[]): AppRole[] {
  const byId = new Map<string, AppRole>();
  for (const b of BUILTIN_ROLES) byId.set(b.id, { ...b });
  for (const s of stored) {
    if (!s) continue;
    const builtin = BUILTIN_ROLES.find((b) => b.id === s.id);
    byId.set(s.id, { ...s, builtin: Boolean(builtin) });
  }
  // admin всегда полный доступ — не даём его «обрезать»
  const admin = byId.get('admin');
  if (admin) admin.permissions = ['*'];
  return Array.from(byId.values());
}

export async function readRoles(): Promise<AppRole[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query(`SELECT data FROM admin_runtime_config WHERE key = $1 LIMIT 1`, [ROLES_KEY]);
  const stored = Array.isArray(rows[0]?.data?.roles)
    ? (rows[0].data.roles.map(normalizeRole).filter(Boolean) as AppRole[])
    : [];
  return mergeWithBuiltins(stored);
}

export async function writeRoles(roles: AppRole[], userId = 'admin'): Promise<AppRole[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const merged = mergeWithBuiltins((roles.map(normalizeRole).filter(Boolean) as AppRole[]));
  await pool.query(
    `INSERT INTO admin_runtime_config (key, data, created_by_user_id, updated_by_user_id, updated_at)
     VALUES ($1, $2::jsonb, $3, $3, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
    [ROLES_KEY, JSON.stringify({ roles: merged }), userId],
  );
  return merged;
}

export async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const roles = await readRoles();
  const role = roles.find((r) => r.id === roleId);
  if (role) return role.permissions;
  return BUILTIN_ROLE_PERMISSIONS[roleId] || [];
}
