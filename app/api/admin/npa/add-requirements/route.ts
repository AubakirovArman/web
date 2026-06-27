import { NextRequest, NextResponse } from 'next/server';
import { addNpaRequirements } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Добавить новые требования в реестр НПА (обратное заполнение из типов документов).
// body: { additions: [{ documentTypeId, code, npaId, requirement, point, quote, kind, documentName }] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const additions = Array.isArray(body?.additions) ? body.additions : null;
    if (!additions) return NextResponse.json({ error: 'additions обязателен (массив)' }, { status: 400 });
    const added = await addNpaRequirements(additions);
    return NextResponse.json({ added });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось добавить требования' }, { status: 500 });
  }
}
