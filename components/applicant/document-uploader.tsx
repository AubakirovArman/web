'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { documentTypes } from '@/lib/data/seed';
import { DocumentType, FileProcessingStatus, UploadedFile } from '@/lib/types';
import { Upload, X, FileText, AlertCircle, Loader2, HelpCircle } from 'lucide-react';

type UploadInput = Omit<UploadedFile, 'id'> & Partial<Pick<UploadedFile, 'id'>>;

interface DocumentUploaderProps {
  documentTypeId: string;
  files: UploadedFile[];
  documentTypesCatalog?: DocumentType[];
  requirementMeta?: {
    code?: string;
    section?: string;
    requiredness?: string;
    trigger?: string;
    linkedParams?: string[];
    source?: string;
    checks?: string[];
    severity?: string;
  };
  onUpload: (file: UploadInput) => void;
  onRemove: (fileId: string) => void;
}

interface ExtractApiResult {
  extracted: Record<string, string>;
  status: FileProcessingStatus;
  provider?: string;
  promptVersion?: string;
  errors: string[];
  textLayer?: boolean;
  ocrQuality?: number;
}

interface UploadApiResult {
  fileId?: string;
  url?: string;
  error?: string;
}

async function uploadRuntimeFile(file: File): Promise<UploadApiResult> {
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/files', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) return { error: data?.error || `HTTP ${res.status}` };
    return { fileId: data.fileId, url: data.url };
  } catch {
    return { error: 'Upload request failed' };
  }
}

async function extractFields(fileId: string, documentTypeId: string): Promise<ExtractApiResult> {
  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, documentTypeId }),
    });
    if (!res.ok) {
      return { extracted: {}, status: 'failed', errors: [`HTTP ${res.status}`] };
    }
    const data = await res.json();
    return {
      extracted: data.extracted || {},
      status: data.status || 'partial',
      provider: data.provider,
      promptVersion: data.promptVersion,
      errors: data.errors || [],
      textLayer: data.textLayer,
      ocrQuality: data.ocrQuality,
    };
  } catch {
    return { extracted: {}, status: 'failed', errors: ['Extraction request failed'] };
  }
}

