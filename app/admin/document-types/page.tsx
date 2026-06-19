'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createBlankNewDossierDocumentType, getNewDossierSections } from '@/lib/admin/new-dossier-document-type-utils';
import { useAdminPageState } from '@/hooks/use-admin-page-state';
import { NewDossierDocumentTypesPanel } from '@/components/admin/new-dossier-document-types-panel';
import { NewDossierDocumentTypeEditorDialog } from '@/components/admin/new-dossier-document-type-editor-dialog';

export default function AdminDocumentTypesPage() {
  const router = useRouter();
  const {
    adminConfigLoaded,
    newDossierDocumentTypes,
    newDossierDocumentTypeEditor,
    setNewDossierDocumentTypeEditor,
    persistNewDossierDocumentTypes,
    handleResetNewDossierDocumentTypes,
  } = useAdminPageState();

  return (
    <>
      <NewDossierDocumentTypesPanel
        items={newDossierDocumentTypes}
        loading={!adminConfigLoaded}
        onChange={persistNewDossierDocumentTypes}
        onReset={handleResetNewDossierDocumentTypes}
        onCreate={() => setNewDossierDocumentTypeEditor({ mode: 'create', values: createBlankNewDossierDocumentType(newDossierDocumentTypes) })}
        onEdit={(item) => setNewDossierDocumentTypeEditor({ mode: 'edit', values: item })}
        onOpenItem={(item) => router.push(`/admin/document-types/${encodeURIComponent(item.id)}`)}
      />

      <NewDossierDocumentTypeEditorDialog
        state={newDossierDocumentTypeEditor}
        sections={getNewDossierSections(newDossierDocumentTypes)}
        onClose={() => setNewDossierDocumentTypeEditor(null)}
        onSave={(next) => {
          const exists = newDossierDocumentTypes.some((item) => item.id === next.id);
          persistNewDossierDocumentTypes(
            exists
              ? newDossierDocumentTypes.map((item) => (item.id === next.id ? next : item))
              : [next, ...newDossierDocumentTypes]
          );
          setNewDossierDocumentTypeEditor(null);
          toast.success(exists ? 'Тип документа обновлен' : 'Тип документа создан');
        }}
      />
    </>
  );
}
