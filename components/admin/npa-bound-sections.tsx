'use client';

import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminNpaRecord } from '@/lib/admin/admin-page-types';
import type { DocumentType } from '@/lib/types';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { CheckProfileRequirementsEditor } from '@/components/admin/check-profile-requirements-editor';

/** Один привязанный раздел — деталь грузится лениво при раскрытии. */
function BoundSectionItem({
  id,
  doc,
  boundCount,
  onReload,
}: {
  id: string;
  doc?: DocumentType;
  boundCount: number;
  onReload?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<NewDossierDocumentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/document-types/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        setDetail(data.item || null);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    }
  };

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-accent/40"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Badge variant="outline" className="font-mono text-[11px] font-semibold">
          {doc?.docCode || id}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-medium">{doc?.name || id}</span>
        <Badge variant="secondary" className="shrink-0">
          {boundCount} из этого НПА
        </Badge>
      </button>
      {open && (
        <div className="border-t p-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка раздела…
            </div>
          ) : detail ? (
            <CheckProfileRequirementsEditor
              documentTypeId={id}
              initial={detail.checkProfileRequirements || []}
              onSaved={onReload}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Не удалось загрузить раздел.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Требования привязанных разделов типа документа — то, что реально проверяет Gemma.
 * Правки здесь пишутся в общий document_check_profile (тот же источник, что и в типе документа).
 * Каждый раздел грузится лениво при раскрытии (привязок может быть много).
 */
export function NpaBoundSections({
  record,
  documentTypes,
  onReload,
}: {
  record: AdminNpaRecord;
  documentTypes: DocumentType[];
  onReload?: () => void;
}) {
  const boundIds = Array.from(
    new Set(record.requirements.map((r) => r.targetDocumentTypeId).filter((v): v is string => Boolean(v))),
  );
  const [query, setQuery] = useState('');
  const docById = new Map(documentTypes.map((d) => [d.id, d]));

  if (boundIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Тексты требований привязанных разделов</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ни одно требование пока не привязано. Привяжите требования во вкладке «Привязка требований» — здесь
            появятся тексты разделов, которые проверяет Gemma.
          </p>
        </CardContent>
      </Card>
    );
  }

  const q = query.trim().toLowerCase();
  const items = boundIds
    .map((id) => ({ id, doc: docById.get(id), boundCount: record.requirements.filter((r) => r.targetDocumentTypeId === id).length }))
    .filter((it) => !q || (it.doc?.docCode || '').toLowerCase().includes(q) || (it.doc?.name || '').toLowerCase().includes(q))
    .sort((a, b) => (a.doc?.docCode || a.id).localeCompare(b.doc?.docCode || b.id, 'ru', { numeric: true }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Тексты требований привязанных разделов ({boundIds.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Это разделы, к которым привязаны требования НПА. Раскройте раздел, чтобы посмотреть/отредактировать
          тексты, которые проверяет Gemma. Правки = правки в типе документа (общий источник, текст типа документа — главный).
        </p>
        {boundIds.length > 6 && (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Фильтр по коду или названию раздела…"
            className="mt-2 h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => (
          <BoundSectionItem key={it.id} id={it.id} doc={it.doc} boundCount={it.boundCount} onReload={onReload} />
        ))}
      </CardContent>
    </Card>
  );
}
