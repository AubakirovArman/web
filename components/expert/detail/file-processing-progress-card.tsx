'use client';

import { CheckCircle2, CircleDashed, FileText, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Application, UploadedFile } from '@/lib/types';

const completedExtractionStatuses = new Set(['success', 'partial', 'failed', 'skipped']);

function percent(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function isExtractionDone(file: UploadedFile) {
  const status = file.processing?.extractionStatus;
  return Boolean(status && completedExtractionStatuses.has(status));
}

function hasExtractedPayload(file: UploadedFile) {
  return Boolean(file.extracted && Object.keys(file.extracted).length > 0);
}

function statusCount(files: UploadedFile[], status: string) {
  return files.filter((file) => file.processing?.extractionStatus === status).length;
}

function bundleKey(file: UploadedFile) {
  return String(file.dossierSectionCode || file.documentTypeId || file.id)
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

export function FileProcessingProgressCard({ app }: { app: Application }) {
  const files = app.files || [];
  const total = files.length;
  const extracted = files.filter((file) => isExtractionDone(file) || hasExtractedPayload(file)).length;
  const extractionProgress = percent(extracted, total);
  const extractionFailed = statusCount(files, 'failed');
  const extractionExtracting = statusCount(files, 'extracting') + statusCount(files, 'ocr-pending');
  const extractionQueued = files.filter((file) => !isExtractionDone(file) && !hasExtractedPayload(file) && file.processing?.extractionStatus !== 'extracting' && file.processing?.extractionStatus !== 'ocr-pending').length;

  const bundleKeys = Array.from(new Set(files.map(bundleKey)));
  const bundlesTotal = bundleKeys.length;
  const bundlesWithNpaResults = new Set(files.filter((file) => (file.npaRequirementResults || []).length > 0).map(bundleKey)).size;
  const npaProgress = percent(bundlesWithNpaResults, bundlesTotal);
  const uniqueNpaResults = new Map<string, NonNullable<UploadedFile['npaRequirementResults']>[number]>();
  for (const file of files) {
    for (const result of file.npaRequirementResults || []) {
      uniqueNpaResults.set(`${result.bundleKey || bundleKey(file)}:${result.requirementId}`, result);
    }
  }
  const npaResults = Array.from(uniqueNpaResults.values());
  const npaResultsTotal = npaResults.length;
  const npaPassed = npaResults.filter((result) => result.status === 'passed').length;
  const npaFailed = npaResults.filter((result) => result.status === 'failed').length;
  const npaUncertain = npaResults.filter((result) => result.status === 'uncertain').length;
  const npaNotApplicable = npaResults.filter((result) => result.status === 'not_applicable').length;

  const overallDone = Math.min(total, Math.max(extracted, bundlesWithNpaResults));
  const overallProgress = percent(overallDone, total);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base">Прогресс обработки файлов</CardTitle>
            <p className="text-sm text-muted-foreground">
              Показывает, сколько загруженных файлов уже прошло извлечение текста/OCR и сколько файлов получили результаты НПА.
            </p>
          </div>
          <Badge variant="outline">{overallProgress}% общий прогресс</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Загружено файлов
              </div>
              <span className="font-semibold">{total}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Все файлы, приложенные к заявке.</p>
          </div>

          <div className="border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {extractionQueued > 0 || extractionExtracting > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Извлечение текста/OCR
              </div>
              <span className="font-semibold">{extracted}/{total}</span>
            </div>
            <Progress value={extractionProgress} className="mt-3 h-2" />
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">готово: {extracted}</Badge>
              {extractionExtracting > 0 && <Badge variant="secondary">в работе: {extractionExtracting}</Badge>}
              {extractionQueued > 0 && <Badge variant="secondary">осталось: {extractionQueued}</Badge>}
              {extractionFailed > 0 && <Badge variant="destructive">ошибок: {extractionFailed}</Badge>}
            </div>
          </div>

          <div className="border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {bundlesWithNpaResults > 0 ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                НПА
              </div>
              <span className="font-semibold">{bundlesWithNpaResults}/{bundlesTotal}</span>
            </div>
            <Progress value={npaProgress} className="mt-3 h-2" />
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">требований: {npaResultsTotal}</Badge>
              <Badge variant="outline">пройдено: {npaPassed}</Badge>
              {npaFailed > 0 && <Badge variant="destructive">не подтверждено: {npaFailed}</Badge>}
              {npaUncertain > 0 && <Badge variant="secondary">неясно: {npaUncertain}</Badge>}
              {npaNotApplicable > 0 && <Badge variant="outline">не применимо: {npaNotApplicable}</Badge>}
            </div>
          </div>
        </div>

        {total > 0 && extracted === total && bundlesWithNpaResults === 0 && (
          <div className="flex items-start gap-2 border bg-muted/30 p-3 text-sm text-muted-foreground">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Файлы распознаны, но автоматическая проверка НПА ещё не запускалась или для этих файлов нет привязанных требований.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
