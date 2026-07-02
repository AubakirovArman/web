'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AuditEntry {
  id: string;
  actorUserId: string;
  action: string;
  entity?: string;
  entityId?: string;
  summary?: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  'requirements.update': 'Требования обновлены',
  'field.create': 'Поле создано',
  'field.update': 'Поле изменено',
  'field.delete': 'Поле удалено',
  'npa-requirement.add': 'НПА: требование добавлено',
  'npa-requirement.update': 'НПА: требование изменено',
  'npa-requirement.delete': 'НПА: требование удалено',
  'role.create': 'Роль создана',
  'role.update': 'Роль изменена',
  'role.delete': 'Роль удалена',
};

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit?limit=300', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось загрузить журнал');
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Журнал изменений логики</CardTitle>
              <p className="text-sm text-muted-foreground">Кто и когда менял требования, поля, роли и требования НПА.</p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>Обновить</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="border-b px-3 py-2 font-semibold">Когда</th>
                  <th className="border-b px-3 py-2 font-semibold">Кто</th>
                  <th className="border-b px-3 py-2 font-semibold">Действие</th>
                  <th className="border-b px-3 py-2 font-semibold">Объект</th>
                  <th className="border-b px-3 py-2 font-semibold">Детали</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Загрузка…</td></tr>}
                {!loading && entries.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Записей пока нет.</td></tr>}
                {!loading && entries.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-muted/30">
                    <td className="whitespace-nowrap border-b px-3 py-2 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString('ru-RU')}</td>
                    <td className="border-b px-3 py-2 font-mono text-xs">{e.actorUserId}</td>
                    <td className="border-b px-3 py-2"><Badge variant="outline">{ACTION_LABELS[e.action] || e.action}</Badge></td>
                    <td className="border-b px-3 py-2 text-xs text-muted-foreground">{[e.entity, e.entityId].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="border-b px-3 py-2 text-xs">{e.summary || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
