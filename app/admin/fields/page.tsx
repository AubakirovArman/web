'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FieldRow = {
  id: string;
  label: string;
  type: string;
  section?: string;
  sourceFieldRef?: string;
  sourceNpa?: string;
  required: boolean;
  usage: 'condition_for_document_upload' | 'reference_or_validation' | 'core_route';
  usageLabel: string;
  optionsText: string;
  relatedDocuments: Array<{ code: string; name: string }>;
};

export default function AdminFieldsPage() {
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | FieldRow['usage']>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/fields', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить поля');
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (error) {
      setRows([]);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить поля');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => rows.filter((row) => {
    if (usageFilter !== 'all' && row.usage !== usageFilter) return false;
    if (!normalizedQuery) return true;
    return [row.id, row.label, row.type, row.section, row.sourceFieldRef, row.sourceNpa, row.optionsText, row.relatedDocuments.map((doc) => `${doc.code} ${doc.name}`).join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  }), [normalizedQuery, rows, usageFilter]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, usageFilter, pageSize]);

  const rangeText = loading
    ? 'Загрузка данных…'
    : total === 0
      ? 'Показано 0 из 0'
      : `Показано ${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, total)} из ${total}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Поля заявки: ЛС / регистрация</CardTitle>
          <p className="text-sm text-muted-foreground">Поля и связанные коды документов грузятся отдельным быстрым endpoint из Postgres.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{loading ? 'Загрузка полей' : `${rows.length} полей LS/registration`}</Badge>
            <Badge variant="outline">{rows.filter((row) => row.required).length} обязательных</Badge>
            <Badge variant="outline">{rows.filter((row) => row.usage === 'condition_for_document_upload').length} влияют на загрузку документов</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по переменной, названию, типу или значению" />
            <Select value={usageFilter} onValueChange={(value) => setUsageFilter(value as typeof usageFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все поля</SelectItem>
                <SelectItem value="condition_for_document_upload">Для условий документов</SelectItem>
                <SelectItem value="reference_or_validation">Для сверки</SelectItem>
                <SelectItem value="core_route">Маршрутизация</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="border-b px-3 py-2 font-semibold">Переменная</th>
                  <th className="border-b px-3 py-2 font-semibold">Название</th>
                  <th className="border-b px-3 py-2 font-semibold">Тип</th>
                  <th className="border-b px-3 py-2 font-semibold">Обяз.</th>
                  <th className="border-b px-3 py-2 font-semibold">Использование</th>
                  <th className="border-b px-3 py-2 font-semibold">Коды разделов</th>
                  <th className="border-b px-3 py-2 font-semibold">Значения</th>
                  <th className="border-b px-3 py-2 font-semibold">Раздел / источник</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index}>{Array.from({ length: 8 }).map((__, cell) => <td key={cell} className="border-b px-3 py-2"><div className="h-4 animate-pulse bg-muted" /></td>)}</tr>
                ))}
                {!loading && pageItems.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/30">
                    <td className="border-b px-3 py-2 font-mono text-xs">{row.id}</td>
                    <td className="border-b px-3 py-2 font-medium">{row.label}</td>
                    <td className="border-b px-3 py-2">{row.type}</td>
                    <td className="border-b px-3 py-2">{row.required ? 'Да' : 'Нет'}</td>
                    <td className="border-b px-3 py-2">{row.usageLabel}</td>
                    <td className="max-w-[360px] border-b px-3 py-2 text-xs">
                      {row.relatedDocuments.length ? (
                        <div className="flex flex-wrap gap-1">
                          {uniqueRelatedDocuments(row.relatedDocuments).slice(0, 12).map((doc) => (
                            <span key={`${doc.code}-${doc.name}`} title={doc.name} className="border bg-background px-1.5 py-0.5">
                              {doc.code}
                            </span>
                          ))}
                          {uniqueRelatedDocuments(row.relatedDocuments).length > 12 && (
                            <span className="text-muted-foreground">+{uniqueRelatedDocuments(row.relatedDocuments).length - 12}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[520px] border-b px-3 py-2 text-xs text-muted-foreground">{row.optionsText}</td>
                    <td className="border-b px-3 py-2 text-xs text-muted-foreground">
                      {[row.section, row.sourceFieldRef, row.sourceNpa].filter(Boolean).join(' / ') || 'Не указано'}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>Поля не найдены</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 border bg-card px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground">{rangeText}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 на странице</SelectItem>
              <SelectItem value="50">50 на странице</SelectItem>
              <SelectItem value="100">100 на странице</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={loading || safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Назад
          </Button>
          <span className="min-w-20 text-center text-muted-foreground">
            {safePage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || safePage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Далее
          </Button>
        </div>
      </div>
    </div>
  );
}

function uniqueRelatedDocuments(items: Array<{ code: string; name: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}:${item.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
