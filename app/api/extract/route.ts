import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { extractDocument, extractDocumentFromBuffer } from '@/lib/ai/extract';

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
      return NextResponse.json({ extracted });
    }

    // JSON path used internally for seed/demo workflows
    const { fileName, documentTypeId } = await req.json();
    if (!fileName || !documentTypeId) {
      return NextResponse.json({ error: 'fileName and documentTypeId are required' }, { status: 400 });
    }

    const safeName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'public', 'test-docs', safeName);
    const extracted = await extractDocument(filePath, documentTypeId);

    return NextResponse.json({ extracted });
  } catch (err: any) {
    console.error('Extract error:', err);
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
