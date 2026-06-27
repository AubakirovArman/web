// Каталог прав доступа и сопоставление путь → требуемое право.
// Edge-safe (чистые функции, без Node/БД) — импортируется в middleware.

export interface PermissionDef {
  key: string;
  label: string;
  group: 'Разделы' | 'Админка';
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'applicant', label: 'Мои заявки', group: 'Разделы' },
  { key: 'wizard', label: 'Создать заявку', group: 'Разделы' },
  { key: 'expert', label: 'Кабинет эксперта', group: 'Разделы' },
  { key: 'reference', label: 'Справочник', group: 'Разделы' },
  { key: 'chat', label: 'Чат', group: 'Разделы' },
  { key: 'admin:document-types', label: 'Типы документов', group: 'Админка' },
  { key: 'admin:npa', label: 'НПА', group: 'Админка' },
  { key: 'admin:fields', label: 'Поля', group: 'Админка' },
  { key: 'admin:users', label: 'Пользователи', group: 'Админка' },
  { key: 'admin:roles', label: 'Роли', group: 'Админка' },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** Префикс пути → требуемое право. Специфичные префиксы ПЕРЕД зонтичными. */
const GATES: Array<{ prefix: string; perm: string }> = [
  { prefix: '/admin/document-types', perm: 'admin:document-types' },
  { prefix: '/api/admin/document-types', perm: 'admin:document-types' },
  { prefix: '/admin/npa', perm: 'admin:npa' },
  { prefix: '/api/admin/npa', perm: 'admin:npa' }, // покрывает и /api/admin/npa-gemma-preview
  { prefix: '/admin/requirements', perm: 'admin:npa' },
  { prefix: '/api/admin/requirements', perm: 'admin:npa' },
  { prefix: '/admin/fields', perm: 'admin:fields' },
  { prefix: '/api/admin/fields', perm: 'admin:fields' },
  { prefix: '/admin/users', perm: 'admin:users' },
  { prefix: '/api/admin/users', perm: 'admin:users' },
  { prefix: '/admin/roles', perm: 'admin:roles' },
  { prefix: '/api/admin/roles', perm: 'admin:roles' },
  // зонтичные admin (общие ресурсы) — ПОСЛЕ специфичных
  { prefix: '/api/admin/config', perm: 'admin' },
  { prefix: '/api/seed', perm: 'admin' },
  { prefix: '/admin', perm: 'admin' },
  { prefix: '/api/admin', perm: 'admin' },
  // разделы
  { prefix: '/expert', perm: 'expert' },
  { prefix: '/reference', perm: 'reference' },
  { prefix: '/api/reference', perm: 'reference' },
  { prefix: '/wizard', perm: 'wizard' },
  { prefix: '/applicant', perm: 'applicant' },
  { prefix: '/chat', perm: 'chat' },
  { prefix: '/api/chat', perm: 'chat' },
];

export function requiredPermissionFor(pathname: string): string | null {
  for (const gate of GATES) {
    if (pathname === gate.prefix || pathname.startsWith(gate.prefix + '/') || pathname.startsWith(gate.prefix)) {
      return gate.perm;
    }
  }
  return null;
}

/** Есть ли у набора прав требуемое право. '*' = всё; 'admin' (зонтик) — если есть любое admin:*. */
export function hasPermission(perms: string[] | undefined | null, required: string): boolean {
  if (!perms || perms.length === 0) return false;
  if (perms.includes('*')) return true;
  if (perms.includes(required)) return true;
  if (required === 'admin') return perms.some((p) => p === 'admin' || p.startsWith('admin:'));
  return false;
}

/** Права встроенных ролей (если в конфиге роль не найдена). */
export const BUILTIN_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  expert: ['expert', 'reference', 'applicant', 'wizard', 'chat'],
  applicant: ['applicant', 'wizard', 'chat'],
  system: ['*'],
};

/** Старые ролевые гейты — fallback для сессий без зашитых прав (до перелогина). */
export const LEGACY_ROLE_GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/api/admin', roles: ['admin'] },
  { prefix: '/api/seed', roles: ['admin'] },
  { prefix: '/expert', roles: ['expert', 'admin'] },
  { prefix: '/reference', roles: ['expert', 'admin'] },
  { prefix: '/api/reference', roles: ['expert', 'admin'] },
  { prefix: '/applicant', roles: ['applicant', 'admin', 'expert'] },
  { prefix: '/wizard', roles: ['applicant', 'admin', 'expert'] },
];
