import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { AdminNavigation } from '@/components/admin/admin-navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4">
          <FadeIn>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Панель администратора</h1>
                <p className="text-sm text-muted-foreground">Справочники администрирования разнесены по отдельным страницам.</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  На главную
                </Link>
              </Button>
            </div>
          </FadeIn>

          <AdminNavigation />
          {children}
        </div>
      </main>
    </div>
  );
}
