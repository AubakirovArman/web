'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Brain, Search } from 'lucide-react';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DocumentDetail } from '@/components/reference/reference-document-detail';
import { ReferenceDocumentTable } from '@/components/reference/reference-document-table';
import { EmptyState, Metric } from '@/components/reference/reference-common';
import type { ReferenceExperimentData } from '@/components/reference/reference-types';

export default function ReferencePage() {
  const [data, setData] = useState<ReferenceExperimentData | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/reference-intelligence/experiment.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Экспериментальный справочник еще не сгенерирован');
        return response.json() as Promise<ReferenceExperimentData>;
      })
      .then((payload) => {
        setData(payload);
        setSelectedId('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить экспериментальный справочник'))
      .finally(() => setLoading(false));
  }, []);

  const documents = data?.documents || [];
  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;
    return documents.filter((doc) => [doc.title, doc.fileName, doc.number, doc.date, ...(doc.tags || []), doc.intelligence?.summary?.short].filter(Boolean).join(' ').toLowerCase().includes(normalized));
  }, [documents, query]);

  const selectedDocument = selectedId ? documents.find((doc) => doc.id === selectedId) || null : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.16),transparent_34%),linear-gradient(180deg,#f8fafc,#e2e8f0)] py-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),linear-gradient(180deg,#020617,#0f172a)]">
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4">
          <FadeIn>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/85 px-3 py-1 text-xs text-muted-foreground shadow-sm"><Brain className="h-3.5 w-3.5" />Reference Intelligence Experiment</div>
                <h1 className="text-3xl font-bold tracking-tight">Умный справочник НПА</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">Экспериментальная версия: НПА ядра MVP отсортированы от меньших к большим по оценке токенов. Gemma вытаскивает резюме, требования, параметры, зависимости и подсветки для приложения.</p>
              </div>
              <Button variant="outline" asChild><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />В админку</Link></Button>
            </div>
          </FadeIn>

          {loading && <EmptyState title="Загружаю эксперимент" text="Читаю public/reference-intelligence/experiment.json" />}
          {error && <ReferenceErrorCard error={error} />}

          {data && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4"><Metric label="Документы ядра" value={String(data.targetCount)} /><Metric label="Обработано Gemma" value={`${data.processedCount}/${data.targetCount}`} /><Metric label="Модель" value={data.model || 'metadata'} /><Metric label="Сортировка" value="малые -> большие" /></div>
              <Card className="bg-background/90 shadow-sm backdrop-blur">
                <CardContent className="space-y-4 py-4">
                  <div className="relative max-w-2xl"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по НПА ядра MVP" className="pl-9" /></div>
                  {selectedDocument ? <DocumentDetail document={selectedDocument} onBack={() => setSelectedId('')} /> : <ReferenceDocumentTable documents={filteredDocuments} onSelect={setSelectedId} />}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ReferenceErrorCard({ error }: { error: string }) {
  return (
    <Card className="border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
      <CardContent className="flex gap-3 py-4 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div><p className="font-medium">Нет данных эксперимента</p><p>{error}</p><p className="mt-2 font-mono text-xs">npm run reference:intelligence:experiment</p></div>
      </CardContent>
    </Card>
  );
}
