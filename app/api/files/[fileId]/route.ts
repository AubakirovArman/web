import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { extractPlainTextFromBuffer } from '@/lib/ai/extract';
import {
  readRuntimeUpload,
  readRuntimeUploadText,
  writeRuntimeUploadText,
} from '@/lib/files/runtime-upload-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId: rawFileId } = await params;
  const wantsText = rawFileId.endsWith('.txt');
  const fileId = decodeURIComponent(wantsText ? rawFileId.slice(0, -4) : rawFileId);

  try {
    const { metadata, filePath } = await readRuntimeUpload(fileId);

    if (wantsText) {
      const cached = await readRuntimeUploadText(fileId);
      if (cached !== null) {
        return new NextResponse(cached, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }

      const buffer = await fs.readFile(filePath);
      const text = await extractPlainTextFromBuffer(buffer, metadata.fileName, metadata.contentType);
      await writeRuntimeUploadText(fileId, text);
      return new NextResponse(text, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }

    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'content-type': metadata.contentType || 'application/octet-stream',
        'content-length': String(metadata.size),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(metadata.fileName)}`,
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
