import { promises as fs } from 'fs';
import path from 'path';

export interface RuntimeUploadMetadata {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  storedName: string;
  createdAt: string;
}

const UPLOADS_DIR = '/tmp/ndda-8040-uploads';

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file';
}

function uploadDir(fileId: string): string {
  return path.join(UPLOADS_DIR, safeSegment(fileId));
}

function metadataPath(fileId: string): string {
  return path.join(uploadDir(fileId), 'metadata.json');
}

export function runtimeFileUrl(fileId: string): string {
  return `/api/files/${encodeURIComponent(fileId)}`;
}

export async function writeRuntimeUploadBuffer(
  fileId: string,
  buffer: Buffer,
  metadata: Omit<RuntimeUploadMetadata, 'id' | 'storedName' | 'createdAt' | 'size'>
): Promise<RuntimeUploadMetadata> {
  const dir = uploadDir(fileId);
  const storedName = safeSegment(metadata.fileName);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, storedName), buffer);

  const record: RuntimeUploadMetadata = {
    id: fileId,
    storedName,
    size: buffer.length,
    createdAt: new Date().toISOString(),
    ...metadata,
  };

  await fs.writeFile(metadataPath(fileId), JSON.stringify(record, null, 2), 'utf8');
  return record;
}

export async function readRuntimeUpload(fileId: string): Promise<{
  metadata: RuntimeUploadMetadata;
  filePath: string;
  textPath: string;
}> {
  const metadataRaw = await fs.readFile(metadataPath(fileId), 'utf8');
  const metadata = JSON.parse(metadataRaw) as RuntimeUploadMetadata;
  const dir = uploadDir(fileId);
  return {
    metadata,
    filePath: path.join(dir, metadata.storedName),
    textPath: path.join(dir, `${metadata.storedName}.txt`),
  };
}

export async function readRuntimeUploadText(fileId: string): Promise<string | null> {
  const { textPath } = await readRuntimeUpload(fileId);
  try {
    return await fs.readFile(textPath, 'utf8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeRuntimeUploadText(fileId: string, text: string): Promise<void> {
  const { textPath } = await readRuntimeUpload(fileId);
  await fs.writeFile(textPath, text, 'utf8');
}
