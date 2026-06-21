import { NextRequest, NextResponse } from 'next/server';
import { getReferenceIndex, REFERENCE_DB_EMPTY } from '@/lib/reference/experiment-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const index = await getReferenceIndex();
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

    const documents = q
      ? index.documents.filter((doc) =>
          [doc.title, doc.fileName, doc.number, doc.date, doc.summaryShort, ...(doc.tags || [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : index.documents;

    return NextResponse.json(
      {
        generatedAt: index.generatedAt,
        promptVersion: index.promptVersion,
        targetCount: index.targetCount,
        processedCount: index.processedCount,
        model: index.model,
        documents,
      },
      {
        headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
      },
    );
  } catch (error) {
    const message = 'Failed to read experiment data';
    const isNotFound = message.includes(REFERENCE_DB_EMPTY);
    return NextResponse.json(
      { error: isNotFound ? 'Справочник НПА еще не загружен в базу данных' : message },
      { status: isNotFound ? 404 : 500 },
    );
  }
}
