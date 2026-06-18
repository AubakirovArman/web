'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentType, DocumentTypeRequirement } from '@/lib/types';
import type { NpaGemmaPreview } from '@/lib/admin/admin-page-types';
import { getGemmaDocumentKey, renderGemmaValue, requirementBelongsToGemmaDocument } from '@/lib/admin/document-type-logic';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';

export function GemmaDocumentTypeMappingList({
  items,
  requirements,
  documentTypes,
  mappings,
  onChange,
}: {
  items: Record<string, unknown>[];
  requirements: Record<string, unknown>[];
  documentTypes: DocumentType[];
  mappings: Record<string, string>;
  onChange: (key: string, documentTypeId: string) => void;
}) {
  if (!items.length) return <EmptyAdminBlock text="Gemma не нашла типы документов." />;

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const key = getGemmaDocumentKey(item, index);
        const relatedRequirements = requirements.filter((requirement) => requirementBelongsToGemmaDocument(requirement, item));
        return (
          <div key={key} className="rounded-xl border bg-muted/20 p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {renderGemmaValue(item.code) && <Badge variant="secondary">{renderGemmaValue(item.code)}</Badge>}
                  {renderGemmaValue(item.procedure) && <Badge variant="outline">{renderGemmaValue(item.procedure)}</Badge>}
                  {renderGemmaValue(item.requiredness) && <Badge variant="outline">{renderGemmaValue(item.requiredness)}</Badge>}
                  <Badge variant="outline">{relatedRequirements.length} треб.</Badge>
                </div>
                <p className="font-medium">{renderGemmaValue(item.name) || `Тип документа ${index + 1}`}</p>
                {renderGemmaValue(item.applicability_condition) && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Условие: </span>
                    {renderGemmaValue(item.applicability_condition)}
                  </p>
                )}
                {renderGemmaValue(item.source_point) && (
                  <p className="text-xs text-muted-foreground">Источник: {renderGemmaValue(item.source_point)}</p>
                )}
                {renderGemmaValue(item.quote) && (
                  <blockquote className="rounded-lg border-l-4 border-primary/50 bg-background p-3 text-sm text-muted-foreground">
                    {renderGemmaValue(item.quote)}
                  </blockquote>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Наш тип документа</p>
                <Select
                  value={mappings[key] || '__none'}
                  onValueChange={(value) => onChange(key, value === '__none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Не заливать</SelectItem>
                    {documentTypes.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mappings[key] && (
                  <p className="text-xs text-muted-foreground">
                    Требования будут добавлены в выбранный тип документа.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
