'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { DocumentType } from '@/lib/types';

/**
 * Выбор раздела типа документа по КОДУ (эксперт знает коды наизусть).
 * Модальное окно с крупным поиском и прокручиваемым списком — не вылезает за экран.
 */
export function DocumentTypeCombobox({
  documentTypes,
  value,
  recentIds = [],
  triggerLabel,
  onSelect,
}: {
  documentTypes: DocumentType[];
  value?: string;
  /** Коды/ids разделов, уже привязанных в этом НПА — показываются вверху. */
  recentIds?: string[];
  triggerLabel: string;
  onSelect: (documentTypeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const pool = useMemo(
    () =>
      documentTypes
        .filter((doc) => doc.direction === 'LS' || doc.direction === 'MI' || doc.direction === 'both')
        .slice()
        .sort((a, b) => (a.docCode || a.id).localeCompare(b.docCode || b.id, 'ru', { numeric: true })),
    [documentTypes],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? pool.filter(
            (doc) => (doc.docCode || '').toLowerCase().includes(q) || doc.name.toLowerCase().includes(q),
          )
        : pool,
    [pool, q],
  );

  const recent = useMemo(
    () => (q ? [] : pool.filter((doc) => recentIds.includes(doc.id))),
    [pool, recentIds, q],
  );

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  const Row = ({ doc }: { doc: DocumentType }) => (
    <button
      type="button"
      onClick={() => choose(doc.id)}
      className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
    >
      <span className="mt-0.5 w-16 shrink-0 font-mono text-xs font-semibold">{doc.docCode || '—'}</span>
      <span className="flex-1 leading-snug">{doc.name}</span>
      {value === doc.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">Выбрать раздел типа документа</DialogTitle>
          <div className="mt-2 flex items-center gap-2 rounded-md border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Код или название раздела (напр. 1.1)"
              className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {recent.length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Уже привязаны в этом НПА
              </div>
              {recent.map((doc) => (
                <Row key={`recent-${doc.id}`} doc={doc} />
              ))}
              <Separator className="my-2" />
            </>
          )}
          {filtered.length === 0 ? (
            <div className="px-2 py-10 text-center text-sm text-muted-foreground">
              Ничего не найдено по запросу «{query}»
            </div>
          ) : (
            <>
              {filtered.slice(0, 400).map((doc) => (
                <Row key={doc.id} doc={doc} />
              ))}
              {filtered.length > 400 && (
                <div className="px-2 py-2 text-center text-xs text-muted-foreground">
                  Показаны первые 400 — уточните запрос
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
