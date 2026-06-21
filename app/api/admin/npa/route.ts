import { NextResponse } from 'next/server';
import { readAdminNpaRegistryOnly } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await readAdminNpaRegistryOnly();
    return NextResponse.json({ records });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read NPA registry' }, { status: 500 });
  }
}
