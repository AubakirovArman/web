'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminNpaRequirement } from '@/lib/admin/admin-page-types';
import { NpaRequirementsTable } from '@/components/admin/npa-requirements-table';

export default function AdminRequirementsPage() {
  const [requirements, setRequirements] = useState<AdminNpaRequirement[]>([]);
  const [npaCount, setNpaCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadRequirements = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/requirements', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить требования');
      setRequirements(Array.isArray(payload.requirements) ? payload.requirements : []);
      setNpaCount(Number(payload.npaCount) || 0);
    } catch (error) {
      setRequirements([]);
      setNpaCount(0);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить требования');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Требования</CardTitle>
          <p className="text-sm text-muted-foreground">Общий список требований из реестра НПА без загрузки полного admin-config.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{loading ? 'Загрузка требований' : `${requirements.length} требований`}</Badge>
          <Badge variant="outline">{npaCount} НПА</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-8 animate-pulse bg-muted" />
              ))}
            </div>
          ) : (
            <NpaRequirementsTable requirements={requirements} documentTypes={[]} readonly />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
