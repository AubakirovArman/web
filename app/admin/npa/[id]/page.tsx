'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdminNpaRecord } from '@/lib/admin/admin-page-types';
import { NpaRegistryDetail } from '@/components/admin/npa-registry-panel';
import { useAdminDocumentTypes } from '@/lib/hooks/useAdminDocumentTypes';

export default function AdminNpaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentTypes = useAdminDocumentTypes();
  const id = decodeURIComponent(String(params.id || ''));
  const [record, setRecord] = useState<AdminNpaRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/npa/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить НПА');
      setRecord(payload.record || null);
    } catch (error) {
      setRecord(null);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить НПА');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!record) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">НПА не найден</h2>
            <p className="text-sm text-muted-foreground">Проверьте ссылку или вернитесь к реестру НПА.</p>
          </div>
          <Button onClick={() => router.push('/admin/npa')}>К реестру НПА</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <NpaRegistryDetail
      record={record}
      documentTypes={documentTypes}
      onBack={() => router.push('/admin/npa')}
      onReload={loadRecord}
    />
  );
}
