'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { documentTypes } from '@/lib/data/seed';
import { FileProcessingStatus, UploadedFile } from '@/lib/types';
import { Upload, X, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface DocumentUploaderProps {
  documentTypeId: string;
  files: UploadedFile[];
  onUpload: (file: Omit<UploadedFile, 'id'>) => void;
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

async function extractFields(file: File, documentTypeId: string): Promise<ExtractApiResult> {
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('documentTypeId', documentTypeId);
    const res = await fetch('/api/extract', { method: 'POST', body: form });
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

export function DocumentUploader({ documentTypeId, files, onUpload, onRemove }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const docType = documentTypes.find((d) => d.id === documentTypeId)!;
  const accepted = docType.acceptedFormats.map((ext) => `.${ext}`).join(',');
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
      const [extraction, url, hash] = await Promise.all([
        extractFields(file, documentTypeId),
        readAsDataUrl(file),
        sha256(file),
      ]);
      setExtracting(false);

      onUpload({
        name: file.name,
        size: file.size,
        documentTypeId,
        contentType: file.type || 'application/octet-stream',
        extracted: extraction.extracted,
        url,
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
            <p className="text-xs text-muted-foreground">Форматы: {docType.acceptedFormats.join(', ')}</p>
            {docType.requiredLanguages?.length ? (
              <p className="text-xs text-muted-foreground">Язык: {docType.requiredLanguages.join(', ')}</p>
            ) : null}
          </div>
          <input ref={inputRef} type="file" accept={accepted} className="hidden" onChange={handleChange} multiple={false} />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={extracting}>
            {extracting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            {extracting ? 'Извлечение…' : 'Загрузить'}
          </Button>
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
