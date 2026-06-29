'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface MultiOption {
  value: string;
  label: string;
}

/**
 * Мультиселект с человеческими метками: показывает выбранное чипами (label),
 * хранит массив id. Добавление — через поиск по названию (не ввод id).
 */
export function LabeledMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Добавить…',
  emptyText = 'Ничего не выбрано',
}: {
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const selected = value || [];
  const q = query.trim().toLowerCase();
  const available = options.filter(
    (o) => !selected.includes(o.value) && (!q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)),
  );

  const add = (v: string) => {
    onChange([...selected, v]);
    setQuery('');
  };
  const remove = (v: string) => onChange(selected.filter((x) => x !== v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 && <span className="text-xs text-muted-foreground">{emptyText}</span>}
        {selected.map((v) => {
          const known = labelOf.has(v);
          return (
            <span
              key={v}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${known ? '' : 'border-amber-500/40 text-amber-700 dark:text-amber-400'}`}
              title={known ? v : `Неизвестный id: ${v}`}
            >
              {labelOf.get(v) || v}
              <button type="button" onClick={() => remove(v)} className="text-muted-foreground hover:text-destructive" aria-label="Убрать">
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> {placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="flex items-center gap-2 border-b px-2.5 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию…"
                className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {available.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
                ) : (
                  available.slice(0, 300).map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => add(o.value)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {o.label}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">{o.value}</span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
