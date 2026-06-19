'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { ReferenceExperimentData, ReferenceExperimentDocument } from '@/components/reference/reference-types';

type ListMeta = Omit<ReferenceExperimentData, 'documents'> & {
  documents: Omit<ReferenceExperimentDocument, 'sections' | 'intelligence'>[];
};

export default function ReferencePage() {
  const [meta, setMeta] = useState<Omit<ListMeta, 'documents'> | null>(null);
  const [listDocs, setListDocs] = useState<Omit<ReferenceExperimentDocument, 'sections' | 'intelligence'>[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<ReferenceExperimentDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<'all' | 'LS' | 'MI'>('all');

  // Debounce search input — avoid hammering the API on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  // Load document list (lightweight — no sections/intelligence)
  useEffect(() => {
    let cancelled = false;
    const loadList = async () => {
      setLoading(true);
      setError(null);
      const url = debouncedQuery.trim()
        ? `/api/reference-experiment?q=${encodeURIComponent(debouncedQuery.trim())}`
        : '/api/reference-experiment';
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Экспериментальный справочник еще не сгенерирован');
        }
        const payload = (await response.json()) as ListMeta;
        if (cancelled) return;
        const { documents, ...rest } = payload;
        setMeta(rest);
        setListDocs(documents);
        setSelectedId('');
        setSelectedDoc(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить справочник');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadList();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Load full document detail on selection
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedDoc(null);
    setDetailLoading(true);
    fetch(`/api/reference-experiment/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((doc) => { if (doc) setSelectedDoc(doc as ReferenceExperimentDocument); })
      .catch(() => undefined)
      .finally(() => setDetailLoading(false));
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId('');
    setSelectedDoc(null);
  }, []);

  // For the table we still need `ReferenceExperimentDocument` shape — cast is safe since table only reads list fields
  const tableDocuments = useMemo(() => {
    const filtered = domainFilter === 'all' ? listDocs : listDocs.filter((doc) => doc.domain === domainFilter);
    return filtered as unknown as ReferenceExperimentDocument[];
  }, [listDocs, domainFilter]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.16),transparent_34%),linear-gradient(180deg,#f8fafc,#e2e8f0)] py-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),linear-gradient(180deg,#020617,#0f172a)]">
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4">
          <FadeIn>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/85 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                  <Brain className="h-3.5 w-3.5" />
                  Reference Intelligence Experiment
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Умный справочник НПА</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                  Экспериментальная версия: НПА ядра MVP отсортированы от меньших к большим по оценке токенов.
                  Автоматический анализ извлекает резюме, требования, параметры, зависимости и подсветки для приложения.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" />В админку
                </Link>
              </Button>
            </div>
          </FadeIn>

          {loading && <EmptyState title="Загружаю список НПА" text="Читаю /api/reference-experiment (список без секций)" />}
          {error && <ReferenceErrorCard error={error} />}

          {!loading && !error && meta && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Документы ядра" value={String(meta.targetCount)} />
                <Metric label="Обработано автоматически" value={`${meta.processedCount}/${meta.targetCount}`} />
                <Metric label="Модель" value={meta.model || 'metadata'} />
                <Metric label="Сортировка" value="малые → большие" />
              </div>
              <Card className="bg-background/90 shadow-sm backdrop-blur">
                <CardContent className="space-y-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-2xl">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(event) => handleQueryChange(event.target.value)}
                        placeholder="Поиск по НПА ядра MVP"
                        className="pl-9"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {([
                        ['all', 'Все'],
                        ['LS', 'ЛС'],
                        ['MI', 'МИ'],
                      ] as const).map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={domainFilter === value ? 'default' : 'outline'}
                          onClick={() => setDomainFilter(value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {selectedId ? (
                    detailLoading ? (
                      <EmptyState title="Загружаю документ" text="Читаю секции и данные анализа..." />
                    ) : selectedDoc ? (
                      <DocumentDetail document={selectedDoc} onBack={handleBack} />
                    ) : (
                      <EmptyState title="Документ не найден" text="" />
                    )
                  ) : (
                    <ReferenceDocumentTable documents={tableDocuments} onSelect={handleSelect} />
                  )}
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
        <div>
          <p className="font-medium">Нет данных эксперимента</p>
          <p>{error}</p>
          <p className="mt-2 font-mono text-xs">npm run reference:intelligence:experiment</p>
        </div>
      </CardContent>
    </Card>
  );
}
