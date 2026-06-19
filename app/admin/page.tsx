'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, FileText, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createBlankNewDossierDocumentType, getNewDossierSections } from '@/lib/admin/new-dossier-document-type-utils';
import { useAdminPageState } from '@/hooks/use-admin-page-state';
import { NpaRegistryPanel } from '@/components/admin/npa-registry-panel';
import { NpaRegistryDialog } from '@/components/admin/npa-registry-dialog';
import { NewDossierDocumentTypesPanel } from '@/components/admin/new-dossier-document-types-panel';
import { NewDossierDocumentTypeEditorDialog } from '@/components/admin/new-dossier-document-type-editor-dialog';
import { ApplicationFieldsPanel } from '@/components/admin/application-fields-panel';

export default function AdminPage() {
  const {
    adminConfigLoaded,
    documentTypes,
    newDossierDocumentTypes,
    newDossierDocumentTypeEditor,
    npaRegistry,
    selectedNpaRecordId,
    npaDialogOpen,
    npaDraft,
    npaExtractJob,
    setSelectedNpaRecordId,
    setNpaDialogOpen,
    setNpaDraft,
    setNewDossierDocumentTypeEditor,
    persistNewDossierDocumentTypes,
    handleResetNewDossierDocumentTypes,
    openAddNpaDialog,
    handleStartNpaExtraction,
    handleSaveNpaToRegistry,
    handleAcceptAllDraftRequirements,
    handleUpdateDraftRequirementAction,
    handleUpdateDraftRequirementTarget,
  } = useAdminPageState();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4">
          <FadeIn>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Панель администратора</h1>
                <p className="text-sm text-muted-foreground">Типы документов, обязательность в заявке и требования из НПА</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  На главную
                </Link>
              </Button>
            </div>
          </FadeIn>

          <Tabs defaultValue="docs-new">
            <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2">
              <TabsTrigger value="docs-new">
                <FileText className="mr-2 h-4 w-4" />
                Типы документов
              </TabsTrigger>
              <TabsTrigger value="npas">
                <BookOpen className="mr-2 h-4 w-4" />
                НПА и требования
              </TabsTrigger>
              <TabsTrigger value="fields">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Поля
              </TabsTrigger>
            </TabsList>

            <TabsContent value="docs-new" className="space-y-3">
              <NewDossierDocumentTypesPanel
                items={newDossierDocumentTypes}
                loading={!adminConfigLoaded}
                onChange={persistNewDossierDocumentTypes}
                onReset={handleResetNewDossierDocumentTypes}
                onCreate={() => setNewDossierDocumentTypeEditor({ mode: 'create', values: createBlankNewDossierDocumentType(newDossierDocumentTypes) })}
                onEdit={(item) => setNewDossierDocumentTypeEditor({ mode: 'edit', values: item })}
              />
            </TabsContent>

            <TabsContent value="npas" className="space-y-3">
              <NpaRegistryPanel
                records={npaRegistry}
                documentTypes={documentTypes}
                selectedId={selectedNpaRecordId}
                onSelect={setSelectedNpaRecordId}
                onBack={() => setSelectedNpaRecordId(null)}
                onAdd={openAddNpaDialog}
              />
            </TabsContent>

            <TabsContent value="fields" className="space-y-3">
              <ApplicationFieldsPanel />
            </TabsContent>
          </Tabs>

          <NpaRegistryDialog
            open={npaDialogOpen}
            draft={npaDraft}
            job={npaExtractJob}
            documentTypes={documentTypes}
            onClose={() => setNpaDialogOpen(false)}
            onChange={setNpaDraft}
            onExtract={handleStartNpaExtraction}
            onSave={handleSaveNpaToRegistry}
            onAcceptAll={handleAcceptAllDraftRequirements}
            onRequirementActionChange={handleUpdateDraftRequirementAction}
            onRequirementTargetChange={handleUpdateDraftRequirementTarget}
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
        </div>
      </main>
    </div>
  );
}
