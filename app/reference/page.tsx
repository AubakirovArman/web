'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, ArrowLeft, Brain, FileText, Search, Sparkles } from 'lucide-react';

type ExperimentStatus = 'processed' | 'pending' | 'error';

interface IntelligenceSummary {
  short: string;
  detailed: string;
  project_relevance: string;
  regulated_scope: string;
}

interface IntelligenceItem {
  [key: string]: unknown;
}

interface ReferenceExperimentSection {
  id: string;
  title: string;
  level: number;
  anchor: string;
  sectionType: string;
  headingNumber?: string;
  text: string;
  rawCharCount?: number;
}

interface ReferenceExperimentDocument {
  id: string;
  domain: 'LS' | 'MI';
  title: string;
  fileName: string;
  sourcePath?: string;
  kind: string;
  number?: string;
  date?: string;
  tags: string[];
  tokenEstimate: number;
  charCount: number;
  sectionsCount: number;
  status: ExperimentStatus;
  error?: string;
  processedAt?: string;
  promptVersion?: string;
  sections: ReferenceExperimentSection[];
  intelligence?: {
    summary: IntelligenceSummary;
    key_points: IntelligenceItem[];
    procedures: IntelligenceItem[];
    document_types: IntelligenceItem[];
    requirements: IntelligenceItem[];
    applicant_parameters: IntelligenceItem[];
    dependencies: IntelligenceItem[];
    checks: IntelligenceItem[];
    highlights: IntelligenceItem[];
    quality_notes: string[];
    meta?: Record<string, unknown>;
  };
}

interface ReferenceExperimentData {
  generatedAt: string;
  promptVersion: string;
  model: string | null;
  mode: string;
  processedCount: number;
  targetCount: number;
  sort: string;
  note: string;
  documents: ReferenceExperimentDocument[];
}

const statusLabels: Record<ExperimentStatus, string> = {
  processed: 'Обработан',
  pending: 'Ожидает Gemma',
  error: 'Ошибка',
};

