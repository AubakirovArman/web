import { NextRequest, NextResponse } from 'next/server';
import { updateCheckProfileRequirements } from '@/lib/admin/server-store';
import { logAudit } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Сохранить отредактированные требования раздела (текст/добавить/удалить) —
// пишет в condition_json.document_check_profile / checker_routing (то, что читает Gemma).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requirements = Array.isArray(body?.requirements) ? body.requirements : null;
    if (!requirements) {
      return NextResponse.json({ error: 'requirements обязателен (массив)' }, { status: 400 });
    }
    const item = await updateCheckProfileRequirements(decodeURIComponent(id), requirements);
    if (!item) return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    void logAudit({
      actorUserId: request.headers.get('x-user-id'),
      action: 'requirements.update',
      entity: 'document-type',
      entityId: decodeURIComponent(id),
      summary: `Обновлены требования (${requirements.length})`,
    });
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить требования' }, { status: 500 });
  }
}
