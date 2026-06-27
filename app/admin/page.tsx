import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { hasPermission } from '@/lib/auth/permissions';

// Редирект на первый доступный раздел админки по правам пользователя.
const ADMIN_SECTIONS: Array<{ href: string; perm: string }> = [
  { href: '/admin/document-types', perm: 'admin:document-types' },
  { href: '/admin/npa', perm: 'admin:npa' },
  { href: '/admin/fields', perm: 'admin:fields' },
  { href: '/admin/users', perm: 'admin:users' },
  { href: '/admin/roles', perm: 'admin:roles' },
];

export default async function AdminPage() {
  const h = await headers();
  const permsHeader = h.get('x-user-perms');
  const perms = permsHeader ? permsHeader.split(',').filter(Boolean) : null;
  // Старая сессия без прав или полный доступ → дефолтный раздел.
  if (!perms || perms.includes('*')) redirect('/admin/document-types');
  const target = ADMIN_SECTIONS.find((s) => hasPermission(perms, s.perm));
  redirect(target ? target.href : '/');
}
