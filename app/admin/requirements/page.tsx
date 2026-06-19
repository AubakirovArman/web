'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminNpaRequirement } from '@/lib/admin/admin-page-types';
import { NpaRequirementsTable } from '@/components/admin/npa-requirements-table';

export default function AdminRequirementsPage() {
  const [requirements, setRequirements] = useState<AdminNpaRequirement[]>([]);
  const [npaCount, setNpaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requirements;
    return requirements.filter((item) =>
      [item.requirement, item.pointLabel, item.point, item.code, item.npaName, item.documentName, item.criticality]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [requirements, query]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const rangeText = loading
    ? 'Загрузка данных…'
    : total === 0
      ? 'Показано 0 из 0'
      : `Показано ${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, total)} из ${total}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Требования</CardTitle>
          <p className="text-sm text-muted-foreground">
            Общий список требований из реестра НПА. К пункту добавлено название акта (например «Решение № 88 п. 2»).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{loading ? 'Загрузка требований' : `${requirements.length} требований`}</Badge>
            <Badge variant="outline">{npaCount} НПА</Badge>
            {query && <Badge variant="outline">Найдено: {total}</Badge>}
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по требованию, пункту, коду или названию НПА"
          />
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
            <NpaRequirementsTable requirements={pageItems} documentTypes={[]} readonly />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 border bg-card px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground">{rangeText}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 на странице</SelectItem>
              <SelectItem value="50">50 на странице</SelectItem>
              <SelectItem value="100">100 на странице</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={loading || safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Назад
          </Button>
          <span className="min-w-20 text-center text-muted-foreground">
            {safePage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || safePage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Далее
          </Button>
        </div>
      </div>
    </div>
  );
}
