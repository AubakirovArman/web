'use client';

import { FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentType } from '@/lib/types';
import { formatFileSize } from '@/lib/admin/npa-logic';
import { npaActTypeOptions, type AdminNpaDraft, type GemmaJobState, type NpaRequirementAction } from '@/lib/admin/admin-page-types';
import { NpaRequirementsTable } from '@/components/admin/npa-requirements-table';

export function NpaRegistryDialog({
  open,
  draft,
  job,
  documentTypes,
  onClose,
  onChange,
  onExtract,
  onSave,
  onAcceptAll,
  onRequirementActionChange,
  onRequirementTargetChange,
}: {
  open: boolean;
  draft: AdminNpaDraft;
  job: GemmaJobState | null;
  documentTypes: DocumentType[];
  onClose: () => void;
  onChange: (draft: AdminNpaDraft) => void;
  onExtract: () => void;
  onSave: () => void;
  onAcceptAll: () => void;
  onRequirementActionChange: (requirementId: string, action: NpaRequirementAction) => void;
  onRequirementTargetChange: (requirementId: string, targetDocumentTypeId: string) => void;
}) {
  const acceptedCount = draft.requirements.filter((requirement) => requirement.action === 'accepted').length;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[94vh] w-[98vw] max-w-[1800px] overflow-hidden p-4 sm:max-w-[98vw]">
        <DialogHeader>
          <DialogTitle>Добавить НПА</DialogTitle>
          <DialogDescription>
            Укажите реквизиты акта, загрузите Word/PDF и запустите извлечение. В реестр сохраняются найденные требования с выбранным действием.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="max-h-[72vh] overflow-y-auto rounded-xl border bg-muted/20 p-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase text-muted-foreground">Наименование НПА</label>
                <Input
                  value={draft.name}
                  onChange={(event) => onChange({ ...draft, name: event.target.value })}
                  placeholder="Например: Приказ МЗ РК № ҚР ДСМ-10"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Тип акта</label>
                  <Select value={draft.actType} onValueChange={(value) => onChange({ ...draft, actType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {npaActTypeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Номер</label>
                  <Input
                    value={draft.number}
                    onChange={(event) => onChange({ ...draft, number: event.target.value })}
                    placeholder="№"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Дата НПА</label>
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(event) => onChange({ ...draft, date: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Редакция</label>
                  <Input
                    value={draft.revision}
                    onChange={(event) => onChange({ ...draft, revision: event.target.value })}
                    placeholder="Дата/номер редакции"
                  />
                </div>
              </div>

              <label className="block cursor-pointer rounded-xl border border-dashed bg-background p-5 text-center transition hover:border-primary/50">
                <input
                  type="file"
                  className="hidden"
                  accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  onChange={(event) => onChange({ ...draft, file: event.target.files?.[0] || null, requirements: [] })}
                />
                <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                <div className="text-sm font-medium">{draft.file ? draft.file.name : 'Перетащите или выберите файл НПА'}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  DOC, DOCX или PDF{draft.file ? ` · ${formatFileSize(draft.file.size)}` : ''}
                </div>
              </label>

              <Button
                className="w-full"
                disabled={!draft.file || !draft.name.trim() || job?.status === 'running'}
                onClick={onExtract}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {job?.status === 'running' ? 'Извлечение...' : 'Запустить извлечение'}
              </Button>

              {job && (
                <div className={`rounded-xl border p-4 ${job.status === 'error' ? 'border-destructive/40 bg-destructive/5' : 'bg-background'}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
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
            </div>
          </div>

          <div className="min-h-0 rounded-xl border bg-background">
            <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Извлеченные требования</p>
                <p className="text-xs text-muted-foreground">
                  Принято: {acceptedCount} · Отклонено: {draft.requirements.length - acceptedCount}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={draft.requirements.length === 0 || job?.status === 'running'}
                  onClick={onAcceptAll}
                >
                  Принять все
                </Button>
                <Button disabled={draft.requirements.length === 0 || job?.status === 'running'} onClick={onSave}>
                  Сохранить в реестр
                </Button>
              </div>
            </div>
            <div className="max-h-[62vh] overflow-y-auto">
              <NpaRequirementsTable
                requirements={draft.requirements}
                documentTypes={documentTypes}
                onActionChange={onRequirementActionChange}
                onTargetDocumentTypeChange={onRequirementTargetChange}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

