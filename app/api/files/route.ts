import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runtimeFileUrl, writeRuntimeUploadBuffer } from '@/lib/files/runtime-upload-store';
import { checkUploadFile } from '@/lib/api/upload-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const requestedFileId = form.get('fileId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    const uploadError = checkUploadFile(file);
    if (uploadError) return uploadError;

    const fileId = requestedFileId || randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await writeRuntimeUploadBuffer(fileId, buffer, {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    });

    return NextResponse.json({
      fileId,
      url: runtimeFileUrl(fileId),
      metadata,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to upload file' }, { status: 500 });
  }
}
