'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getRequiredParameterIds, getVisibleParameterIds, parameters } from '@/lib/data/seed';
import type { DocumentType, Parameter } from '@/lib/types';

const usageLabels: Record<string, string> = {
  condition_for_document_upload: 'Условие отображения документов',
  reference_or_validation: 'Сверка / справочная проверка',
  core_route: 'Базовая маршрутизация заявки',
};

type FieldUsage = keyof typeof usageLabels;

const conditionParameterIds = new Set([
  'param-dossier-type',
  'param-manufacturer-country',
  'param-expertise-mode',
  'param-product-type',
  'param-dosage-form',
  'param-dispensing',
  'param-applicant',
  'param-manufacturer',
  'param-manufacturer-address',
]);

function getUsage(param: Parameter): FieldUsage {
  if (param.id === 'param-object-type' || param.id === 'param-procedure') return 'core_route';
  if (conditionParameterIds.has(param.id)) return 'condition_for_document_upload';
  return 'reference_or_validation';
}

function renderOptions(param: Parameter) {
  if (!param.options?.length) return 'Свободный ввод';
  return param.options.map((option) => `${option.value} — ${option.label}`).join('; ');
}

export function ApplicationFieldsPanel() {
  const [query, setQuery] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'condition_for_document_upload' | 'reference_or_validation' | 'core_route'>('all');
  const [runtimeDocumentTypes, setRuntimeDocumentTypes] = useState<DocumentType[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/config?lite=1')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((data) => {
        if (!cancelled) setRuntimeDocumentTypes(Array.isArray(data?.documentTypes) ? data.documentTypes : []);
      })
      .catch(() => {
        if (!cancelled) setRuntimeDocumentTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const relatedDocumentsByParam = useMemo(() => {
    const byParam = new Map<string, Array<{ code: string; name: string }>>();
    for (const doc of runtimeDocumentTypes) {
      const code = documentCode(doc);
      if (!code) continue;
      for (const paramId of doc.linkedApplicationParams || []) {
        const bucket = byParam.get(paramId) || [];
        bucket.push({ code, name: doc.name });
        byParam.set(paramId, bucket);
      }
    }
    return byParam;
  }, [runtimeDocumentTypes]);

  const rows = useMemo(() => {
    const visibleIds = getVisibleParameterIds('LS', 'registration');
    const requiredIds = new Set(getRequiredParameterIds('LS', 'registration'));
    const byId = new Map(parameters.map((item) => [item.id, item]));
    return visibleIds
      .map((id) => byId.get(id))
      .filter((item): item is Parameter => Boolean(item))
      .map((param) => ({
        param,
        required: requiredIds.has(param.id),
        usage: relatedDocumentsByParam.has(param.id) ? 'condition_for_document_upload' as const : getUsage(param),
        relatedDocuments: relatedDocumentsByParam.get(param.id) || [],
      }));
  }, [relatedDocumentsByParam]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = rows.filter(({ param, usage, relatedDocuments }) => {
    if (usageFilter !== 'all' && usage !== usageFilter) return false;
    if (!normalizedQuery) return true;
    return [param.id, param.label, param.type, param.section, param.sourceFieldRef, renderOptions(param), relatedDocuments.map((doc) => `${doc.code} ${doc.name}`).join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Поля заявки: ЛС / регистрация</CardTitle>
          <p className="text-sm text-muted-foreground">
            Слой параметров заявки для будущих условий отображения типов документов. Проверки содержимого документов остаются во вкладке типов документов.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{rows.length} полей LS/registration</Badge>
            <Badge variant="outline">{rows.filter((row) => row.required).length} обязательных</Badge>
            <Badge variant="outline">{rows.filter((row) => row.usage === 'condition_for_document_upload').length} влияют на загрузку документов</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по переменной, названию, типу или значению" />
            <Select value={usageFilter} onValueChange={(value) => setUsageFilter(value as typeof usageFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все поля</SelectItem>
                <SelectItem value="condition_for_document_upload">Для условий документов</SelectItem>
                <SelectItem value="reference_or_validation">Для сверки</SelectItem>
                <SelectItem value="core_route">Маршрутизация</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="border-b px-3 py-2 font-semibold">Переменная</th>
                  <th className="border-b px-3 py-2 font-semibold">Название</th>
                  <th className="border-b px-3 py-2 font-semibold">Тип</th>
                  <th className="border-b px-3 py-2 font-semibold">Обяз.</th>
                  <th className="border-b px-3 py-2 font-semibold">Использование</th>
                  <th className="border-b px-3 py-2 font-semibold">Коды разделов</th>
                  <th className="border-b px-3 py-2 font-semibold">Значения</th>
                  <th className="border-b px-3 py-2 font-semibold">Раздел / источник</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ param, required, usage, relatedDocuments }) => (
                  <tr key={param.id} className="align-top hover:bg-muted/30">
                    <td className="border-b px-3 py-2 font-mono text-xs">{param.id}</td>
                    <td className="border-b px-3 py-2 font-medium">{param.label}</td>
                    <td className="border-b px-3 py-2">{param.type}</td>
                    <td className="border-b px-3 py-2">{required ? 'Да' : 'Нет'}</td>
                    <td className="border-b px-3 py-2">{usageLabels[usage]}</td>
                    <td className="max-w-[360px] border-b px-3 py-2 text-xs">
                      {relatedDocuments.length ? (
                        <div className="flex flex-wrap gap-1">
                          {uniqueRelatedDocuments(relatedDocuments).slice(0, 12).map((doc) => (
                            <span key={`${doc.code}-${doc.name}`} title={doc.name} className="border bg-background px-1.5 py-0.5">
                              {doc.code}
                            </span>
                          ))}
                          {uniqueRelatedDocuments(relatedDocuments).length > 12 && (
                            <span className="text-muted-foreground">+{uniqueRelatedDocuments(relatedDocuments).length - 12}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[520px] border-b px-3 py-2 text-xs text-muted-foreground">{renderOptions(param)}</td>
                    <td className="border-b px-3 py-2 text-xs text-muted-foreground">
                      {[param.section, param.sourceFieldRef, param.sourceNpa].filter(Boolean).join(' / ') || 'Не указано'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>Поля не найдены</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function documentCode(doc: DocumentType): string {
  return String(doc.docCode || doc.importedRequirements?.find((requirement) => requirement.sourceDocumentCode)?.sourceDocumentCode || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function uniqueRelatedDocuments(items: Array<{ code: string; name: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}:${item.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
