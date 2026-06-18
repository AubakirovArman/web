'use client';

import { UploadedFile } from '@/lib/types';
import { getDossierSectionById } from '@/lib/dossier/sections';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MiniMetric } from '@/components/expert/detail/application-summary';

export function DossierExpertPanel({ files }: { files: UploadedFile[] }) {
  if (files.length === 0) return null;
  const groups = groupDossierFiles(files);
  const uncertain = files.filter((file) => (file.dossierMappingConfidence || 0) < 0.45).length;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Регистрационное досье по разделам</CardTitle>
        <p className="text-sm text-muted-foreground">
          Показаны все файлы, загруженные пакетом. Раздел определяется по XLSX-реестру, имени файла и пути внутри папки.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Файлов" value={files.length} />
          <MiniMetric label="Разделов" value={groups.length} />
          <MiniMetric label="Нужно проверить вручную" value={uncertain} />
        </div>
        <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
          {groups.map((group) => (
            <details key={group.id} open={groups.length <= 5} className="rounded-lg border">
              <summary className="cursor-pointer bg-muted/40 px-3 py-2 text-sm font-medium">
                {group.code ? `${group.code} · ` : ''}{group.title} <span className="text-muted-foreground">({group.files.length})</span>
              </summary>
              <div className="divide-y">
                {group.files.map((file) => (
                  <div key={file.id} className="grid gap-2 px-3 py-2 text-xs md:grid-cols-[minmax(0,1fr)_140px_120px]">
                    <div className="min-w-0">
                      <div className="break-words font-medium">{file.name}</div>
                      <div className="break-words text-muted-foreground">{file.dossierFolderName || file.relativePath || file.originalName || 'без пути'}</div>
                    </div>
                    <div className="text-muted-foreground">{file.extension || file.name.split('.').pop() || '—'} · {(file.size / 1024).toFixed(1)} КБ</div>
                    <div className="text-muted-foreground">{Math.round((file.dossierMappingConfidence || 0) * 100)}% · {file.documentTypeId}</div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function groupDossierFiles(files: UploadedFile[]) {
  const map = new Map<string, { id: string; code?: string; title: string; files: UploadedFile[] }>();
  for (const file of files) {
    const section = getDossierSectionById(file.dossierSectionId);
    const id = section?.id || file.dossierSectionId || 'unknown';
    const title = section?.title || file.dossierSectionName || 'Неопределенный раздел';
    const code = section?.code || file.dossierSectionCode;
    if (!map.has(id)) map.set(id, { id, code, title, files: [] });
    map.get(id)!.files.push(file);
  }
  return Array.from(map.values()).sort((a, b) => (a.code || a.title).localeCompare(b.code || b.title, 'ru'));
}
