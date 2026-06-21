import { Badge } from '@/components/ui/badge';
import { EmptyState } from './reference-common';
import { kindLabels, statusLabels } from './reference-utils';
import type { ReferenceExperimentDocument } from './reference-types';

export function ReferenceDocumentTable({ documents, onSelect }: { documents: ReferenceExperimentDocument[]; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-[5%] px-3 py-3 font-medium">№</th>
            <th className="w-[34%] px-3 py-3 font-medium">НПА</th>
            <th className="w-[8%] px-3 py-3 font-medium">Область</th>
            <th className="w-[10%] px-3 py-3 font-medium">Тип</th>
            <th className="w-[12%] px-3 py-3 font-medium">Номер / дата</th>
            <th className="w-[11%] px-3 py-3 font-medium">Статус</th>
            <th className="w-[12%] px-3 py-3 font-medium">Извлечено</th>
            <th className="w-[8%] px-3 py-3 font-medium">Размер</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, index) => (
            <tr
              key={doc.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(doc.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(doc.id);
                }
              }}
              className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <td className="px-3 py-3 align-top"><Badge variant="secondary">#{index + 1}</Badge></td>
              <td className="px-3 py-3 align-top">
                <div className="line-clamp-2 font-semibold">{doc.title}</div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{doc.fileName}</div>
              </td>
              <td className="px-3 py-3 align-top"><Badge variant="outline">{doc.domain}</Badge></td>
              <td className="px-3 py-3 align-top">{kindLabels[doc.kind] || doc.kind}</td>
              <td className="px-3 py-3 align-top text-xs text-muted-foreground"><div>{doc.number || 'без номера'}</div><div>{doc.date || 'без даты'}</div></td>
              <td className="px-3 py-3 align-top"><Badge variant={doc.status === 'processed' ? 'default' : doc.status === 'error' ? 'destructive' : 'outline'}>{statusLabels[doc.status]}</Badge></td>
              <td className="px-3 py-3 align-top text-xs"><div>Треб.: {doc.intelligence?.requirements?.length || 0}</div><div className="text-muted-foreground">Док.: {doc.intelligence?.document_types?.length || 0} · Парам.: {doc.intelligence?.applicant_parameters?.length || 0}</div></td>
              <td className="px-3 py-3 align-top text-xs text-muted-foreground"><div>{doc.sectionsCount} пунктов</div><div>~{doc.tokenEstimate.toLocaleString('ru-RU')} ток.</div></td>
            </tr>
          ))}
          {documents.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><EmptyState title="Ничего не найдено" text="Попробуйте изменить поисковый запрос." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
