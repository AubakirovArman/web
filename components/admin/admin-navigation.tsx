'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ClipboardList, FileText, SlidersHorizontal } from 'lucide-react';

const adminNavItems = [
  { href: '/admin/document-types', label: 'Типы документов', icon: FileText },
  { href: '/admin/npa', label: 'НПА', icon: BookOpen },
  { href: '/admin/requirements', label: 'Требования', icon: ClipboardList },
  { href: '/admin/fields', label: 'Поля', icon: SlidersHorizontal },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 grid gap-2 md:grid-cols-4">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex min-h-11 items-center justify-center border px-3 py-2 text-sm font-medium transition-colors',
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
