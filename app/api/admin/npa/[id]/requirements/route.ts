import { NextRequest, NextResponse } from 'next/server';
import { addNpaRequirement } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Добавить требование в акт НПА вручную.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const npaId = decodeURIComponent(id);
    const body = await request.json().catch(() => ({}));
    if (!String(body?.requirement || '').trim()) {
      return NextResponse.json({ error: 'Укажите текст требования' }, { status: 400 });
    }
    const result = await addNpaRequirement(npaId, body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ requirement: result.requirement });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось добавить требование' }, { status: 500 });
  }
}
