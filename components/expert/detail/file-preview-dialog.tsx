'use client';

import { useEffect, useState } from 'react';
import { UploadedFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText } from 'lucide-react';

export function FilePreviewDialog({ file, onClose }: { file: UploadedFile; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ext = file.name.split('.').pop()?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  // url может быть не проставлен (например, у файлов досье) — строим из id
  const url = file.url || (file.id ? `/api/files/${encodeURIComponent(file.id)}` : '');

  useEffect(() => {
    setText(null);
    if (!url) return;
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext || '')) return;
    setLoading(true);
    fetch(`${url}.txt`)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then(setText)
      .catch(() => setText(null))
      .finally(() => setLoading(false));
  }, [url, ext]);

  const defaultTab = isPdf || isImage ? 'preview' : 'text';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1600px] flex-col overflow-hidden p-0 sm:max-w-[96vw] xl:max-w-[1600px]">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {file.name}
          </DialogTitle>
          <DialogDescription>
            {(file.size / 1024).toFixed(1)} КБ · {file.processing?.extractionStatus || 'без OCR'}
            {file.dossierSectionCode ? ` · раздел ${file.dossierSectionCode}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 border-t">
          <Tabs defaultValue={defaultTab} className="flex h-full flex-col">
            <TabsList className="mx-5 mt-3">
              {(isPdf || isImage) && <TabsTrigger value="preview">Просмотр</TabsTrigger>}
              {(text || loading) && <TabsTrigger value="text">Текст</TabsTrigger>}
            </TabsList>
            {isPdf && (
              <TabsContent value="preview" className="min-h-0 flex-1 p-0">
                {url ? (
                  <iframe src={url} className="h-full w-full border-0" title={file.name} />
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">Файл недоступен для предпросмотра.</p>
                )}
              </TabsContent>
            )}
            {isImage && (
              <TabsContent value="preview" className="min-h-0 flex-1 overflow-auto p-4">
                {url ? <img src={url} alt={file.name} className="max-w-full border" /> : <p className="text-sm text-muted-foreground">Файл недоступен.</p>}
              </TabsContent>
            )}
            {(text || loading) && (
              <TabsContent value="text" className="min-h-0 flex-1 overflow-auto p-4">
                {loading ? <p className="text-sm text-muted-foreground">Загрузка текста…</p> : <pre className="whitespace-pre-wrap text-sm">{text}</pre>}
              </TabsContent>
            )}
            {!isPdf && !isImage && !text && !loading && (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Предпросмотр для этого формата недоступен. Скачайте файл, чтобы открыть его.
              </div>
            )}
          </Tabs>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/50 p-3">
          {url && (
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer" download>
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
