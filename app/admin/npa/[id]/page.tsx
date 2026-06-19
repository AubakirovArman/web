'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminPageState } from '@/hooks/use-admin-page-state';
import { NpaRegistryDetail } from '@/components/admin/npa-registry-panel';

export default function AdminNpaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { adminConfigLoaded, documentTypes, npaRegistry } = useAdminPageState();
  const id = decodeURIComponent(String(params.id || ''));
  const record = npaRegistry.find((item) => item.id === id);

  if (!adminConfigLoaded) {
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

  return <NpaRegistryDetail record={record} documentTypes={documentTypes} onBack={() => router.push('/admin/npa')} />;
}
