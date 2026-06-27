import { NextResponse } from 'next/server';
import { readAdminDocumentTypeSections } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Все разделы досье (module_part) по всем типам — независимо от пагинации.
export async function GET() {
  try {
    const sections = await readAdminDocumentTypeSections();
    return NextResponse.json({ sections });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read sections' }, { status: 500 });
  }
}
