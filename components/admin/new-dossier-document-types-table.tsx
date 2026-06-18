'use client';

import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { getLsDocumentRequirementForItem } from '@/lib/data/ls-document-checks-mapping';
import { formatNewDossierSection, getRequirementSummary } from '@/lib/admin/new-dossier-document-type-utils';
import { RequirednessBadge } from '@/components/admin/new-dossier-document-type-primitives';

export function NewDossierDocumentTypesTable({
  items,
  onOpen,
  onDelete,
}: {
  items: NewDossierDocumentType[];
  onOpen: (item: NewDossierDocumentType) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-[9%] px-3 py-2 font-medium">Код</th>
            <th className="w-[28%] px-3 py-2 font-medium">Название</th>
            <th className="w-[8%] px-3 py-2 font-medium">Область</th>
            <th className="w-[16%] px-3 py-2 font-medium">Раздел</th>
            <th className="w-[24%] px-3 py-2 font-medium">Требование</th>
            <th className="w-[10%] px-3 py-2 font-medium">Обязательность</th>
            <th className="w-[5%] px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const requirement = getLsDocumentRequirementForItem(item);
            const requirementSummary = getRequirementSummary(item, requirement);
            return (
            <tr
              key={item.id}
              onClick={() => onOpen(item)}
              className={`cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40 ${item.active ? '' : 'opacity-60'}`}
            >
              <td className="px-3 py-2 align-top">
                <div className="font-mono text-xs">{item.code || '—'}</div>
              </td>
              <td className="px-3 py-2 align-top">
                <div className="line-clamp-2 font-medium">{item.name}</div>
              </td>
              <td className="px-3 py-2 align-top">
                <Badge variant="secondary">{item.direction}</Badge>
              </td>
              <td className="px-3 py-2 align-top">
                <div className="line-clamp-2 text-xs">{formatNewDossierSection(item)}</div>
              </td>
              <td className="px-3 py-2 align-top">
                <div className="line-clamp-2 text-xs text-muted-foreground">{requirementSummary}</div>
              </td>
              <td className="px-3 py-2 align-top">
                <RequirednessBadge item={item} hasRule={!!requirement} />
              </td>
              <td className="px-3 py-2 text-right align-top">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(item.id);
                    }}
                    aria-label="Удалить тип документа"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

