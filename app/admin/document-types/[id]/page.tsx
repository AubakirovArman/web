'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { NewDossierDocumentTypeDetail } from '@/components/admin/new-dossier-document-type-detail';
import { NewDossierDocumentTypeEditorDialog } from '@/components/admin/new-dossier-document-type-editor-dialog';

export default function AdminDocumentTypeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id || ''));
  const [item, setItem] = useState<NewDossierDocumentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sections, setSections] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/admin/document-types/sections', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d.sections) && setSections(d.sections))
      .catch(() => {});
  }, []);

  const loadItem = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/document-types/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить тип документа');
      setItem(payload.item || null);
    } catch (error) {
      setItem(null);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить тип документа');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const deleteItem = async () => {
    try {
      const response = await fetch(`/api/admin/document-types/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось удалить тип документа');
      toast.success('Тип документа удален');
      router.push('/admin/document-types');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить тип документа');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!item) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Тип документа не найден</h2>
            <p className="text-sm text-muted-foreground">Проверьте ссылку или вернитесь к списку типов документов.</p>
          </div>
          <Button onClick={() => router.push('/admin/document-types')}>К типам документов</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <NewDossierDocumentTypeDetail
        item={item}
        onBack={() => router.push('/admin/document-types')}
        onEdit={() => setEditorOpen(true)}
        onDelete={deleteItem}
        onReload={loadItem}
      />
      <NewDossierDocumentTypeEditorDialog
        state={editorOpen ? { mode: 'edit', values: item } : null}
        sections={Array.from(new Set([...sections, item.group, item.module].filter(Boolean)))}
        onClose={() => setEditorOpen(false)}
        onSave={async (next) => {
          try {
            const response = await fetch(`/api/admin/document-types/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ item: next }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Не удалось обновить тип документа');
            setItem(payload.item || next);
            setEditorOpen(false);
            toast.success('Тип документа обновлен');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Не удалось обновить тип документа');
          }
        }}
      />
    </>
  );
}
