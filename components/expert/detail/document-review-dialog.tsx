'use client';

import { useEffect, useState } from 'react';
import { ExpertCheckDecision, UploadedFile } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { ExpertiseStage, STAGE_LABELS, checkStage } from '@/components/expert/detail/review-stages';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Eye, FileText } from 'lucide-react';
import { DocumentReviewRow, ReviewCheckCell } from '@/components/expert/detail/review-types';
import { CheckChip, MethodBadge, SeverityBadge, StatusBadge } from '@/components/expert/detail/review-badges';

function isPreviewable(name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return ext === 'pdf' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
}

export function DocumentReviewDialog({
  row,
  decisions,
  onDecision,
  stage = 'primary',
  onClose,
}: {
  row: DocumentReviewRow;
  decisions?: Record<string, ExpertCheckDecision>;
  onDecision?: (checkKey: string, decision: ExpertCheckDecision | null) => void;
  stage?: ExpertiseStage;
  onClose: () => void;
}) {
  const primary = row.file;
  const files = row.files?.length ? row.files : primary ? [primary] : [];
  const [selectedId, setSelectedId] = useState<string>(primary?.id || files[0]?.id || '');
  const file = files.find((f) => f.id === selectedId) || primary || files[0] || null;
  // url может быть не проставлен — строим из id (контент отдаётся по /api/files/<id>)
  const fileUrl = file ? (file.url || (file.id ? `/api/files/${encodeURIComponent(file.id)}` : '')) : '';
  const [tab, setTab] = useState('checks');
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setText(null);
    if (!fileUrl) return;
    const ext = file?.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext || '')) return;
    setLoading(true);
    fetch(`${fileUrl}.txt`)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then(setText)
      .catch(() => setText(null))
      .finally(() => setLoading(false));
  }, [fileUrl, file?.name]);

  const ext = file?.name.split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  // Группы проверок текущего этапа
  const primaryFormalChecks = row.checks.filter((c) => isContentCheck(c) && checkStage(c) === 'primary');
  const technicalChecks = row.checks.filter((check) => !isContentCheck(check));
  const specializedChecks = row.checks.filter((c) => isContentCheck(c) && checkStage(c) === 'specialized');

  // если выбранный файл не превью-формат, а активна вкладка «Просмотр» — переключаемся
  useEffect(() => {
    if (tab === 'preview' && !(isPdf || isImage)) setTab(text || loading ? 'text' : 'checks');
  }, [tab, isPdf, isImage, text, loading]);

  const openFile = (id: string) => {
    setSelectedId(id);
    const f = files.find((item) => item.id === id);
    setTab(isPreviewable(f?.name) ? 'preview' : 'text');
  };

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
          {files.length > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="shrink-0 text-xs text-muted-foreground">Документ для просмотра:</span>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-8 max-w-[640px] text-sm">
                  <SelectValue placeholder="Выберите файл" />
                </SelectTrigger>
                <SelectContent>
                  {files.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-sm">{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 border-t">
          <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
            <TabsList className="mx-5 mt-3">
              <TabsTrigger value="checks">Проверки</TabsTrigger>
              {files.length > 0 && <TabsTrigger value="files">Файлы</TabsTrigger>}
              {file && (isPdf || isImage) && <TabsTrigger value="preview">Просмотр</TabsTrigger>}
              {(text || loading) && <TabsTrigger value="text">Текст</TabsTrigger>}
              {file && <TabsTrigger value="data">Данные</TabsTrigger>}
            </TabsList>
            <TabsContent value="checks" className="min-h-0 flex-1 overflow-auto p-5">
              <div className="space-y-2">
                <div className="inline-flex rounded-md border bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground">
                  Этап: {STAGE_LABELS[stage]}
                </div>
              </div>
              <div className="mt-3 space-y-5">
                {stage === 'primary' ? (
                  <>
                    <ChecksGroup
                      title={`Формальные условия по памятке (${primaryFormalChecks.length})`}
                      description="Тип документа, название ЛС, условия предоставления и сверки-консистентности с заявкой и разделами досье."
                      checks={primaryFormalChecks}
                      emptyText="Формальных условий из памятки для этого документа нет."
                      keyPrefix={row.key}
                      decisions={decisions}
                      onDecision={onDecision}
                    />
                    <ChecksGroup
                      title={`Технические проверки файла (${technicalChecks.length})`}
                      description="Автоматические проверки оболочки: наличие файла, формат, OCR/извлечение текста."
                      checks={technicalChecks}
                      emptyText="Технические проверки не применялись."
                      keyPrefix={row.key}
                      decisions={decisions}
                      onDecision={onDecision}
                    />
                  </>
                ) : (
                  <ChecksGroup
                    title={`Содержательная оценка (${specializedChecks.length})`}
                    description="Оценка требований НПА по существу (научная экспертиза содержания)."
                    checks={specializedChecks}
                    emptyText="Содержательных проверок для этого документа нет."
                    keyPrefix={row.key}
                    decisions={decisions}
                    onDecision={onDecision}
                  />
                )}
              </div>
            </TabsContent>
            {files.length > 0 && (
              <TabsContent value="files" className="min-h-0 flex-1 overflow-auto p-5">
                <div className="overflow-hidden border">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="w-[40%] px-3 py-2 font-medium">Файл</th>
                        <th className="w-[12%] px-3 py-2 font-medium">Размер</th>
                        <th className="w-[16%] px-3 py-2 font-medium">Извлечение</th>
                        <th className="w-[16%] px-3 py-2 font-medium">Код раздела</th>
                        <th className="w-[16%] px-3 py-2 text-right font-medium">Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((item) => (
                        <tr key={item.id} className={`border-t align-top ${item.id === selectedId ? 'bg-primary/5' : ''}`}>
                          <td className="break-words px-3 py-2 font-medium">
                            {item.name}
                            {item.id === selectedId && <span className="ml-2 text-xs font-normal text-primary">выбран</span>}
                          </td>
                          <td className="px-3 py-2">{(item.size / 1024).toFixed(1)} КБ</td>
                          <td className="px-3 py-2">{item.processing?.extractionStatus || 'без OCR'}</td>
                          <td className="break-words px-3 py-2">{item.dossierSectionCode || row.sectionCode || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => openFile(item.id)}>
                              <Eye className="mr-1 h-3.5 w-3.5" /> Открыть
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
            {file && isPdf && (
              <TabsContent value="preview" className="min-h-0 flex-1 p-0">
                {fileUrl ? (
                  <iframe src={fileUrl} className="h-full w-full border-0" title={file.name} />
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">Файл недоступен для предпросмотра.</p>
                )}
              </TabsContent>
            )}
            {file && isImage && (
              <TabsContent value="preview" className="min-h-0 flex-1 overflow-auto p-4">
                {fileUrl ? <img src={fileUrl} alt={file.name} className="max-w-full border" /> : <p className="text-sm text-muted-foreground">Файл недоступен.</p>}
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
          {fileUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
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

const GROUP_GRID = 'lg:grid-cols-[minmax(200px,1fr)_110px_minmax(260px,1.2fr)_minmax(240px,1fr)_minmax(300px,1.1fr)]';

function ChecksGroup({
  title,
  description,
  checks,
  emptyText,
  keyPrefix,
  decisions,
  onDecision,
}: {
  title: string;
  description: string;
  checks: ReviewCheckCell[];
  emptyText: string;
  keyPrefix?: string;
  decisions?: Record<string, ExpertCheckDecision>;
  onDecision?: (checkKey: string, decision: ExpertCheckDecision | null) => void;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden border">
        <div className={`hidden ${GROUP_GRID} bg-muted/50 text-xs font-medium uppercase text-muted-foreground lg:grid`}>
          <div className="border-r px-3 py-2">Проверка</div>
          <div className="border-r px-3 py-2">Статус</div>
          <div className="border-r px-3 py-2">Описание</div>
          <div className="border-r px-3 py-2">Замечания</div>
          <div className="px-3 py-2">Решение эксперта</div>
        </div>
        {checks.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{emptyText}</div>
        ) : checks.map((check) => {
          const checkKey = `${keyPrefix || ''}::${check.id}`;
          const decision = decisions?.[checkKey];
          return (
          <div
            key={check.id}
            className={`grid gap-3 border-t p-3 first:border-t-0 ${GROUP_GRID} lg:gap-0 lg:p-0`}
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
            <div className="max-h-72 space-y-2 overflow-auto whitespace-pre-wrap break-words text-sm text-muted-foreground lg:border-r lg:p-3">
              {check.description && <p>{check.description}</p>}
              {check.npaReferences?.length ? <p className="text-xs">Источник: {check.npaReferences.join('; ')}</p> : null}
            </div>
            <div className="max-h-72 overflow-auto break-words lg:border-r lg:p-3">
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
            <div className="lg:p-3">
              {onDecision ? (
                <DecisionControl
                  checkStatus={check.status}
                  decision={decision}
                  onChange={(value) => onDecision(checkKey, value)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}

function DecisionControl({
  checkStatus,
  decision,
  onChange,
}: {
  checkStatus: ReviewCheckCell['status'];
  decision?: ExpertCheckDecision;
  onChange: (decision: ExpertCheckDecision | null) => void;
}) {
  const [comment, setComment] = useState(decision?.comment || '');
  useEffect(() => {
    setComment(decision?.comment || '');
  }, [decision?.comment, decision?.status]);

  const isBinary = checkStatus === 'passed' || checkStatus === 'failed';
  const opposite: 'passed' | 'failed' = checkStatus === 'passed' ? 'failed' : 'passed';
  const apply = (status: 'passed' | 'failed') =>
    onChange({ status, comment: comment.trim() || undefined, decidedAt: new Date().toISOString() });

  return (
    <div className="space-y-2">
      {decision && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Решение:</span>
          <span className={`font-medium ${decision.status === 'passed' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {decision.status === 'passed' ? 'Прошёл' : 'Не прошёл'}
          </span>
          <button type="button" className="ml-auto text-muted-foreground underline hover:text-foreground" onClick={() => onChange(null)}>
            сбросить
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {isBinary ? (
          <>
            <Button
              size="sm"
              variant={decision?.status === checkStatus ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => apply(checkStatus)}
            >
              Принять
            </Button>
            <Button
              size="sm"
              variant={decision?.status === opposite ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => apply(opposite)}
            >
              Отменить
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant={decision?.status === 'passed' ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => apply('passed')}
            >
              Прошёл
            </Button>
            <Button
              size="sm"
              variant={decision?.status === 'failed' ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => apply('failed')}
            >
              Не прошёл
            </Button>
          </>
        )}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий эксперта"
        rows={2}
        className="min-h-0 text-xs"
      />
      {decision && comment.trim() !== (decision.comment || '') && (
        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => apply(decision.status)}>
          Сохранить комментарий
        </Button>
      )}
    </div>
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
