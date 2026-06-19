'use client';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentType } from '@/lib/types';
import type { AdminNpaRequirement, NpaRequirementAction } from '@/lib/admin/admin-page-types';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';

// Drop the internal "Gemma:" prefix from the stored check type for display.
function cleanCheckType(value?: string): string {
  return (value || '').replace(/^\s*gemma\s*[:\-–—]?\s*/i, '').trim();
}

export function NpaRequirementsTable({
  requirements,
  documentTypes,
  readonly = false,
  onActionChange,
  onTargetDocumentTypeChange,
}: {
  requirements: AdminNpaRequirement[];
  documentTypes: DocumentType[];
  readonly?: boolean;
  onActionChange?: (requirementId: string, action: NpaRequirementAction) => void;
  onTargetDocumentTypeChange?: (requirementId: string, targetDocumentTypeId: string) => void;
}) {
  if (requirements.length === 0) {
    return <div className="p-4"><EmptyAdminBlock text="Требования пока не извлечены." /></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1320px] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-[7%] px-3 py-2 font-medium">Код</th>
            <th className="w-[15%] px-3 py-2 font-medium">НПА / Пункт</th>
            <th className="w-[29%] px-3 py-2 font-medium">Требование</th>
            <th className="w-[20%] px-3 py-2 font-medium">Документ / проверка</th>
            <th className="w-[16%] px-3 py-2 font-medium">Тип документа системы</th>
            <th className="w-[6%] px-3 py-2 font-medium">Критичность</th>
            <th className="w-[7%] px-3 py-2 font-medium">Действие</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((requirement) => {
            const targetDocument = requirement.targetDocumentTypeId
              ? documentTypes.find((doc) => doc.id === requirement.targetDocumentTypeId)
              : undefined;
            return (
            <tr key={requirement.id} className="border-b last:border-b-0">
              <td className="break-words px-3 py-3 align-top font-mono text-xs">{requirement.code || '—'}</td>
              <td className="break-words px-3 py-3 align-top text-xs text-muted-foreground">
                {requirement.pointLabel || requirement.point || '—'}
              </td>
              <td className="px-3 py-3 align-top">
                <div className="leading-6">{requirement.requirement}</div>
                {requirement.condition && (
                  <div className="mt-1 text-xs text-muted-foreground">Условие: {requirement.condition}</div>
                )}
                {requirement.quote && (
                  <details className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium text-foreground">Цитата НПА</summary>
                    <p className="mt-2 leading-5">{requirement.quote}</p>
                  </details>
                )}
              </td>
              <td className="px-3 py-3 align-top text-xs">
                <div className="leading-5 font-medium">{requirement.documentName || 'Документ не указан'}</div>
                <div className="mt-1 text-muted-foreground">
                  {[requirement.documentCode, cleanCheckType(requirement.checkType)].filter(Boolean).join(' · ') || 'Тип проверки не указан'}
                </div>
              </td>
              <td className="px-3 py-3 align-top">
                {readonly ? (
                  <div className="text-xs">
                    <div className="font-medium">{targetDocument?.name || requirement.targetDocumentTypeId || 'Не привязано'}</div>
                    {requirement.targetDocumentTypeId && (
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{requirement.targetDocumentTypeId}</div>
                    )}
                  </div>
                ) : (
                  <Select
                    value={requirement.targetDocumentTypeId || 'none'}
                    onValueChange={(value) => onTargetDocumentTypeChange?.(requirement.id, value === 'none' ? '' : value)}
                  >
                    <SelectTrigger className="h-auto min-h-9 w-full">
                      <SelectValue placeholder="Выбрать тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не привязывать</SelectItem>
                      {documentTypes
                        .filter((doc) => doc.direction === 'LS' || doc.direction === 'MI' || doc.direction === 'both')
                        .slice(0, 500)
                        .map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className="px-3 py-3 align-top">
                <Badge variant="outline">{requirement.criticality || 'неясно'}</Badge>
              </td>
              <td className="px-3 py-3 align-top">
                {readonly ? (
                  <Badge variant={requirement.action === 'accepted' ? 'secondary' : 'outline'}>
                    {requirement.action === 'accepted' ? 'Принято' : 'Отклонено'}
                  </Badge>
                ) : (
                  <Select
                    value={requirement.action}
                    onValueChange={(value) => onActionChange?.(requirement.id, value as NpaRequirementAction)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accepted">Принять</SelectItem>
                      <SelectItem value="rejected">Отклонить</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

