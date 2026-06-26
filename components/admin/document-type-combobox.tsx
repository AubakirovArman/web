'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { DocumentType } from '@/lib/types';

/**
 * Поисковый выбор раздела типа документа по КОДУ (эксперт знает коды наизусть).
 * Построен на Popover + Input + ScrollArea (cmdk в проекте нет).
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
      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      <span className="mt-0.5 w-14 shrink-0 font-mono text-xs font-semibold">{doc.docCode || '—'}</span>
      <span className="flex-1 leading-snug">{doc.name}</span>
      {value === doc.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          {triggerLabel}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[28rem] p-0">
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Код или название раздела (напр. 1.1)"
            className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-1.5">
            {recent.length > 0 && (
              <>
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Уже привязаны в этом НПА
                </div>
                {recent.map((doc) => (
                  <Row key={`recent-${doc.id}`} doc={doc} />
                ))}
                <Separator className="my-1.5" />
              </>
            )}
            {filtered.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
            ) : (
              filtered.slice(0, 300).map((doc) => <Row key={doc.id} doc={doc} />)
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
