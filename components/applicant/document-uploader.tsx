'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { documentTypes } from '@/lib/data/seed';
import { UploadedFile } from '@/lib/types';
import { Upload, X, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface DocumentUploaderProps {
  documentTypeId: string;
  files: UploadedFile[];
  onUpload: (file: Omit<UploadedFile, 'id'>) => void;
  onRemove: (fileId: string) => void;
}

async function extractFields(file: File, documentTypeId: string): Promise<Record<string, string>> {
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('documentTypeId', documentTypeId);
    const res = await fetch('/api/extract', { method: 'POST', body: form });
    if (!res.ok) return {};
    const data = await res.json();
    return data.extracted || {};
  } catch {
    return {};
  }
}

export function DocumentUploader({ documentTypeId, files, onUpload, onRemove }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const docType = documentTypes.find((d) => d.id === documentTypeId)!;
  const accepted = docType.acceptedFormats.map((ext) => `.${ext}`).join(',');
  const [extracting, setExtracting] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    for (const file of Array.from(selected)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!docType.acceptedFormats.includes(ext)) continue;

      setExtracting(true);
      const extracted = await extractFields(file, documentTypeId);
      setExtracting(false);

      onUpload({
        name: file.name,
        size: file.size,
        documentTypeId,
        contentType: file.type || 'application/octet-stream',
        extracted,
      });
    }
    e.target.value = '';
  };

  return (
    <Card className={files.length > 0 ? 'border-primary/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">{docType.name}</CardTitle>
            <p className="text-xs text-muted-foreground">Форматы: {docType.acceptedFormats.join(', ')}</p>
          </div>
          <input ref={inputRef} type="file" accept={accepted} className="hidden" onChange={handleChange} multiple={false} />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={extracting}>
            {extracting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            {extracting ? 'Извлечение…' : 'Загрузить'}
          </Button>
        </div>
      </CardHeader>
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
