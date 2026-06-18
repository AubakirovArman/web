import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { extractDocument, extractDocumentFromBuffer } from '@/lib/ai/extract';
import { readRuntimeUpload } from '@/lib/files/runtime-upload-store';

function buildExtractionResponse(extracted: Record<string, string>) {
  const status = extracted.extractionStatus || (Object.keys(extracted).length > 0 ? 'success' : 'partial');
  const errors = extracted.extractionErrors ? extracted.extractionErrors.split(';').map((item) => item.trim()).filter(Boolean) : [];
  return {
    extracted,
    status,
    provider: extracted.extractionProvider || 'local-parser',
    promptVersion: extracted.extractionPromptVersion || 'unknown',
    errors,
    textLayer: extracted.textLayer === 'да',
    ocrQuality: status === 'success' ? 0.92 : status === 'partial' || status === 'skipped' ? 0.55 : 0,
  };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      const documentTypeId = form.get('documentTypeId') as string | null;

      if (!file || !documentTypeId) {
        return NextResponse.json({ error: 'file and documentTypeId are required' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractDocumentFromBuffer(buffer, file.name, documentTypeId);
      return NextResponse.json(buildExtractionResponse(extracted));
    }

    // JSON path used internally for seed/demo workflows
    const { fileName, fileId, documentTypeId } = await req.json();
    if (!documentTypeId || (!fileName && !fileId)) {
      return NextResponse.json({ error: 'fileName/fileId and documentTypeId are required' }, { status: 400 });
    }

    if (fileId) {
      const { metadata, filePath } = await readRuntimeUpload(fileId);
      const buffer = await fs.readFile(filePath);
      const extracted = await extractDocumentFromBuffer(buffer, metadata.fileName, documentTypeId);
      return NextResponse.json(buildExtractionResponse(extracted));
    }

    const safeName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'public', 'test-docs', safeName);
    const extracted = await extractDocument(filePath, documentTypeId);

    return NextResponse.json(buildExtractionResponse(extracted));
  } catch (err: any) {
    console.error('Extract error:', err);
    return NextResponse.json(
      {
        extracted: {},
        status: 'failed',
        provider: 'document-parser-service',
        promptVersion: 'unknown',
        errors: [err.message || 'Extraction failed'],
        textLayer: false,
        ocrQuality: 0,
      },
      { status: 500 }
    );
  }
}
