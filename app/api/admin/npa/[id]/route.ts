import { NextRequest, NextResponse } from 'next/server';
import { readAdminNpaDetail } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const record = await readAdminNpaDetail(decodeURIComponent(id));
    if (!record) return NextResponse.json({ error: 'NPA record not found' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read NPA record' }, { status: 500 });
  }
}
