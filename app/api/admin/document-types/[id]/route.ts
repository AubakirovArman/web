import { NextRequest, NextResponse } from 'next/server';
import { deactivateAdminDocumentType, readAdminDocumentTypeDetail, updateAdminDocumentTypeDetail } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await readAdminDocumentTypeDetail(decodeURIComponent(id));
    if (!item) return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read document type' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const item = await updateAdminDocumentTypeDetail(decodeURIComponent(id), body?.item || body);
    if (!item) return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update document type' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deactivateAdminDocumentType(decodeURIComponent(id));
    if (!deleted) return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete document type' }, { status: 500 });
  }
}
