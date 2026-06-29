import { NextRequest, NextResponse } from 'next/server';
import { readAdminDocumentTypeSections } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Все разделы досье (module_part) для scope — независимо от пагинации.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sections = await readAdminDocumentTypeSections(
      searchParams.get('objectType') || 'LS',
      searchParams.get('procedure') || 'registration',
    );
    return NextResponse.json({ sections });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read sections' }, { status: 500 });
  }
}
