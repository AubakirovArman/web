'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, FileText, ShieldCheck, ShieldQuestion, SlidersHorizontal, Users } from 'lucide-react';
import { hasPermission } from '@/lib/auth/permissions';

const adminNavItems = [
  { href: '/admin/document-types', label: 'Типы документов', icon: FileText, perm: 'admin:document-types' },
  { href: '/admin/npa', label: 'НПА', icon: BookOpen, perm: 'admin:npa' },
  { href: '/admin/fields', label: 'Поля', icon: SlidersHorizontal, perm: 'admin:fields' },
  { href: '/admin/users', label: 'Пользователи', icon: Users, perm: 'admin:users' },
  { href: '/admin/roles', label: 'Роли', icon: ShieldCheck, perm: 'admin:roles' },
  { href: '/admin/tests', label: 'Тесты', icon: ShieldQuestion, perm: 'admin:tests' },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const [perms, setPerms] = useState<string[] | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPerms(d.user?.perms ?? null))
      .catch(() => setPerms(null));
  }, []);

  // Пока права не загружены или их нет (старая сессия) — показываем всё.
  const visible = adminNavItems.filter((item) => perms == null || hasPermission(perms, item.perm));

  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {visible.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex min-h-11 flex-1 basis-[160px] items-center justify-center border px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            ].join(' ')}
          >
            <Icon className="mr-2 h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
