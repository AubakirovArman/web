import { NextRequest, NextResponse } from 'next/server';
import { getReferenceDocument } from '@/lib/reference/experiment-store';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const doc = await getReferenceDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json(doc, {
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read experiment data' },
      { status: 500 },
    );
  }
}
