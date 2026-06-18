'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentType, DocumentTypeRequirement } from '@/lib/types';
import type { GemmaJobState, NpaGemmaPreview } from '@/lib/admin/admin-page-types';
import { buildGemmaSourceReference, renderGemmaValue } from '@/lib/admin/document-type-logic';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';
import { GemmaDocumentTypeMappingList } from '@/components/admin/gemma-document-type-mapping-list';
import { GemmaObjectList, PreviewMetric } from '@/components/admin/gemma-object-list';

export function NpaGemmaPreviewDialog({
  job,
  preview,
  documentTypes,
  onApplyMappings,
  onClose,
}: {
  job: GemmaJobState | null;
  preview: NpaGemmaPreview | null;
  documentTypes: DocumentType[];
  onApplyMappings: (preview: NpaGemmaPreview, mappings: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [documentMappings, setDocumentMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    setDocumentMappings({});
  }, [preview?.previewId]);

  const mappedCount = Object.values(documentMappings).filter(Boolean).length;

  return (
    <Dialog open={!!job || !!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[94vw] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{job?.title || 'Предпросмотр обработки НПА через Gemma'}</DialogTitle>
          <DialogDescription>
            Результат пока не записывается в правила. Это экран проверки извлеченных типов документов, требований и параметров.
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className={`rounded-xl border p-4 ${job.status === 'error' ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/20'}`}>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{job.stage}</p>
                {job.error && <p className="mt-1 text-sm text-destructive">{job.error}</p>}
              </div>
              <Badge variant={job.status === 'error' ? 'destructive' : job.status === 'done' ? 'secondary' : 'outline'}>
                {job.status === 'running' ? 'В процессе' : job.status === 'done' ? 'Готово' : 'Ошибка'}
              </Badge>
            </div>
            <Progress value={job.progress} className="h-2" />
          </div>
        )}

        {preview && (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="max-h-[68vh] overflow-y-auto rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{preview.document.domain}</Badge>
                  <Badge variant="outline">{preview.document.id}</Badge>
                  <Badge variant="outline">{preview.document.sectionsTotal} блоков</Badge>
                  <Badge variant="outline">{preview.document.payloadChars.toLocaleString('ru-RU')} символов в Gemma</Badge>
                </div>
                <p className="font-medium">{preview.document.title}</p>
                <p className="text-xs text-muted-foreground">{preview.document.fileName}</p>
              </div>
              <div className="space-y-3">
                {preview.document.sampleSections.map((section) => (
                  <div key={section.id} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{section.type || 'section'}</Badge>
                      {section.number && <Badge variant="outline">п. {section.number}</Badge>}
                    </div>
                    {section.title && <p className="text-sm font-medium">{section.title}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{section.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-h-[68vh] overflow-y-auto rounded-xl border bg-background p-4">
              <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewMetric label="Область" value={preview.summary.area} />
                <PreviewMetric label="Типы документов" value={String(preview.summary.document_types)} />
                <PreviewMetric label="Требования" value={String(preview.summary.requirements)} />
                <PreviewMetric label="Параметры" value={String(preview.summary.applicant_parameters)} />
              </div>

              <Tabs defaultValue="documents" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start gap-2">
                  <TabsTrigger value="documents">Типы документов</TabsTrigger>
                  <TabsTrigger value="requirements">Требования</TabsTrigger>
                  <TabsTrigger value="parameters">Параметры</TabsTrigger>
                  <TabsTrigger value="dependencies">Зависимости</TabsTrigger>
                  <TabsTrigger value="notes">Заметки</TabsTrigger>
                </TabsList>
                <TabsContent value="documents">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Сопоставление с нашими типами документов</p>
                        <p className="text-xs text-muted-foreground">
                          Выберите, к какому типу документа относится найденный Gemma блок, затем нажмите заливку.
                        </p>
                      </div>
                      <Button
                        disabled={!mappedCount}
                        onClick={() => preview && onApplyMappings(preview, documentMappings)}
                      >
                        Залить выбранное
                      </Button>
                    </div>
                    <GemmaDocumentTypeMappingList
                      items={preview.extraction.document_types}
                      requirements={preview.extraction.requirements}
                      documentTypes={documentTypes}
                      mappings={documentMappings}
                      onChange={(key, documentTypeId) =>
                        setDocumentMappings((current) => ({ ...current, [key]: documentTypeId }))
                      }
                    />
                  </div>
                </TabsContent>
                <TabsContent value="requirements">
                  <GemmaObjectList
                    items={preview.extraction.requirements}
                    emptyLabel="Gemma не нашла требования."
                    fields={[
                      ['document_code', 'Код документа'],
                      ['document_name', 'Документ'],
                      ['procedure', 'Процедура'],
                      ['check_type', 'Тип проверки'],
                      ['requirement_text', 'Требование'],
                      ['criticality', 'Критичность'],
                      ['applicability_condition', 'Условие'],
                      ['source_point', 'Пункт'],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="parameters">
                  <GemmaObjectList
                    items={preview.extraction.applicant_parameters}
                    emptyLabel="Gemma не нашла параметры заявки."
                    fields={[
                      ['key', 'Ключ'],
                      ['label', 'Параметр'],
                      ['value_type', 'Тип значения'],
                      ['options', 'Варианты'],
                      ['why_needed', 'Зачем нужен'],
                      ['source_point', 'Пункт'],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="dependencies">
                  <GemmaObjectList
                    items={preview.extraction.parameter_dependencies}
                    emptyLabel="Gemma не нашла зависимости параметров."
                    fields={[
                      ['conditions', 'Условия'],
                      ['logic_operator', 'Логика'],
                      ['target_kind', 'Цель'],
                      ['target_key', 'Ключ цели'],
                      ['effect_type', 'Эффект'],
                      ['effect_text', 'Описание эффекта'],
                      ['source_point', 'Пункт'],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="notes" className="space-y-3">
                  {preview.extraction.quality_notes.length === 0 && <EmptyAdminBlock text="Заметок качества нет." />}
                  {preview.extraction.quality_notes.map((note, index) => (
                    <div key={`${note}-${index}`} className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      {note}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
