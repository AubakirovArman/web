'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DocumentType } from '@/lib/types';
import type { AdminNpaRecord } from '@/lib/admin/admin-page-types';
import { formatFileSize } from '@/lib/admin/npa-logic';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';
import { NpaRequirementsTable } from '@/components/admin/npa-requirements-table';

export function NpaRegistryPanel({
  records,
  documentTypes,
  selectedId,
  onSelect,
  onBack,
  onAdd,
  loading = false,
}: {
  records: AdminNpaRecord[];
  documentTypes: DocumentType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onAdd: () => void;
  loading?: boolean;
}) {
  const selected = selectedId ? records.find((record) => record.id === selectedId) : null;
  if (selected) {
    return <NpaRegistryDetail record={selected} documentTypes={documentTypes} onBack={onBack} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="text-base">НПА и требования</CardTitle>
            <p className="text-sm text-muted-foreground">
              Реестр нормативных актов. Внутри каждого НПА хранятся только извлеченные требования к документам и проверкам.
            </p>
          </div>
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить НПА
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Наименование</th>
                <th className="px-4 py-3 font-medium">Тип акта</th>
                <th className="px-4 py-3 font-medium">Номер</th>
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Редакция</th>
                <th className="px-4 py-3 font-medium">Требования</th>
                <th className="px-4 py-3 font-medium">Файл</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, index) => (
                <tr key={`npa-skeleton-${index}`} className="border-b last:border-b-0">
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3">
                      <div className="h-4 animate-pulse bg-muted" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && records.map((record) => {
                const accepted = record.requirements.filter((requirement) => requirement.action === 'accepted').length;
                return (
                  <tr
                    key={record.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(record.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(record.id);
                      }
                    }}
                    className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="line-clamp-2 font-medium">{record.name}</div>
                      {record.area && <div className="mt-1 text-xs text-muted-foreground">{record.area}</div>}
                    </td>
                    <td className="px-4 py-3 align-top">{record.actType || '—'}</td>
                    <td className="px-4 py-3 align-top">{record.number || '—'}</td>
                    <td className="px-4 py-3 align-top">{record.date || '—'}</td>
                    <td className="px-4 py-3 align-top">{record.revision || '—'}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{accepted} принято</Badge>
                        {record.requirements.length - accepted > 0 && (
                          <Badge variant="outline">{record.requirements.length - accepted} отклонено</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                      {record.fileName ? (
                        <div>
                          <div className="line-clamp-1">{record.fileName}</div>
                          {record.fileSize ? <div>{formatFileSize(record.fileSize)}</div> : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyAdminBlock text="Реестр НПА пуст. Добавьте первый нормативный акт." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function NpaRegistryDetail({ record, documentTypes, onBack }: { record: AdminNpaRecord; documentTypes: DocumentType[]; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Назад к реестру НПА
              </Button>
              <CardTitle className="text-xl">{record.name}</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{record.actType || 'Тип не указан'}</Badge>
                {record.number && <Badge variant="outline">№ {record.number}</Badge>}
                {record.date && <Badge variant="outline">от {record.date}</Badge>}
                {record.revision && <Badge variant="outline">ред. {record.revision}</Badge>}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{record.requirements.length} требований</div>
              <div className="text-xs text-muted-foreground">
                {record.fileName || 'Файл не сохранен'}{record.fileSize ? ` · ${formatFileSize(record.fileSize)}` : ''}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <NpaRequirementsTable requirements={record.requirements} documentTypes={documentTypes} readonly />
    </div>
  );
}
