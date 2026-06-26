import { NextRequest, NextResponse } from 'next/server';
import { bindNpaRequirementsBulk } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Массовое применение привязок (ассоциаций) из сопоставления.
// body: { items: [{ npaId, requirementId, documentTypeId }] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items) return NextResponse.json({ error: 'items обязателен (массив)' }, { status: 400 });
    const applied = await bindNpaRequirementsBulk(items);
    return NextResponse.json({ applied });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось применить привязки' }, { status: 500 });
  }
}
