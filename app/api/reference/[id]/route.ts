import { NextRequest, NextResponse } from 'next/server';
import { getReferenceDocument } from '@/lib/reference/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await getReferenceDocument(id);
    if (!result) {
      return NextResponse.json({ error: 'Reference document not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Reference database is unavailable',
        hint: 'Run npm run reference:db:start && npm run reference:db:ingest',
      },
      { status: 503 }
    );
  }
}
