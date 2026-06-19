'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getNewDossierSections } from '@/lib/admin/new-dossier-document-type-utils';
import { useAdminPageState } from '@/hooks/use-admin-page-state';
import { NewDossierDocumentTypeDetail } from '@/components/admin/new-dossier-document-type-detail';
import { NewDossierDocumentTypeEditorDialog } from '@/components/admin/new-dossier-document-type-editor-dialog';

export default function AdminDocumentTypeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    adminConfigLoaded,
    newDossierDocumentTypes,
    newDossierDocumentTypeEditor,
    setNewDossierDocumentTypeEditor,
    persistNewDossierDocumentTypes,
  } = useAdminPageState();
  const id = decodeURIComponent(String(params.id || ''));
  const item = useMemo(() => newDossierDocumentTypes.find((candidate) => candidate.id === id), [id, newDossierDocumentTypes]);

  if (!adminConfigLoaded) {
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
        onEdit={() => setNewDossierDocumentTypeEditor({ mode: 'edit', values: item })}
        onDelete={() => {
          persistNewDossierDocumentTypes(newDossierDocumentTypes.filter((candidate) => candidate.id !== item.id));
          toast.success('Тип документа удален');
          router.push('/admin/document-types');
        }}
      />
      <NewDossierDocumentTypeEditorDialog
        state={newDossierDocumentTypeEditor}
        sections={getNewDossierSections(newDossierDocumentTypes)}
        onClose={() => setNewDossierDocumentTypeEditor(null)}
        onSave={(next) => {
          persistNewDossierDocumentTypes(newDossierDocumentTypes.map((candidate) => (candidate.id === next.id ? next : candidate)));
          setNewDossierDocumentTypeEditor(null);
          toast.success('Тип документа обновлен');
        }}
      />
    </>
  );
}
