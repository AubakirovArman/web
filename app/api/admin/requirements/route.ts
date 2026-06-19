import { NextResponse } from 'next/server';
import { readAdminNpaRegistryOnly } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await readAdminNpaRegistryOnly();
    const requirements = records.flatMap((record) => record.requirements.map((requirement) => ({
      ...requirement,
      npaId: record.id,
      npaName: record.name,
      code: requirement.code || record.number || record.id,
      point: requirement.point || record.name,
    })));
    return NextResponse.json({ requirements, npaCount: records.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read requirements' }, { status: 500 });
  }
}
