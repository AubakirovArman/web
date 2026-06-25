'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ClipboardList,
  FilePlus2,
  FlaskConical,
  LogOut,
  MessageSquare,
  Microscope,
  Moon,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: typeof ClipboardList; roles: string[] };

const NAV_GROUPS: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Работа',
    items: [
      { href: '/applicant', label: 'Мои заявки', icon: ClipboardList, roles: ['applicant', 'admin', 'expert'] },
      { href: '/wizard', label: 'Создать заявку', icon: FilePlus2, roles: ['applicant', 'admin', 'expert'] },
      { href: '/expert', label: 'Эксперт', icon: Microscope, roles: ['expert', 'admin'] },
      { href: '/reference', label: 'Справочник', icon: BookOpen, roles: ['expert', 'admin'] },
      { href: '/chat', label: 'Чат', icon: MessageSquare, roles: ['applicant', 'expert', 'admin'] },
    ],
  },
  {
    group: 'Система',
    items: [{ href: '/admin', label: 'Админ', icon: SlidersHorizontal, roles: ['admin'] }],
  },
];

const roleLabels: Record<string, string> = { applicant: 'Заявитель', expert: 'Эксперт', admin: 'Администратор' };

/**
 * Боковая навигация приложения (рабочая консоль).
 * Имя SiteHeader сохранено для обратной совместимости со всеми страницами.
 */
export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ role: string; name: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => undefined);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-56 shrink-0 flex-col self-start border-r bg-background md:flex">
      <Link href="/" className="flex items-center gap-2 border-b px-4 py-3 text-base font-semibold tracking-tight">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FlaskConical className="h-4 w-4" />
        </div>
        <span>
          NDDA <span className="text-primary">AI</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {NAV_GROUPS.map((group) => {
          const items = user ? group.items.filter((item) => item.roles.includes(user.role)) : [];
          if (items.length === 0) return null;
          return (
            <div key={group.group} className="mb-1">
              <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-2">
        {user && (
          <div className="flex items-center gap-2 px-1 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {(user.name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{roleLabels[user.role] || user.role}</div>
            </div>
          </div>
        )}
        <div className="mt-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 flex-1 justify-start px-2 text-muted-foreground"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && resolvedTheme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Тема
          </Button>
          {user && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} aria-label="Выйти">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
