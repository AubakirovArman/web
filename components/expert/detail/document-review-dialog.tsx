'use client';

import { useEffect, useState } from 'react';
import { UploadedFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText } from 'lucide-react';
import { DocumentReviewRow, ReviewCheckCell } from '@/components/expert/detail/review-types';
import { CheckChip, MethodBadge, SeverityBadge, StatusBadge } from '@/components/expert/detail/review-badges';

export function DocumentReviewDialog({ row, onClose }: { row: DocumentReviewRow; onClose: () => void }) {
  const file = row.file;
  const files = row.files?.length ? row.files : file ? [file] : [];
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file?.url) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext || '')) return;
    setLoading(true);
    fetch(`${file.url}.txt`)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then(setText)
      .catch(() => setText(null))
      .finally(() => setLoading(false));
  }, [file]);

  const ext = file?.name.split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  const contentChecks = row.checks.filter(isContentCheck);
  const technicalChecks = row.checks.filter((check) => !isContentCheck(check));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1800px] flex-col overflow-hidden p-0 sm:max-w-[96vw] xl:max-w-[1800px]">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {row.name}
          </DialogTitle>
          <DialogDescription>
            {files.length > 0
              ? `${files.length} файл(ов) в разделе ${row.sectionCode || row.documentTypeId}. Проверки ниже относятся ко всему пакету.`
              : 'Файл не загружен'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 border-t">
          <Tabs defaultValue="checks" className="flex h-full flex-col">
            <TabsList className="mx-5 mt-3">
              <TabsTrigger value="checks">Проверки</TabsTrigger>
              {files.length > 0 && <TabsTrigger value="files">Файлы</TabsTrigger>}
              {file && (isPdf || isImage) && <TabsTrigger value="preview">Просмотр</TabsTrigger>}
              {(text || loading) && <TabsTrigger value="text">Текст</TabsTrigger>}
              {file && <TabsTrigger value="data">Данные</TabsTrigger>}
            </TabsList>
            <TabsContent value="checks" className="min-h-0 flex-1 overflow-auto p-5">
              <div className="space-y-5">
                <ChecksGroup
                  title={`Содержательные условия из БД (${contentChecks.length})`}
                  description="Это условия из БД для кода раздела. Если загружено несколько файлов, результат схлопывается по всему пакету."
                  checks={contentChecks}
                  emptyText="Для этого документа нет содержательных условий из БД."
                />
                <ChecksGroup
                  title={`Технические проверки файла (${technicalChecks.length})`}
                  description="Это автоматические проверки оболочки: наличие файла, формат, OCR/извлечение текста и технические поля."
                  checks={technicalChecks}
                  emptyText="Технические проверки не применялись."
                />
              </div>
            </TabsContent>
            {files.length > 0 && (
              <TabsContent value="files" className="min-h-0 flex-1 overflow-auto p-5">
                <div className="overflow-hidden border">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="w-[48%] px-3 py-2 font-medium">Файл</th>
                        <th className="w-[14%] px-3 py-2 font-medium">Размер</th>
                        <th className="w-[18%] px-3 py-2 font-medium">Извлечение</th>
                        <th className="w-[20%] px-3 py-2 font-medium">Код раздела</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((item) => (
                        <tr key={item.id} className="border-t align-top">
                          <td className="break-words px-3 py-2 font-medium">{item.name}</td>
                          <td className="px-3 py-2">{(item.size / 1024).toFixed(1)} КБ</td>
                          <td className="px-3 py-2">{item.processing?.extractionStatus || 'без OCR'}</td>
                          <td className="break-words px-3 py-2">{item.dossierSectionCode || row.sectionCode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
            {file && isPdf && (
              <TabsContent value="preview" className="min-h-0 flex-1 p-0">
                <iframe src={file.url} className="h-full w-full border-0" title={file.name} />
              </TabsContent>
            )}
            {file && isImage && (
              <TabsContent value="preview" className="min-h-0 flex-1 overflow-auto p-4">
                <img src={file.url} alt={file.name} className="max-w-full border" />
              </TabsContent>
            )}
            {(text || loading) && (
              <TabsContent value="text" className="min-h-0 flex-1 overflow-auto p-4">
                {loading ? <p className="text-sm text-muted-foreground">Загрузка текста…</p> : <pre className="whitespace-pre-wrap text-sm">{text}</pre>}
              </TabsContent>
            )}
            {file && (
              <TabsContent value="data" className="min-h-0 flex-1 overflow-auto p-4">
                <ExtractedData file={file} />
              </TabsContent>
            )}
          </Tabs>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/50 p-3">
          {file?.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={file.url} target="_blank" rel="noopener noreferrer" download>
                <Download className="mr-1.5 h-4 w-4" />
                Скачать
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onClose}>Закрыть</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isContentCheck(check: ReviewCheckCell) {
  return check.id.startsWith('npa-requirement-') || check.id.startsWith('fallback-gemma-');
}

function ChecksGroup({
  title,
  description,
  checks,
  emptyText,
}: {
  title: string;
  description: string;
  checks: ReviewCheckCell[];
  emptyText: string;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden border">
        <div className="hidden grid-cols-[minmax(260px,1.1fr)_150px_minmax(360px,1.6fr)_minmax(340px,1.4fr)] bg-muted/50 text-xs font-medium uppercase text-muted-foreground lg:grid">
          <div className="border-r px-3 py-2">Проверка</div>
          <div className="border-r px-3 py-2">Статус</div>
          <div className="border-r px-3 py-2">Описание</div>
          <div className="px-3 py-2">Замечания</div>
        </div>
        {checks.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{emptyText}</div>
        ) : checks.map((check) => (
          <div
            key={check.id}
            className="grid gap-3 border-t p-3 first:border-t-0 lg:grid-cols-[minmax(260px,1.1fr)_150px_minmax(360px,1.6fr)_minmax(340px,1.4fr)] lg:gap-0 lg:p-0"
          >
            <div className="flex flex-wrap items-center gap-2 lg:border-r lg:p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{check.name}</span>
                {check.method && <MethodBadge method={check.method} />}
              </div>
            </div>
            <div className="flex items-start lg:border-r lg:p-3">
              <StatusBadge status={check.status} />
            </div>
            <div className="space-y-2 text-sm text-muted-foreground lg:border-r lg:p-3">
              {check.description && <p>{check.description}</p>}
              {check.npaReferences?.length ? <p className="text-xs">Источник: {check.npaReferences.join('; ')}</p> : null}
            </div>
            <div className="lg:p-3">
              {check.findings.length > 0 ? (
                <div className="space-y-2">
                {check.findings.map((finding) => (
                  <div key={finding.id} className="border bg-muted/40 p-2 text-sm">
                    <div className="font-medium">{finding.title}</div>
                    <div className="text-muted-foreground">{finding.description}</div>
                  </div>
                ))}
                </div>
              ) : check.remark ? (
                <RemarkText value={check.remark} />
              ) : check.status === 'passed' ? (
                <p className="text-sm text-muted-foreground">Замечаний нет.</p>
              ) : (
                <RemarkText value={fallbackRemark(check)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RemarkText({ value }: { value: string }) {
  return (
    <div className="border bg-muted/40 p-2 text-sm">
      {value.split('\n').filter(Boolean).map((line, index) => (
        <p key={`${line}-${index}`} className={index === 0 ? 'font-medium' : 'mt-1 text-muted-foreground'}>
          {line}
        </p>
      ))}
    </div>
  );
}

function fallbackRemark(check: ReviewCheckCell) {
  if (check.status === 'failed') return 'Проверка не пройдена, но детальная причина не была сохранена. Требуется ручной просмотр документа.';
  if (check.status === 'warning') return 'Проверка требует внимания эксперта: автоматическая проверка не смогла подтвердить условие однозначно.';
  return 'Требование не применимо к текущей заявке или документу.';
}

function ExtractedData({ file }: { file: UploadedFile }) {
  const entries = Object.entries(file.extracted || {});
  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3">
        <Meta label="Hash" value={file.hash} />
        <Meta label="Статус извлечения" value={file.processing?.extractionStatus} />
        <Meta label="OCR качество" value={file.ocrQuality ? `${Math.round(file.ocrQuality * 100)}%` : undefined} />
      </div>
      <Separator />
      {entries.length === 0 ? (
        <p className="border bg-muted/40 p-4 text-sm text-muted-foreground">Извлечённые поля отсутствуют.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="border p-2">
              <p className="text-xs uppercase text-muted-foreground">{key}</p>
              <p className="break-words text-sm">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border bg-muted/30 p-2">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="break-all text-sm">{value || '—'}</p>
    </div>
  );
}
