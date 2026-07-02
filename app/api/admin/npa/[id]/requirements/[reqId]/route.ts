import { NextRequest, NextResponse } from 'next/server';
import { updateNpaRequirement, deleteNpaRequirement } from '@/lib/admin/server-store';
import { logAudit } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Изменить требование НПА.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; reqId: string }> }) {
  try {
    const { id, reqId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await updateNpaRequirement(decodeURIComponent(id), decodeURIComponent(reqId), body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    void logAudit({ actorUserId: request.headers.get('x-user-id'), action: 'npa-requirement.update', entity: 'npa', entityId: decodeURIComponent(id), summary: `Изменено требование ${decodeURIComponent(reqId)}` });
    return NextResponse.json({ requirement: result.requirement });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить требование' }, { status: 500 });
  }
}

// Удалить требование НПА.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; reqId: string }> }) {
  try {
    const { id, reqId } = await params;
    const ok = await deleteNpaRequirement(decodeURIComponent(id), decodeURIComponent(reqId));
    if (!ok) return NextResponse.json({ error: 'Требование не найдено' }, { status: 404 });
    void logAudit({ actorUserId: request.headers.get('x-user-id'), action: 'npa-requirement.delete', entity: 'npa', entityId: decodeURIComponent(id), summary: `Удалено требование ${decodeURIComponent(reqId)}` });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось удалить требование' }, { status: 500 });
  }
}
