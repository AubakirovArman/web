'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CustomFieldDialog, type EditableCustomField } from '@/components/admin/custom-field-dialog';

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
  isCustom?: boolean;
  scopeObjectType?: 'LS' | 'MI' | 'both';
};

export default function AdminFieldsPage() {
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | FieldRow['usage']>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableCustomField | null>(null);
  const [customById, setCustomById] = useState<Record<string, EditableCustomField>>({});

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/fields', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить поля');
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      const map: Record<string, EditableCustomField> = {};
      for (const cf of payload.customFields || []) map[cf.id] = cf;
      setCustomById(map);
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

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (row: FieldRow) => { setEditing(customById[row.id] || { id: row.id, label: row.label, type: row.type }); setDialogOpen(true); };
  const deleteField = async (row: FieldRow) => {
    if (!window.confirm(`Удалить поле «${row.label}»? Условия, которые на него ссылаются, перестанут срабатывать.`)) return;
    try {
      const res = await fetch(`/api/admin/fields/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось удалить поле');
      toast.success('Поле удалено');
      loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить поле');
    }
  };

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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Поля заявки</CardTitle>
              <p className="text-sm text-muted-foreground">Базовые поля (ЛС/регистрация) — только чтение. Кастомные поля можно создавать, они сразу доступны в конструкторе условий.</p>
            </div>
            <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Новое поле</Button>
          </div>
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
                  <th className="border-b px-3 py-2 font-semibold text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index}>{Array.from({ length: 9 }).map((__, cell) => <td key={cell} className="border-b px-3 py-2"><div className="h-4 animate-pulse bg-muted" /></td>)}</tr>
                ))}
                {!loading && pageItems.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/30">
                    <td className="border-b px-3 py-2 font-mono text-xs">{row.id}</td>
                    <td className="border-b px-3 py-2 font-medium">
                      {row.label}
                      {row.isCustom && <Badge variant="outline" className="ml-2 border-primary/40 text-[10px] text-primary">кастом</Badge>}
                    </td>
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
                    <td className="border-b px-3 py-2 text-right">
                      {row.isCustom ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)} aria-label="Изменить поле"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteField(row)} aria-label="Удалить поле"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">базовое</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>Поля не найдены</td>
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

      <CustomFieldDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSaved={loadRows} />
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
