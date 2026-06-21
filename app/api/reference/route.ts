import { NextRequest, NextResponse } from 'next/server';
import { listReferenceDocuments } from '@/lib/reference/db';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  try {
    const result = await listReferenceDocuments({
      q: searchParams.get('q') || '',
      domain: (searchParams.get('domain') as 'LS' | 'MI' | 'all') || 'all',
      kind: searchParams.get('kind') || 'all',
      limit: Number(searchParams.get('limit') || 80),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Reference database is unavailable',
        hint: 'Run npm run reference:db:start && npm run reference:db:ingest',
      },
      { status: 503 }
    );
  }
}