function readAsDataUrl(file: File): Promise<string | undefined> {
  if (file.size > 4 * 1024 * 1024) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

async function sha256(file: File): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function DocumentUploader({ documentTypeId, files, documentTypesCatalog, requirementMeta, onUpload, onRemove }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const docType = documentTypesCatalog?.find((d) => d.id === documentTypeId) ||
    documentTypes.find((d) => d.id === documentTypeId) || {
      id: documentTypeId,
      name: documentTypeId,
      acceptedFormats: ['pdf', 'doc', 'docx'],
      direction: 'LS' as const,
    };
  const accepted = docType.acceptedFormats.map((ext) => `.${ext}`).join(',');
  const sectionCode = requirementMeta?.code || docType.docCode || docType.importedRequirements?.[0]?.sourceDocumentCode;
  const sectionName = requirementMeta?.section || docType.modulePart;
  const [extracting, setExtracting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    for (const file of Array.from(selected)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!docType.acceptedFormats.includes(ext)) {
        setFormatError(`Файл «${file.name}» не принят. Для «${docType.name}» допустимы: ${docType.acceptedFormats.join(', ')}.`);
        continue;
      }

      setFormatError(null);
      setExtracting(true);
      const startedAt = new Date().toISOString();
      const upload = await uploadRuntimeFile(file);
      if (!upload.fileId || !upload.url) {
        setExtracting(false);
        setFormatError(`Не удалось сохранить файл «${file.name}» на сервере: ${upload.error || 'неизвестная ошибка'}.`);
        continue;
      }

      const [extraction, previewUrl, hash] = await Promise.all([
        extractFields(upload.fileId, documentTypeId),
        readAsDataUrl(file),
        sha256(file),
      ]);
      setExtracting(false);

      onUpload({
        id: upload.fileId,
        name: file.name,
        size: file.size,
        documentTypeId,
        contentType: file.type || 'application/octet-stream',
        dossierSectionCode: sectionCode,
        dossierSectionName: docType.name,
        dossierFolderName: sectionName,
        extracted: extraction.extracted,
        url: upload.url || previewUrl,
        hash,
        extension: ext,
        mime: file.type || 'application/octet-stream',
        uploadedAt: startedAt,
        version: 1,
        textLayer: extraction.textLayer,
        ocrQuality: extraction.ocrQuality,
        processing: {
          ocrStatus: docType.needsOcr ? extraction.status : 'skipped',
          extractionStatus: extraction.status,
          provider: extraction.provider,
          parser: 'browser-upload',
          promptVersion: extraction.promptVersion,
          startedAt,
          finishedAt: new Date().toISOString(),
          errors: extraction.errors,
          textLayer: extraction.textLayer,
          ocrQuality: extraction.ocrQuality,
        },
      });
    }
    e.target.value = '';
  };

  return (
    <Card data-testid={`document-uploader-${documentTypeId}`} className={files.length > 0 ? 'border-primary/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">{docType.name}</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {sectionCode && <Badge variant="secondary">{sectionCode}</Badge>}
              {sectionName && <Badge variant="outline">{sectionName}</Badge>}
              {requirementMeta?.severity && <Badge variant="outline">{severityLabel(requirementMeta.severity)}</Badge>}
              {files.length > 0 && <Badge variant="outline">{files.length} файл(ов)</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">Форматы: {docType.acceptedFormats.join(', ')}</p>
            {docType.requiredLanguages?.length ? (
              <p className="text-xs text-muted-foreground">Язык: {docType.requiredLanguages.join(', ')}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {requirementMeta && <RequirementInfoPopover requirementMeta={requirementMeta} />}
            <input ref={inputRef} type="file" accept={accepted} className="hidden" onChange={handleChange} multiple />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={extracting}>
              {extracting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {extracting ? 'Извлечение…' : 'Загрузить'}
            </Button>
          </div>
        </div>
      </CardHeader>
      {formatError && (
        <CardContent className="pt-0">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formatError}</span>
          </div>
        </CardContent>
      )}
      {files.length > 0 && (
        <CardContent className="space-y-2 pt-0">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">({formatSize(file.size)})</span>
                {file.extracted && Object.keys(file.extracted).length > 0 && (
                  <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                    извлечено
                  </span>
                )}
                {file.processing?.extractionStatus && (
                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                    {statusLabel(file.processing.extractionStatus)}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onRemove(file.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      )}
      {files.length === 0 && (
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Документ не загружен</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function RequirementInfoPopover({ requirementMeta }: { requirementMeta: NonNullable<DocumentUploaderProps['requirementMeta']> }) {
  const hasInfo = Boolean(
    requirementMeta.requiredness ||
      requirementMeta.trigger ||
      requirementMeta.linkedParams?.length ||
      requirementMeta.checks?.length ||
      requirementMeta.source,
  );
  if (!hasInfo) return null;

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-label="Показать условия и требования к документу"
        className="flex h-8 w-8 items-center justify-center border bg-background text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute right-0 top-9 z-50 hidden max-h-[70vh] w-[720px] max-w-[calc(100vw-2rem)] overflow-y-auto border bg-popover p-4 text-xs text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
        <div className="space-y-3">
          {requirementMeta.requiredness && (
            <InfoBlock title="Почему нужен" text={requirementMeta.requiredness} />
          )}
          {requirementMeta.trigger && (
            <InfoBlock title="Условие отображения" text={requirementMeta.trigger} />
          )}
          {requirementMeta.linkedParams?.length ? (
            <div>
              <div className="mb-1 font-medium text-foreground">Связанные параметры заявки</div>
              <div className="flex flex-wrap gap-1">
                {requirementMeta.linkedParams.map((param) => (
                  <span key={param} className="border bg-background px-2 py-0.5 text-muted-foreground">
                    {param}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {requirementMeta.checks?.length ? (
            <div>
              <div className="mb-1 font-medium text-foreground">Что проверяется</div>
              <ul className="space-y-1 text-muted-foreground">
                {requirementMeta.checks.map((check) => (
                  <li key={check} className="whitespace-pre-wrap break-words">- {check}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {requirementMeta.source && (
            <InfoBlock title="Источник" text={requirementMeta.source} />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 font-medium text-foreground">{title}</div>
      <div className="whitespace-pre-wrap break-words text-muted-foreground">{text}</div>
    </div>
  );
}

function statusLabel(status: FileProcessingStatus) {
  const labels: Record<FileProcessingStatus, string> = {
    queued: 'в очереди',
    extracting: 'извлечение',
    'ocr-pending': 'OCR',
    success: 'готово',
    partial: 'частично',
    failed: 'ошибка',
    skipped: 'без OCR',
  };
  return labels[status];
}

function severityLabel(value: string) {
  const labels: Record<string, string> = {
    critical: 'Критично',
    serious: 'Серьезно',
    warning: 'Предупреждение',
    unknown: 'Неизвестно',
  };
  return labels[value] || value;
}

function shortCheckLabel(value: string) {
  const labels: Record<string, string> = {
    required_document_presence_check: 'наличие',
    file_format_check: 'формат',
    ocr_quality_check: 'OCR',
    docx_format_check: 'DOCX',
    core_field_consistency_check: 'сверка с заявкой',
    shelf_life_consistency_check: 'срок годности',
    storage_consistency_check: 'хранение',
    translation_length_check: 'перевод',
  };
  return labels[value] || value;
}

function compactText(value: string, limit: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
