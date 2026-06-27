import { NextRequest, NextResponse } from 'next/server';
import { readAdminDocumentTypesList, createAdminDocumentType } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Создать новый тип документа. body: { item: NewDossierDocumentType }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const item = body?.item;
    if (!item || !String(item.code || '').trim() || !String(item.name || '').trim()) {
      return NextResponse.json({ error: 'Код и наименование обязательны' }, { status: 400 });
    }
    const created = await createAdminDocumentType(item);
    if (!created) return NextResponse.json({ error: 'Не удалось создать тип документа' }, { status: 500 });
    return NextResponse.json({ item: created });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось создать тип документа' }, { status: 500 });
  }
}

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
    return NextResponse.json({ error: 'Failed to read document types' }, { status: 500 });
  }
}