const kindLabels: Record<string, string> = {
  order: 'Приказ',
  decision: 'Решение',
  agreement: 'Соглашение',
  code: 'Кодекс',
  form: 'Форма',
  classifier: 'Классификатор',
  dossier: 'Досье',
  other: 'Другое',
};

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
        setSelectedId(payload.documents.find((doc) => doc.status === 'processed')?.id || payload.documents[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить экспериментальный справочник'))
      .finally(() => setLoading(false));
  }, []);

  const documents = data?.documents || [];
  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;
    return documents.filter((doc) => {
      const corpus = [doc.title, doc.fileName, doc.number, doc.date, ...(doc.tags || []), doc.intelligence?.summary?.short]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return corpus.includes(normalized);
    });
  }, [documents, query]);

  const selectedDocument = documents.find((doc) => doc.id === selectedId) || filteredDocuments[0] || documents[0];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.16),transparent_34%),linear-gradient(180deg,#f8fafc,#e2e8f0)] py-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),linear-gradient(180deg,#020617,#0f172a)]">
        <div className="mx-auto max-w-[1500px] px-4">
          <FadeIn>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/85 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                  <Brain className="h-3.5 w-3.5" />
                  Reference Intelligence Experiment
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Умный справочник НПА</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                  Экспериментальная версия: старый справочник очищен из интерфейса. Сейчас показываются только НПА ядра MVP,
                  отсортированные от меньших к большим по оценке токенов. Gemma вытаскивает резюме, требования, параметры,
                  зависимости и подсветки для нашего приложения.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href="/admin">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    В админку
                  </Link>
                </Button>
              </div>
            </div>
          </FadeIn>

          {loading && <EmptyState title="Загружаю эксперимент" text="Читаю public/reference-intelligence/experiment.json" />}

          {error && (
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
          )}

          {data && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Документы ядра" value={String(data.targetCount)} />
                <Metric label="Обработано Gemma" value={`${data.processedCount}/${data.targetCount}`} />
                <Metric label="Модель" value={data.model || 'metadata'} />
                <Metric label="Сортировка" value="малые -> большие" />
              </div>

              <Card className="bg-background/90 shadow-sm backdrop-blur">
                <CardContent className="grid gap-3 py-4 xl:grid-cols-[24rem_1fr]">
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по НПА ядра MVP" className="pl-9" />
                    </div>
                    <DocumentList documents={filteredDocuments} selectedId={selectedDocument?.id || ''} onSelect={setSelectedId} />
                  </div>

                  {selectedDocument ? <DocumentDetail document={selectedDocument} /> : <EmptyState title="Документ не выбран" text="Выберите НПА из списка слева." />}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DocumentList({ documents, selectedId, onSelect }: { documents: ReferenceExperimentDocument[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-2">
      {documents.map((doc, index) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onSelect(doc.id)}
          className={`w-full rounded-xl border p-3 text-left transition ${selectedId === doc.id ? 'border-primary bg-primary/5 shadow-sm' : 'bg-background hover:border-primary/50 hover:bg-muted/30'}`}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">#{index + 1}</Badge>
            <Badge variant={doc.status === 'processed' ? 'default' : doc.status === 'error' ? 'destructive' : 'outline'}>{statusLabels[doc.status]}</Badge>
            <Badge variant="outline">~{doc.tokenEstimate.toLocaleString('ru-RU')} ток.</Badge>
          </div>
          <p className="line-clamp-2 text-sm font-semibold">{doc.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{kindLabels[doc.kind] || doc.kind} · {doc.number || 'без номера'} · {doc.sectionsCount} пунктов</p>
          {doc.intelligence?.summary?.short && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{doc.intelligence.summary.short}</p>}
        </button>
      ))}
    </div>
  );
}

function DocumentDetail({ document }: { document: ReferenceExperimentDocument }) {
  const intelligence = document.intelligence;
  const counts = {
    requirements: intelligence?.requirements?.length || 0,
    documentTypes: intelligence?.document_types?.length || 0,
    parameters: intelligence?.applicant_parameters?.length || 0,
    dependencies: intelligence?.dependencies?.length || 0,
  };

  return (
    <div className="min-w-0 space-y-4">
      <Card className="border-teal-200/70 bg-gradient-to-br from-background to-teal-50/40 dark:to-teal-950/20">
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{document.domain}</Badge>
                <Badge variant="outline">{kindLabels[document.kind] || document.kind}</Badge>
                <Badge variant="outline">{document.number || 'без номера'}</Badge>
                <Badge variant="outline">~{document.tokenEstimate.toLocaleString('ru-RU')} токенов</Badge>
              </div>
              <CardTitle className="text-xl leading-7">{document.title}</CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">{document.fileName}</p>
            </div>
            <Badge variant={document.status === 'processed' ? 'default' : document.status === 'error' ? 'destructive' : 'outline'}>
              {statusLabels[document.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {document.status === 'pending' && (
            <EmptyState title="Документ еще не обработан Gemma" text="Он уже включен в экспериментальный список. Запустите скрипт с большим --max-documents или --all." />
          )}
          {document.status === 'error' && <EmptyState title="Ошибка обработки" text={document.error || 'Gemma не вернула результат.'} />}
          {intelligence && (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Требования" value={String(counts.requirements)} />
                <Metric label="Типы документов" value={String(counts.documentTypes)} />
                <Metric label="Параметры" value={String(counts.parameters)} />
                <Metric label="Зависимости" value={String(counts.dependencies)} />
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-sm font-semibold">О чем документ</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{intelligence.summary.detailed || intelligence.summary.short}</p>
                {intelligence.summary.project_relevance && (
                  <p className="mt-3 text-sm leading-7"><span className="font-medium">Для проекта: </span>{intelligence.summary.project_relevance}</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {intelligence && (
        <Tabs defaultValue="requirements" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2">
            <TabsTrigger value="requirements">Требования</TabsTrigger>
            <TabsTrigger value="documents">Типы документов</TabsTrigger>
            <TabsTrigger value="parameters">Параметры</TabsTrigger>
            <TabsTrigger value="dependencies">Зависимости</TabsTrigger>
            <TabsTrigger value="checks">Проверки</TabsTrigger>
            <TabsTrigger value="text">Полный текст</TabsTrigger>
          </TabsList>

          <TabsContent value="requirements">
            <EntityList
              empty="Gemma не нашла требований к документам."
              items={intelligence.requirements}
              fields={[
                ['title', 'Требование'],
                ['requirement_text', 'Описание'],
                ['applies_to_document', 'Документ'],
                ['procedure', 'Процедура'],
                ['condition', 'Условие'],
                ['criticality', 'Критичность'],
                ['why_it_matters', 'Почему важно'],
                ['source_point', 'Пункт'],
              ]}
            />
          </TabsContent>
          <TabsContent value="documents">
            <EntityList
              empty="Gemma не нашла типы документов."
              items={intelligence.document_types}
              fields={[
                ['code', 'Код'],
                ['name', 'Тип документа'],
                ['mapped_guess', 'Похоже на наш тип'],
                ['procedure', 'Процедура'],
                ['requiredness', 'Обязательность'],
                ['condition', 'Условие'],
                ['why_needed', 'Зачем нужен'],
                ['source_point', 'Пункт'],
              ]}
            />
          </TabsContent>
          <TabsContent value="parameters">
            <EntityList
              empty="Gemma не нашла параметры заявки."
              items={intelligence.applicant_parameters}
              fields={[
                ['key', 'Ключ'],
                ['label', 'Параметр'],
                ['type', 'Тип'],
                ['options', 'Варианты'],
                ['why_needed', 'Зачем нужен'],
                ['source_point', 'Пункт'],
              ]}
            />
          </TabsContent>
          <TabsContent value="dependencies">
            <EntityList
              empty="Gemma не нашла зависимостей."
              items={intelligence.dependencies}
              fields={[
                ['condition_text', 'Если'],
                ['if_parameters', 'Параметры'],
                ['then_required_documents', 'Тогда документы'],
                ['then_checks', 'Тогда проверки'],
                ['explanation', 'Объяснение'],
                ['source_point', 'Пункт'],
              ]}
            />
          </TabsContent>
          <TabsContent value="checks">
            <EntityList
              empty="Gemma не нашла проверок."
              items={intelligence.checks}
              fields={[
                ['name', 'Проверка'],
                ['check_type', 'Тип'],
                ['target_document', 'Документ'],
                ['automation_hint', 'Как автоматизировать'],
                ['source_point', 'Пункт'],
              ]}
            />
          </TabsContent>
          <TabsContent value="text">
            <FullText document={document} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EntityList({ items, fields, empty }: { items: IntelligenceItem[]; fields: Array<[string, string]>; empty: string }) {
  if (!items.length) return <EmptyState title="Пусто" text={empty} />;
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <Card key={index} className="bg-background/90">
          <CardContent className="space-y-2 py-4 text-sm">
            {fields.map(([key, label]) => {
              const value = renderValue(item[key]);
              if (!value) return null;
              return (
                <p key={key} className="leading-7">
                  <span className="font-semibold">{label}: </span>
                  <span className="text-muted-foreground">{value}</span>
                </p>
              );
            })}
            {renderValue(item.quote) && (
              <blockquote className="mt-3 rounded-lg border-l-4 border-primary/50 bg-muted/40 p-3 text-sm leading-7 text-muted-foreground">
                {renderValue(item.quote)}
              </blockquote>
            )}
            {Array.isArray(item.keywords) && item.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(item.keywords as unknown[]).map((keyword) => <Badge key={String(keyword)} variant="outline">{String(keyword)}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FullText({ document }: { document: ReferenceExperimentDocument }) {
  const highlights = document.intelligence?.highlights || [];
  return (
    <div className="space-y-3">
      {document.sections.map((section) => {
        const related = findSectionHighlights(section, highlights);
        return (
          <Card key={section.id} id={section.anchor} className={related.length ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/10' : 'bg-background/90'}>
            <CardContent className="py-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{section.sectionType}</Badge>
                {section.headingNumber && <Badge variant="secondary">{section.headingNumber}</Badge>}
                {related.length > 0 && <Badge variant="default"><Sparkles className="mr-1 h-3 w-3" /> Gemma highlight</Badge>}
              </div>
              <h3 className="font-semibold leading-7">{section.title}</h3>
              {related.length > 0 && (
                <div className="my-3 space-y-2 rounded-lg border bg-background/80 p-3 text-sm">
                  {related.map((item, index) => (
                    <div key={index}>
                      <p className="font-medium">{renderValue(item.title) || renderValue(item.kind)}</p>
                      <p className="text-muted-foreground">{renderValue(item.importance) || renderValue(item.quote)}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{section.text}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function findSectionHighlights(section: ReferenceExperimentSection, highlights: IntelligenceItem[]) {
  return highlights.filter((highlight) => {
    const quote = renderValue(highlight.quote).toLowerCase();
    const sourcePoint = renderValue(highlight.source_point).toLowerCase();
    const sectionHint = renderValue(highlight.section_hint).toLowerCase();
    const haystack = [section.title, section.headingNumber, section.text].filter(Boolean).join(' ').toLowerCase();
    return Boolean(
      (quote && haystack.includes(quote.slice(0, Math.min(80, quote.length)))) ||
      (sourcePoint && haystack.includes(sourcePoint)) ||
      (sectionHint && haystack.includes(sectionHint)),
    );
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="bg-background/90">
      <CardContent className="flex gap-3 py-5 text-sm">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted-foreground">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(renderValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
