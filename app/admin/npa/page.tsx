'use client';

import { useRouter } from 'next/navigation';
import { useAdminPageState } from '@/hooks/use-admin-page-state';
import { NpaRegistryPanel } from '@/components/admin/npa-registry-panel';
import { NpaRegistryDialog } from '@/components/admin/npa-registry-dialog';

export default function AdminNpaPage() {
  const router = useRouter();
  const {
    adminConfigLoaded,
    documentTypes,
    npaRegistry,
    npaDialogOpen,
    npaDraft,
    npaExtractJob,
    setNpaDialogOpen,
    setNpaDraft,
    openAddNpaDialog,
    handleStartNpaExtraction,
    handleSaveNpaToRegistry,
    handleAcceptAllDraftRequirements,
    handleUpdateDraftRequirementAction,
    handleUpdateDraftRequirementTarget,
  } = useAdminPageState();

  return (
    <>
      <NpaRegistryPanel
        records={npaRegistry}
        documentTypes={documentTypes}
        selectedId={null}
        loading={!adminConfigLoaded}
        onSelect={(id) => router.push(`/admin/npa/${encodeURIComponent(id)}`)}
        onBack={() => undefined}
        onAdd={openAddNpaDialog}
      />
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
    </>
  );
}
