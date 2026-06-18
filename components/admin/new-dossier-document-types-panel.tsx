'use client';

import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { NewDossierDocumentTypeDetail } from '@/components/admin/new-dossier-document-type-detail';
import { NewDossierDocumentTypesTable } from '@/components/admin/new-dossier-document-types-table';

export function NewDossierDocumentTypesPanel({
  items,
  onChange,
  onReset,
  onCreate,
  onEdit,
}: {
  items: NewDossierDocumentType[];
  onChange: (items: NewDossierDocumentType[]) => void;
  onReset: () => void;
  onCreate: () => void;
  onEdit: (item: NewDossierDocumentType) => void;
}) {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'appendix-2' | 'appendix-3'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const normalizedQuery = query.trim().toLowerCase();
  const documentItems = items.filter((item) => item.kind === 'document');
  const hiddenServiceRows = items.length - documentItems.length;
  const filtered = items.filter((item) => {
    if (item.kind !== 'document') return false;
    if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
    if (!normalizedQuery) return true;
    return [item.code, item.name, item.description, item.group, item.sourceName]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const deleteItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success('Тип документа удален');
  };

  if (selectedItem) {
    return (
      <NewDossierDocumentTypeDetail
        item={selectedItem}
        onBack={() => setSelectedId(null)}
        onEdit={() => onEdit(selectedItem)}
        onDelete={() => deleteItem(selectedItem.id)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-base">Типы документов</CardTitle>
              <p className="text-sm text-muted-foreground">
                Перечень типов документов для загрузки в заявке. Служебные секции и исключенные строки скрыты, чтобы таблица отражала только реальные upload-слоты.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Сбросить
              </Button>
              <Button onClick={onCreate} className="bg-emerald-700 hover:bg-emerald-800">
                <Plus className="mr-2 h-4 w-4" />
                Новый тип документа
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{documentItems.length} типов документов</Badge>
            <Badge variant="outline">Приложение 2: {documentItems.filter((item) => item.source === 'appendix-2').length}</Badge>
            <Badge variant="outline">Приложение 3: {documentItems.filter((item) => item.source === 'appendix-3').length}</Badge>
            {hiddenServiceRows > 0 && <Badge variant="outline">{hiddenServiceRows} служебных строк скрыто</Badge>}
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
        items={filtered}
        onOpen={(item) => setSelectedId(item.id)}
        onDelete={deleteItem}
      />
    </div>
  );
}

