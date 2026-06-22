'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AdminNpaRecord, NpaGemmaPreview } from '@/lib/admin/admin-page-types';
import { NpaRegistryPanel } from '@/components/admin/npa-registry-panel';
import { NpaAddDialog } from '@/components/admin/npa-add-dialog';
import { NpaGemmaPreviewDialog } from '@/components/admin/npa-gemma-preview-dialog';
import { useAdminDocumentTypes } from '@/lib/hooks/useAdminDocumentTypes';

export default function AdminNpaPage() {
  const router = useRouter();
  const documentTypes = useAdminDocumentTypes();
  const [records, setRecords] = useState<AdminNpaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState<NpaGemmaPreview | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/npa', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить реестр НПА');
      setRecords(Array.isArray(payload.records) ? payload.records : []);
    } catch (error) {
      setRecords([]);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить реестр НПА');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  return (
    <>
      <NpaRegistryPanel
        records={records}
        documentTypes={documentTypes}
        selectedId={null}
        loading={loading}
        onSelect={(id) => router.push(`/admin/npa/${encodeURIComponent(id)}`)}
        onBack={() => undefined}
        onAdd={() => setAddOpen(true)}
      />

      <NpaAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onPreview={(result) => {
          setAddOpen(false);
          setPreview(result);
          toast.success('Документ проанализирован Gemma');
        }}
      />

      <NpaGemmaPreviewDialog
        job={null}
        preview={preview}
        documentTypes={documentTypes}
        onApplyMappings={() => toast.info('Это предпросмотр анализа. Запись извлечённых требований в правила пока не выполняется.')}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
