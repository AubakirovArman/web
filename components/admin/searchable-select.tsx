'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Одиночный поисковый select на Popover+Input. В отличие от Radix Select, НЕ рендерит все
 * опции сразу (только отфильтрованные, с лимитом) — быстро даже при сотнях вариантов.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Выбрать…',
  className,
  limit = 60,
}: {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : options;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={`h-9 justify-between font-normal ${className || 'w-56'}`}>
          <span className="truncate text-left">{value ? labelOf.get(value) || value : <span className="text-muted-foreground">{placeholder}</span>}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск…"
            className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
            ) : (
              filtered.slice(0, limit).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${value === o.value ? 'bg-accent/60 font-medium' : ''}`}
                >
                  {o.label}
                </button>
              ))
            )}
            {filtered.length > limit && (
              <div className="px-2 py-1 text-center text-[11px] text-muted-foreground">Показаны первые {limit} — уточните поиск</div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
