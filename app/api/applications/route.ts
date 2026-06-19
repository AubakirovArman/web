import { NextRequest, NextResponse } from 'next/server';
import { readApplicationSummaries, upsertApplication, writeApplications } from '@/lib/applications/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APPLICATIONS_CLIENT_VERSION = 'postgres-only-v2';

function rejectStaleClient(request: NextRequest) {
  if (request.headers.get('x-ndda-client-version') === APPLICATIONS_CLIENT_VERSION) return null;
  return NextResponse.json(
    { error: 'Stale applications client rejected. Refresh the page to use the Postgres-only client.' },
    { status: 409 },
  );
}

export async function GET() {
  try {
    // List view only needs metadata + finding counts, not per-file extracted text.
    const applications = await readApplicationSummaries();
    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('Applications GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to read applications' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const staleClientResponse = rejectStaleClient(request);
    if (staleClientResponse) return staleClientResponse;
    if (request.headers.get('x-ndda-bulk-write') !== 'true') {
      return NextResponse.json(
        { error: 'Bulk application overwrite is disabled. Use POST for a single application or pass x-ndda-bulk-write=true intentionally.' },
        { status: 409 },
      );
    }

    const body = await request.json();
    const userId = request.headers.get('x-user-id') || body?.userId || 'system';
    const applications = await writeApplications(body?.applications ?? body, userId);
    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('Applications PUT error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to save applications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staleClientResponse = rejectStaleClient(request);
    if (staleClientResponse) return staleClientResponse;

    const body = await request.json();
    const userId = request.headers.get('x-user-id') || body?.userId || 'system';
    const applications = await upsertApplication(body?.application ?? body, userId);
    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('Applications POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to save application' }, { status: 500 });
  }
}
