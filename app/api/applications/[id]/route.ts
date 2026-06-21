import { NextRequest, NextResponse } from 'next/server';
import { ensureRuntimeSchema, getRuntimePool } from '@/lib/db/runtime-postgres';
import { readApplicationById } from '@/lib/applications/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    if (!id) {
      return NextResponse.json({ error: 'Application id is required' }, { status: 400 });
    }

    const application = await readApplicationById(id);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ application });
  } catch (error: any) {
    console.error('Applications GET by id error:', error);
    return NextResponse.json({ error: 'Failed to read application' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    if (!id) {
      return NextResponse.json({ error: 'Application id is required' }, { status: 400 });
    }

    await ensureRuntimeSchema();
    const result = await getRuntimePool().query('DELETE FROM runtime_applications WHERE id = $1', [id]);

    return NextResponse.json({
      deleted: (result.rowCount || 0) > 0,
    });
  } catch (error: any) {
    console.error('Applications DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}
