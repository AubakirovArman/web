import { NextRequest, NextResponse } from 'next/server';
import { upsertCustomParameter, deleteCustomParameter, readCustomParameters } from '@/lib/admin/custom-fields-store';
import { logAudit } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Изменить кастомное поле (только кастомное — базовые поля неизменяемы).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fieldId = decodeURIComponent(id);
    const existing = await readCustomParameters();
    if (!existing.some((p) => p.id === fieldId)) {
      return NextResponse.json({ error: 'Кастомное поле не найдено (базовые поля неизменяемы)' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const label = String(body?.label || '').trim();
    if (!label) return NextResponse.json({ error: 'Укажите название поля' }, { status: 400 });
    const userId = request.headers.get('x-user-id') || 'system';
    const result = await upsertCustomParameter(
      {
        id: fieldId,
        label,
        type: body?.type,
        options: body?.options,
        section: body?.section,
        scopeObjectType: body?.scopeObjectType,
        sourceNpa: body?.sourceNpa,
        sourceFieldRef: body?.sourceFieldRef,
      },
      userId,
    );
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    void logAudit({ actorUserId: userId, action: 'field.update', entity: 'field', entityId: fieldId, summary: `Изменено поле «${label}»` });
    return NextResponse.json({ parameter: result.parameter });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить поле' }, { status: 500 });
  }
}

// Удалить кастомное поле.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fieldId = decodeURIComponent(id);
    const userId = request.headers.get('x-user-id') || 'system';
    const ok = await deleteCustomParameter(fieldId, userId);
    if (!ok) return NextResponse.json({ error: 'Кастомное поле не найдено' }, { status: 404 });
    void logAudit({ actorUserId: userId, action: 'field.delete', entity: 'field', entityId: fieldId, summary: `Удалено поле ${fieldId}` });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось удалить поле' }, { status: 500 });
  }
}
