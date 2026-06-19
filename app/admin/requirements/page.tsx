'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminPageState } from '@/hooks/use-admin-page-state';
import { NpaRequirementsTable } from '@/components/admin/npa-requirements-table';

export default function AdminRequirementsPage() {
  const { adminConfigLoaded, documentTypes, npaRegistry } = useAdminPageState();
  const requirements = useMemo(
    () => npaRegistry.flatMap((record) => record.requirements.map((requirement) => ({
      ...requirement,
      code: requirement.code || record.number || record.id,
      point: requirement.point || record.name,
    }))),
    [npaRegistry]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Требования</CardTitle>
          <p className="text-sm text-muted-foreground">
            Общий список требований, извлеченных из НПА и сохраненных в реестр.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{adminConfigLoaded ? `${requirements.length} требований` : 'Загрузка требований'}</Badge>
          <Badge variant="outline">{npaRegistry.length} НПА</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {adminConfigLoaded ? (
            <NpaRequirementsTable requirements={requirements} documentTypes={documentTypes} readonly />
          ) : (
            <div className="space-y-3 p-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-8 animate-pulse bg-muted" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
