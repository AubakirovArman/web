'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { NewDossierDocumentTypesTable } from '@/components/admin/new-dossier-document-types-table';
import { NewDossierDocumentTypeEditorDialog } from '@/components/admin/new-dossier-document-type-editor-dialog';

function blankDocumentType(): NewDossierDocumentType {
  return {
    id: '',
    source: 'appendix-3',
    sourceName: 'Ручное добавление',
    group: '',
    groupCode: '',
    module: '',
    code: '',
    name: '',
    description: '',
    kind: 'document',
    direction: 'LS',
    acceptedFormats: ['pdf'],
    active: true,
    sortOrder: 0,
    checkProfileRequirements: [],
  };
}

export default function AdminDocumentTypesPage() {
  const router = useRouter();
  const [items, setItems] = useState<NewDossierDocumentType[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'appendix-2' | 'appendix-3'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const search = new URLSearchParams({
        page: String(safePage),
        pageSize: String(pageSize),
        query,
        source: sourceFilter,
      });
      const response = await fetch(`/api/admin/document-types?${search.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить типы документов');
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total) || 0);
    } catch (error) {
      setItems([]);
      setTotal(0);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить типы документов');
    } finally {
      setLoading(false);
    }
  }, [pageSize, query, safePage, sourceFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    setPage(1);
  }, [query, sourceFilter, pageSize]);

  const rangeText = useMemo(() => {
    if (loading) return 'Загрузка данных...';
    if (total === 0) return 'Показано 0 из 0';
    return `Показано ${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, total)} из ${total}`;
  }, [loading, pageSize, safePage, total]);

  const deleteItem = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/document-types/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось удалить тип документа');
      toast.success('Тип документа удален');
      loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить тип документа');
    }
  };

  const createState = useMemo(
    () => (createOpen ? { mode: 'create' as const, values: blankDocumentType() } : null),
    [createOpen],
  );
  const sectionOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.group).filter(Boolean))),
    [items],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-base">Типы документов</CardTitle>
              <p className="text-sm text-muted-foreground">
                Список грузится постранично из Postgres. Полные требования открываются только в карточке конкретного типа документа.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadItems} disabled={loading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Обновить
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Новый тип документа
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{loading ? 'Загрузка типов документов' : `${total} типов документов`}</Badge>
            <Badge variant="outline">Источник: Postgres</Badge>
            <Badge variant="outline">Постранично: {pageSize}</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по коду, названию или разделу досье" />
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все структуры</SelectItem>
                <SelectItem value="appendix-2">Приложение 2</SelectItem>
                <SelectItem value="appendix-3">Приложение 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <NewDossierDocumentTypesTable
        items={items}
        loading={loading}
        onOpen={(item) => router.push(`/admin/document-types/${encodeURIComponent(item.id)}`)}
        onDelete={deleteItem}
      />

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
          <Button variant="outline" size="sm" disabled={loading || safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
            Далее
          </Button>
        </div>
      </div>

      <NewDossierDocumentTypeEditorDialog
        state={createState}
        sections={sectionOptions}
        onClose={() => setCreateOpen(false)}
        onSave={async (next) => {
          try {
            const response = await fetch('/api/admin/document-types', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ item: next }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Не удалось создать тип документа');
            setCreateOpen(false);
            toast.success('Тип документа создан — добавьте требования в карточке');
            if (payload.item?.id) router.push(`/admin/document-types/${encodeURIComponent(payload.item.id)}`);
            else loadItems();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Не удалось создать тип документа');
          }
        }}
      />
    </div>
  );
}
