'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { ObjectType, UploadedFile } from '@/lib/types';
import { getDossierSectionById, getDossierSections } from '@/lib/dossier/sections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MiniMetric } from '@/components/expert/detail/application-summary';
import { FilePreviewDialog } from '@/components/expert/detail/file-preview-dialog';

interface DossierGroup {
  id: string;
  code?: string;
  title: string;
  files: UploadedFile[];
}

export function DossierExpertPanel({ files, objectType }: { files: UploadedFile[]; objectType?: ObjectType }) {
  const groups = groupDossierFiles(files, objectType);
  const loadedCount = groups.filter((group) => group.files.length > 0).length;
  const uncertain = files.filter((file) => (file.dossierMappingConfidence || 0) < 0.45).length;
  const [preview, setPreview] = useState<UploadedFile | null>(null);

  return (
    <>
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Регистрационное досье по разделам</CardTitle>
        <p className="text-sm text-muted-foreground">
          Показаны все разделы досье; для каждого видно, загружены ли файлы. Раздел определяется по XLSX-реестру, имени файла и пути внутри папки.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Файлов" value={files.length} />
          <MiniMetric label="Разделов с файлами" value={`${loadedCount} / ${groups.length}`} />
          <MiniMetric label="Нужно проверить вручную" value={uncertain} />
        </div>
        <div className="max-h-[600px] space-y-2 overflow-auto pr-1">
          {groups.map((group) => {
            const empty = group.files.length === 0;
            return (
              <details key={group.id} open={!empty && loadedCount <= 5} className="rounded-lg border">
                <summary className={`cursor-pointer px-3 py-2 text-sm font-medium ${empty ? 'bg-muted/20 text-muted-foreground' : 'bg-muted/40'}`}>
                  {group.code ? `${group.code} · ` : ''}{group.title}{' '}
                  {empty ? (
                    <span className="text-xs font-normal text-muted-foreground">— не загружен</span>
                  ) : (
                    <span className="text-muted-foreground">({group.files.length})</span>
                  )}
                </summary>
                <div className="divide-y">
                  {empty ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Файлы по этому разделу не загружены.</div>
                  ) : group.files.map((file) => (
                    <div key={file.id} className="grid items-center gap-2 px-3 py-2 text-xs md:grid-cols-[minmax(0,1fr)_140px_120px_104px]">
                      <div className="min-w-0">
                        <div className="break-words font-medium">{file.name}</div>
                        <div className="break-words text-muted-foreground">{file.dossierFolderName || file.relativePath || file.originalName || 'без пути'}</div>
                      </div>
                      <div className="text-muted-foreground">{file.extension || file.name.split('.').pop() || '—'} · {(file.size / 1024).toFixed(1)} КБ</div>
                      <div className="text-muted-foreground">{Math.round((file.dossierMappingConfidence || 0) * 100)}% · {file.documentTypeId}</div>
                      <div className="md:text-right">
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreview(file)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Просмотр
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </CardContent>
    </Card>
    {preview && <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function groupDossierFiles(files: UploadedFile[], objectType?: ObjectType): DossierGroup[] {
  const map = new Map<string, DossierGroup>();

  // Сначала добавляем ВСЕ разделы каталога (чтобы пустые тоже отображались)
  if (objectType) {
    for (const section of getDossierSections(objectType)) {
      map.set(section.id, { id: section.id, code: section.code, title: section.title, files: [] });
    }
  }

  for (const file of files) {
    const section = getDossierSectionById(file.dossierSectionId);
    const id = section?.id || file.dossierSectionId || 'unknown';
    const title = section?.title || file.dossierSectionName || 'Неопределенный раздел';
    const code = section?.code || file.dossierSectionCode;
    if (!map.has(id)) map.set(id, { id, code, title, files: [] });
    map.get(id)!.files.push(file);
  }

  return Array.from(map.values()).sort((a, b) => {
    // непустые разделы выше, затем по коду/названию
    if ((a.files.length > 0) !== (b.files.length > 0)) return a.files.length > 0 ? -1 : 1;
    return (a.code || a.title).localeCompare(b.code || b.title, 'ru');
  });
}
