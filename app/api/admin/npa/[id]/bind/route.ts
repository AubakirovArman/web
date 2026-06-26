import { NextRequest, NextResponse } from 'next/server';
import { bindNpaRequirementToDocumentType } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Привязать/отвязать требование НПА к разделу типа документа.
// Синхронизирует document_check_profile (то, что читает Gemma) и реестр НПА.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requirementId = typeof body?.requirementId === 'string' ? body.requirementId : '';
    const targetDocumentTypeId = typeof body?.targetDocumentTypeId === 'string' ? body.targetDocumentTypeId : '';
    if (!requirementId) {
      return NextResponse.json({ error: 'requirementId обязателен' }, { status: 400 });
    }
    const record = await bindNpaRequirementToDocumentType(
      decodeURIComponent(id),
      requirementId,
      targetDocumentTypeId,
    );
    if (!record) return NextResponse.json({ error: 'НПА или требование не найдено' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить привязку' }, { status: 500 });
  }
}
