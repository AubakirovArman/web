'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { ReferenceDocument, ReferenceDocumentKind, ReferenceSearchItem, ReferenceSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, ArrowLeft, BookOpen, Database, FileSearch, Search } from 'lucide-react';

const kindLabels: Record<ReferenceDocumentKind, string> = {
  order: 'Приказ',
  decision: 'Решение',
  agreement: 'Соглашение',
  code: 'Кодекс',
  form: 'Форма',
  classifier: 'Классификатор',
  dossier: 'Досье',
  other: 'Другое',
};

const navigationTypes = new Set(['heading', 'chapter', 'appendix', 'point', 'subpoint']);

interface ReferenceApiResult {
  documents: ReferenceDocument[];
  searchItems: ReferenceSearchItem[];
  stats: {
    documentsCount: number;
    sectionsCount: number;
    databaseUrl: string;
  };
}

interface ReferenceDetailResult {
  document: ReferenceDocument;
  markdown: string;
}

export default function ReferencePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Загрузка справочника...</div>}>
      <ReferencePageInner />
    </Suspense>
  );
}

function ReferencePageInner() {
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState<'all' | 'LS' | 'MI'>((searchParams.get('domain') as 'LS' | 'MI') || 'all');
  const [kind, setKind] = useState<'all' | ReferenceDocumentKind>('all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedId, setSelectedId] = useState(searchParams.get('doc') || '');
  const [data, setData] = useState<ReferenceApiResult | null>(null);
  const [detailDocument, setDetailDocument] = useState<ReferenceDocument | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoadingList(true);
      setError(null);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (domain !== 'all') params.set('domain', domain);
      if (kind !== 'all') params.set('kind', kind);

      fetch(`/api/reference?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.hint ? `${payload.error}. ${payload.hint}` : payload.error);
          return payload as ReferenceApiResult;
        })
        .then((payload) => {
          setData(payload);
          if (!selectedId && payload.documents[0]) setSelectedId(payload.documents[0].id);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setError(err.message || 'Reference database is unavailable');
        })
        .finally(() => setLoadingList(false));
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [domain, kind, query, selectedId]);

  const selectedDocument = useMemo(() => {
    const documents = data?.documents || [];
    return documents.find((doc) => doc.id === selectedId) || documents[0];
  }, [data, selectedId]);

  useEffect(() => {
    if (!selectedDocument) return;

    setSelectedId(selectedDocument.id);
    setLoadingDoc(true);
    fetch(`/api/reference/${encodeURIComponent(selectedDocument.id)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.hint ? `${payload.error}. ${payload.hint}` : payload.error);
        return payload as ReferenceDetailResult;
      })
      .then((payload) => setDetailDocument(payload.document))
      .catch((err) => {
        setDetailDocument(null);
        setError(err.message || 'Не удалось загрузить документ из БД.');
      })
      .finally(() => setLoadingDoc(false));
  }, [selectedDocument]);

  const documents = data?.documents || [];
  const searchItems = data?.searchItems || [];
  const displayDocument = detailDocument?.id === selectedDocument?.id ? detailDocument : selectedDocument;
  const sections = displayDocument?.sections || [];
  const navSections = sections.filter((section) => navigationTypes.has(section.sectionType || '') || section.level <= 2);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_36%),linear-gradient(180deg,#f8fafc,rgba(226,232,240,0.7))] py-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),linear-gradient(180deg,#020617,#0f172a)]">
        <div className="mx-auto max-w-[1800px] px-2 sm:px-4 2xl:px-6">
          <FadeIn>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/85 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                  <Database className="h-3.5 w-3.5" />
                  {data?.stats.databaseUrl || 'Postgres reference DB'}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Справочник НПА: пилот DOCX</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Первый этап: очищенный справочник с одним структурно распарсенным документом. Навигация строится по
                  главам, пунктам и подпунктам из Word-документа, без искусственных фрагментов.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  В админку
                </Link>
              </Button>
            </div>
          </FadeIn>

          {error && (
            <Card className="mb-6 border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              <CardContent className="flex gap-3 py-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">База справочника недоступна</p>
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-[330px_1fr] 2xl:grid-cols-[360px_1fr]">
            <aside className="space-y-4">
              <Card className="border-teal-200/70 bg-background/90 shadow-sm backdrop-blur dark:border-teal-900/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Search className="h-4 w-4" />
                    Поиск по документу
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    data-testid="reference-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Например: ОХЛП, внесение изменений, листок-вкладыш"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'LS', 'MI'] as const).map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={domain === value ? 'default' : 'outline'}
                        onClick={() => setDomain(value)}
                      >
                        {value === 'all' ? 'Все' : value === 'LS' ? 'ЛС' : 'МИ'}
                      </Button>
                    ))}
                  </div>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as 'all' | ReferenceDocumentKind)}
                    aria-label="Тип документа"
                  >
                    <option value="all">Все типы документов</option>
                    {Object.entries(kindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <Stat label="Документы" value={data?.stats.documentsCount || 0} />
                    <Stat label="Узлы" value={data?.stats.sectionsCount || 0} />
                    <Stat label="Найдено" value={documents.length} />
                  </div>
                </CardContent>
              </Card>

              {searchItems.length > 0 && (
                <Card className="bg-background/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Совпадения ({searchItems.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 pr-3">
                      <div className="space-y-2">
                        {searchItems.map((item) => (
                          <button
                            key={`${item.documentId}-${item.sectionId}`}
                            className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                            onClick={() => {
                              setSelectedId(item.documentId);
                              setTimeout(() => jumpToSection(item.anchor), 250);
                            }}
                          >
                            <p className="font-medium">{item.sectionTitle || item.title}</p>
                            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                              <Highlighted text={item.text} query={query} />
                            </p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-background/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Документы {loadingList ? '...' : ''}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[28rem] pr-3">
                    <div className="space-y-2">
                      {documents.map((refDoc) => (
                        <button
                          key={refDoc.id}
                          data-testid={`reference-doc-${refDoc.id}`}
                          onClick={() => setSelectedId(refDoc.id)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            selectedDocument?.id === refDoc.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-medium">{refDoc.title}</p>
                            <Badge variant="outline">{refDoc.domain === 'LS' ? 'ЛС' : refDoc.domain}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{kindLabels[refDoc.kind] || refDoc.kind}</Badge>
                            {refDoc.number && <Badge variant="outline">№ {refDoc.number}</Badge>}
                            {refDoc.date && <Badge variant="outline">{refDoc.date}</Badge>}
                          </div>
                          {refDoc.sections[0]?.text && (
                            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{refDoc.sections[0].text}</p>
                          )}
                        </button>
                      ))}
                      {!documents.length && (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Справочник очищен или документ пока не загружен.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </aside>

            <section className="min-w-0">
              {displayDocument ? (
                <Card className="min-h-[44rem] overflow-hidden bg-background/95 shadow-sm backdrop-blur">
                  <CardHeader className="border-b">
                    <div>
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge>{displayDocument.domain === 'LS' ? 'ЛС' : displayDocument.domain}</Badge>
                          <Badge variant="secondary">{kindLabels[displayDocument.kind] || displayDocument.kind}</Badge>
                          {displayDocument.number && <Badge variant="outline">№ {displayDocument.number}</Badge>}
                          {displayDocument.date && <Badge variant="outline">{displayDocument.date}</Badge>}
                          <Badge variant="outline">{sections.length} узлов</Badge>
                        </div>
                        <CardTitle className="text-xl leading-snug">{displayDocument.title}</CardTitle>
                        <p className="mt-2 text-xs text-muted-foreground">{displayDocument.fileName}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border-b bg-muted/35 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {displayDocument.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {loadingDoc ? (
                      <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                        <FileSearch className="h-4 w-4 animate-pulse" />
                        Загрузка структурированного документа...
                      </div>
                    ) : (
                      <div className="grid min-h-[34rem] xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
                        <DocumentNavigation sections={navSections} query={query} />
                        <div
                          id="reference-document-scroll"
                          className="h-[calc(100vh-18rem)] min-h-[34rem] overflow-y-auto scroll-smooth"
                        >
                          <StructuredDocumentViewer sections={sections} query={query} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center gap-3 py-16 text-muted-foreground">
                    <BookOpen className="h-6 w-6" />
                    Выберите документ
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/35 p-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

function DocumentNavigation({ sections, query }: { sections: ReferenceSection[]; query: string }) {
  return (
    <aside className="border-b bg-muted/20 p-3 xl:border-b-0 xl:border-r">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Навигация</p>
        <Badge variant="outline">{sections.length}</Badge>
      </div>
      <div className="max-h-72 overflow-y-auto pr-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-22rem)]">
        <div className="space-y-1 pr-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => jumpToSection(section.anchor)}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-primary/10 ${
                section.sectionType === 'subpoint' ? 'pl-5' : section.sectionType === 'point' ? 'pl-3' : 'font-medium'
              }`}
            >
              <span className="mr-1 text-muted-foreground">{section.headingNumber}</span>
              <Highlighted text={compactTitle(section.title)} query={query} />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function StructuredDocumentViewer({ sections, query }: { sections: ReferenceSection[]; query: string }) {
  return (
    <article className="space-y-4 p-4 text-sm leading-7 sm:p-6 2xl:p-8">
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.anchor}
          className={`scroll-mt-6 rounded-2xl border bg-background p-4 shadow-sm ${sectionClassName(section)}`}
        >
          <div className="mb-3 flex flex-wrap items-start gap-2">
            {section.headingNumber && <Badge variant="outline">{section.headingNumber}</Badge>}
            <Badge variant="secondary">{sectionTypeLabel(section.sectionType)}</Badge>
            {section.formatter === 'gemma' && <Badge>Gemma</Badge>}
          </div>
          <h2 className={headingClassName(section)}>
            <Highlighted text={section.title} query={query} />
          </h2>
          <SectionBody section={section} query={query} />
        </section>
      ))}
    </article>
  );
}

function SectionBody({ section, query }: { section: ReferenceSection; query: string }) {
  const lines = cleanupDisplayText(section.text).split('\n').map((line) => line.trim()).filter(Boolean);
  const isListItem = section.sectionType === 'list_item';

  return (
    <div className="mt-3 space-y-2 text-foreground/90">
      {lines.map((line, index) =>
        isListItem ? (
          <p key={index} className="flex gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>
              <Highlighted text={line} query={query} />
            </span>
          </p>
        ) : (
          <p key={index}>
            <Highlighted text={line} query={query} />
          </p>
        )
      )}
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const tokens = normalize(query).split(' ').filter((token) => token.length >= 2).slice(0, 5);
  if (!tokens.length) return <>{text}</>;
  const regex = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
  return (
    <>
      {text.split(regex).map((part, index) =>
        tokens.includes(normalize(part)) ? (
          <mark key={index} className="rounded bg-amber-200 px-0.5 text-amber-950">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function jumpToSection(anchor?: string) {
  if (!anchor) return;
  const target = window.document.getElementById(anchor);
  const container = window.document.getElementById('reference-document-scroll');
  if (!target || !container) return;

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  container.scrollTo({
    top: container.scrollTop + targetRect.top - containerRect.top - 16,
    behavior: 'smooth',
  });
}

function compactTitle(value: string) {
  const clean = cleanupDisplayText(value).replace(/\s+/g, ' ').trim();
  return clean.length > 92 ? `${clean.slice(0, 89)}...` : clean;
}

function cleanupDisplayText(value: string) {
  return value
    .replace(/\\([().\-[\]])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sectionTypeLabel(value?: string) {
  const labels: Record<string, string> = {
    heading: 'заголовок',
    chapter: 'глава',
    appendix: 'приложение',
    point: 'пункт',
    subpoint: 'подпункт',
    list_item: 'перечень',
    preamble: 'преамбула',
    approval: 'гриф',
  };
  return labels[value || ''] || value || 'раздел';
}

function sectionClassName(section: ReferenceSection) {
  if (section.sectionType === 'heading' || section.sectionType === 'chapter') return 'border-teal-300 bg-teal-50/50 dark:bg-teal-950/20';
  if (section.sectionType === 'appendix') return 'border-sky-300 bg-sky-50/50 dark:bg-sky-950/20';
  if (section.sectionType === 'list_item') return 'ml-0 lg:ml-8';
  if (section.sectionType === 'subpoint') return 'ml-0 lg:ml-4';
  return '';
}

function headingClassName(section: ReferenceSection) {
  if (section.sectionType === 'heading' || section.sectionType === 'chapter') return 'text-xl font-bold tracking-tight';
  if (section.sectionType === 'appendix') return 'text-lg font-semibold';
  return 'text-base font-semibold';
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\w\u0400-\u04ff\d]+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
