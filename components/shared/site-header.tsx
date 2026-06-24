'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FlaskConical, LogOut, Moon, Sun } from 'lucide-react';

const NAV: Array<{ href: string; label: string; roles: string[] }> = [
  { href: '/applicant', label: 'Заявитель', roles: ['applicant', 'admin', 'expert'] },
  { href: '/expert', label: 'Эксперт', roles: ['expert', 'admin'] },
  { href: '/reference', label: 'Справочник', roles: ['expert', 'admin'] },
  { href: '/chat', label: 'Чат', roles: ['applicant', 'expert', 'admin'] },
  { href: '/admin', label: 'Админ', roles: ['admin'] },
];

const roleLabels: Record<string, string> = { applicant: 'Заявитель', expert: 'Эксперт', admin: 'Администратор' };

export function SiteHeader() {
  const router = useRouter();
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

  const visibleNav = user ? NAV.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-5 w-5" />
          </div>
          <span>NDDA AI</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleNav.map((item) => (
            <Button key={item.href} variant="ghost" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name} · {roleLabels[user.role] || user.role}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Переключить тему"
          >
            {mounted && resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          {user && (
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Выйти">
              <LogOut className="mr-1 h-4 w-4" />
              Выйти
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
