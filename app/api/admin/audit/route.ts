import { NextRequest, NextResponse } from 'next/server';
import { readAuditLog } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit')) || 200;
    const entries = await readAuditLog(limit);
    return NextResponse.json({ entries });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось загрузить журнал' }, { status: 500 });
  }
}
