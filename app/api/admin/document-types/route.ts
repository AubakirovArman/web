import { NextRequest, NextResponse } from 'next/server';
import { readAdminDocumentTypesList } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await readAdminDocumentTypesList({
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 25),
      query: searchParams.get('query') || '',
      source: (searchParams.get('source') || 'all') as 'all' | 'appendix-2' | 'appendix-3',
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read document types' }, { status: 500 });
  }
}
