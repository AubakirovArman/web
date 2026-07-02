import { NextRequest, NextResponse } from 'next/server';
import { updateNpaRequirement, deleteNpaRequirement } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Изменить требование НПА.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; reqId: string }> }) {
  try {
    const { id, reqId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await updateNpaRequirement(decodeURIComponent(id), decodeURIComponent(reqId), body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ requirement: result.requirement });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить требование' }, { status: 500 });
  }
}

// Удалить требование НПА.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; reqId: string }> }) {
  try {
    const { id, reqId } = await params;
    const ok = await deleteNpaRequirement(decodeURIComponent(id), decodeURIComponent(reqId));
    if (!ok) return NextResponse.json({ error: 'Требование не найдено' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось удалить требование' }, { status: 500 });
  }
}
