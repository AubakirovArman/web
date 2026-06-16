'use client';

import { useEffect, useRef, useState } from 'react';
import { useApplications } from '@/lib/hooks/useApplications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function DemoPage() {
  const { importApplication } = useApplications();
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    fetch('/api/seed', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Seed failed');
        const data = await res.json();
        importApplication(data.app);
        window.location.href = `/expert/${data.app.id}`;
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      });
  }, [importApplication]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Генерация эталонной демо-заявки</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-muted-foreground">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Создаю реалистичную заявку ЛС/регистрация, прикладываю DOCX/PDF/XLSX и запускаю проверки…</span>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
