'use client';

import JSZip from 'jszip';
import { useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { AlertCircle, FileArchive, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react';
import { Application, UploadedFile } from '@/lib/types';
import { guessDossierSection, getDossierSectionById } from '@/lib/dossier/sections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface RegistryEntry {
  fileId: string;
  fileName: string;
  folderName?: string;
}

interface DossierFolderUploaderProps {
  app: Application;
  onUpload: (files: Omit<UploadedFile, 'id'>[]) => void;
  onRemove: (fileId: string) => void;
  onRemoveMany: (fileIds: string[]) => void;
}

const directoryInputProps = {
  webkitdirectory: '',
  directory: '',
} as InputHTMLAttributes<HTMLInputElement> & { webkitdirectory: string; directory: string };

export function DossierFolderUploader({ app, onUpload, onRemove, onRemoveMany }: DossierFolderUploaderProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const registryInputRef = useRef<HTMLInputElement>(null);
  const [registry, setRegistry] = useState<Record<string, RegistryEntry>>({});
  const [registryName, setRegistryName] = useState<string>('');
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const objectType = app.values['param-object-type'] === 'MI' ? 'MI' : 'LS';
  const dossierFiles = app.files.filter((file) => file.source === 'dossier-folder' || file.dossierSectionId);
  const registryCount = Object.keys(registry).length;
  const groups = useMemo(() => groupDossierFiles(dossierFiles), [dossierFiles]);
  const confidentCount = dossierFiles.filter((file) => (file.dossierMappingConfidence || 0) >= 0.55).length;
  const progress = dossierFiles.length ? Math.round((confidentCount / dossierFiles.length) * 100) : 0;

  const handleRegistryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadingRegistry(true);
    setRegistryError(null);
    try {
      const parsed = await parseRegistryFile(file);
      setRegistry(parsed);
      setRegistryName(file.name);
    } catch (error) {
      setRegistry({});
      setRegistryName('');
      setRegistryError(error instanceof Error ? error.message : 'Не удалось прочитать XLSX-реестр.');
    } finally {
      setLoadingRegistry(false);
      event.target.value = '';
    }
  };

  const handleFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length === 0) return;
    setLoadingFiles(true);
    try {
      const mapped = selected
        .filter((file) => !isRegistryLikeFile(file.name))
        .map((file) => buildDossierFile(file, objectType, registry));
      if (mapped.length > 0) onUpload(mapped);
    } finally {
      setLoadingFiles(false);
      event.target.value = '';
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileArchive className="h-4 w-4" />
              Регистрационное досье целиком
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Загрузите папку или набор файлов. Если файлы названы ID, сначала добавьте XLSX-реестр имен, он используется только локально в браузере.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={registryInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleRegistryChange} />
            <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFilesChange} {...directoryInputProps} />
            <input ref={filesInputRef} type="file" multiple className="hidden" onChange={handleFilesChange} />
            <Button variant="outline" size="sm" onClick={() => registryInputRef.current?.click()} disabled={loadingRegistry}>
              {loadingRegistry ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              XLSX-реестр
            </Button>
            <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()} disabled={loadingFiles}>
              {loadingFiles ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-1.5 h-4 w-4" />}
              Выбрать папку
            </Button>
            <Button variant="outline" size="sm" onClick={() => filesInputRef.current?.click()} disabled={loadingFiles}>
              Выбрать файлы
            </Button>
            {dossierFiles.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onRemoveMany(dossierFiles.map((file) => file.id))}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Очистить досье
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Файлов досье" value={dossierFiles.length} />
          <Metric label="Разделов" value={groups.length} />
          <Metric label="Уверенно сопоставлено" value={`${confidentCount}/${dossierFiles.length || 0}`} />
          <Metric label="Записей реестра" value={registryCount} />
        </div>
        <Progress value={progress} />
        {registryName && (
          <div className="rounded-lg border bg-background/70 p-3 text-sm">
            Реестр подключен: <span className="font-medium">{registryName}</span>. Найдено записей: {registryCount}.
          </div>
        )}
        {registryError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{registryError}</span>
          </div>
        )}
        {dossierFiles.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
            Досье пока не загружено. Для реальных пакетов Kelun/Farm Style используйте XLSX-реестр, затем выберите папку заявки.
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {groups.map((group) => (
              <details key={group.id} open={groups.length <= 4} className="rounded-lg border bg-background/80">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  {group.title} <span className="text-muted-foreground">({group.files.length})</span>
                </summary>
                <div className="space-y-1 border-t p-2">
                  {group.files.map((file) => (
                    <div key={file.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{file.name}</div>
                        <div className="truncate text-muted-foreground">
                          {file.dossierFolderName || file.relativePath || 'без пути'} · {formatSize(file.size)} · уверенность {Math.round((file.dossierMappingConfidence || 0) * 100)}%
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onRemove(file.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildDossierFile(file: File, objectType: 'LS' | 'MI', registry: Record<string, RegistryEntry>): Omit<UploadedFile, 'id'> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const stem = file.name.replace(/\.[^.]+$/, '');
  const registryEntry = registry[registryKey(stem)];
  const relativePath = file.webkitRelativePath || file.name;
  const classifierText = [registryEntry?.folderName, registryEntry?.fileName, relativePath, extension].filter(Boolean).join(' ');
  const displayName = registryEntry?.fileName || file.name;
  const guess = guessDossierSection(objectType, classifierText, displayName);
  const uploadedAt = new Date().toISOString();

  return {
    name: displayName,
    originalName: file.name,
    size: file.size,
    documentTypeId: guess.documentTypeId,
    contentType: file.type || 'application/octet-stream',
    source: 'dossier-folder',
    relativePath,
    dossierSectionId: guess.section.id,
    dossierSectionCode: guess.section.code,
    dossierSectionName: guess.section.title,
    dossierFolderName: registryEntry?.folderName,
    dossierMappingConfidence: guess.confidence,
    dossierMappingReason: guess.reason,
    extracted: {},
    extension,
    mime: file.type || 'application/octet-stream',
    uploadedAt,
    version: 1,
    processing: {
      ocrStatus: 'queued',
      extractionStatus: 'skipped',
      parser: 'browser-dossier-metadata',
      provider: 'local',
      startedAt: uploadedAt,
      finishedAt: uploadedAt,
      errors: [],
    },
  };
}

async function parseRegistryFile(file: File): Promise<Record<string, RegistryEntry>> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Поддерживается только XLSX-реестр.');
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (!sheetFile) throw new Error('В XLSX не найден первый лист.');

  const sharedStrings = await readSharedStrings(zip);
  const sheetXml = await sheetFile.async('text');
  const rows = parseSheetRows(sheetXml, sharedStrings);
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell).includes('id файла')));
  if (headerIndex < 0) throw new Error('В реестре не найдена колонка ID файла.');

  const headers = rows[headerIndex].map(normalizeHeader);
  const fileIdIndex = findHeaderIndex(headers, ['id файла']);
  const fileNameIndex = findHeaderIndex(headers, ['наименование файла', 'название файла']);
  const folderNameIndex = findHeaderIndex(headers, ['наименование папки', 'название папки']);
  if (fileIdIndex < 0 || fileNameIndex < 0) {
    throw new Error('В реестре должны быть колонки ID файла и Наименование файла.');
  }

  const result: Record<string, RegistryEntry> = {};
  for (const row of rows.slice(headerIndex + 1)) {
    const fileId = row[fileIdIndex]?.trim();
    const fileName = row[fileNameIndex]?.trim();
    if (!fileId || !fileName) continue;
    result[registryKey(fileId)] = {
      fileId,
      fileName,
      folderName: folderNameIndex >= 0 ? row[folderNameIndex]?.trim() : undefined,
    };
  }
  return result;
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const xml = await file.async('text');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map((item) =>
    Array.from(item.getElementsByTagName('t'))
      .map((part) => part.textContent || '')
      .join('')
  );
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('row')).map((row) => {
    const cells = Array.from(row.getElementsByTagName('c'));
    const values: string[] = [];
    for (const cell of cells) {
      const ref = cell.getAttribute('r') || '';
      const index = columnIndex(ref.replace(/\d+/g, ''));
      values[index] = readCellValue(cell, sharedStrings);
    }
    return values.map((value) => value || '');
  });
}

function readCellValue(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    return Array.from(cell.getElementsByTagName('t'))
      .map((part) => part.textContent || '')
      .join('');
  }
  const value = cell.getElementsByTagName('v')[0]?.textContent || '';
  if (type === 's') return sharedStrings[Number(value)] || '';
  return value;
}

function columnIndex(column: string) {
  return column.split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function findHeaderIndex(headers: string[], variants: string[]) {
  return headers.findIndex((header) => variants.some((variant) => header.includes(normalizeHeader(variant))));
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function registryKey(value: string) {
  return value.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

function isRegistryLikeFile(name: string) {
  const normalized = normalizeHeader(name);
  return normalized.endsWith('.xlsx') && normalized.includes('назван') && normalized.includes('id');
}

function groupDossierFiles(files: UploadedFile[]) {
  const map = new Map<string, { id: string; title: string; files: UploadedFile[] }>();
  for (const file of files) {
    const section = getDossierSectionById(file.dossierSectionId);
    const id = section?.id || file.dossierSectionId || 'unknown';
    const title = section?.title || file.dossierSectionName || 'Неопределенный раздел';
    if (!map.has(id)) map.set(id, { id, title, files: [] });
    map.get(id)!.files.push(file);
  }
  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
