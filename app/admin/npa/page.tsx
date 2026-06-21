'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AdminNpaRecord } from '@/lib/admin/admin-page-types';
import { NpaRegistryPanel } from '@/components/admin/npa-registry-panel';
import { useAdminDocumentTypes } from '@/lib/hooks/useAdminDocumentTypes';

export default function AdminNpaPage() {
  const router = useRouter();
  const documentTypes = useAdminDocumentTypes();
  const [records, setRecords] = useState<AdminNpaRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    <NpaRegistryPanel
      records={records}
      documentTypes={documentTypes}
      selectedId={null}
      loading={loading}
      onSelect={(id) => router.push(`/admin/npa/${encodeURIComponent(id)}`)}
      onBack={() => undefined}
      onAdd={() => toast.info('Добавление НПА будет подключено отдельным быстрым endpoint без загрузки общего config.')}
    />
  );
}
