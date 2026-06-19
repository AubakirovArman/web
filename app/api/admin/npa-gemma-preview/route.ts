import { NextRequest, NextResponse } from 'next/server';
import { getReferenceDocument } from '@/lib/reference/db';
import { readGemmaEnv } from '@/lib/admin/npa-gemma-preview/env';
import { parseUploadedNpaFile, stringFormValue } from '@/lib/admin/npa-gemma-preview/upload-parser';
import { analyzeDocumentRequirementsWithGemma, previewSummary } from '@/lib/admin/npa-gemma-preview/extraction';
import type { StructuredNpaDocument } from '@/lib/admin/npa-gemma-preview/types';

export const runtime = 'nodejs';
const PROMPT_VERSION = 'npa_ai_extraction_v2_dynamic_dependencies_8040_preview';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let document: StructuredNpaDocument;
    let sourceKind: 'reference' | 'upload' = 'reference';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
      document = await parseUploadedNpaFile(Buffer.from(await file.arrayBuffer()), file.name, {
        name: stringFormValue(form.get('name')),
        actType: stringFormValue(form.get('actType')),
        number: stringFormValue(form.get('number')),
        date: stringFormValue(form.get('date')),
        revision: stringFormValue(form.get('revision')),
      });
      sourceKind = 'upload';
    } else {
      const body = await req.json().catch(() => ({}));
      const documentId = String(body.documentId || '').trim();
      if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
      const result = await getReferenceDocument(documentId);
      if (!result) return NextResponse.json({ error: 'Reference document not found' }, { status: 404 });
      document = result.document;
    }

    const analysis = await analyzeDocumentRequirementsWithGemma(readGemmaEnv(), document);
    const extraction = analysis.extraction;
    return NextResponse.json({
      previewId: `${document.id}-${Date.now()}`,
      promptVersion: PROMPT_VERSION,
      sourceKind,
      createdAt: new Date().toISOString(),
      document: {
        id: document.id,
        title: document.title,
        domain: document.domain,
        fileName: document.fileName,
        number: document.number,
        date: document.date,
        sectionsTotal: document.sections.length,
        payloadChars: analysis.payloadChars,
        sampleSections: document.sections.slice(0, 80).map((section) => ({ id: section.id, type: section.sectionType, number: section.headingNumber, title: section.title, text: section.text.slice(0, 600) })),
      },
      extraction,
      summary: previewSummary(extraction),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'NPA preview failed' }, { status: 502 });
  }
}
