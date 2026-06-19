import { NextRequest, NextResponse } from 'next/server';
import { readAdminRuntimeConfig, writeAdminRuntimeConfig } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await readAdminRuntimeConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read admin config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = request.headers.get('x-user-id') || body?.userId || 'system';
    const incomingNpaRegistry = Array.isArray(body?.npaRegistry) ? body.npaRegistry : null;
    const safeBody = { ...(body && typeof body === 'object' ? body : {}) };

    if (incomingNpaRegistry?.length === 0) {
      const current = await readAdminRuntimeConfig().catch(() => null);
      if (current?.npaRegistry?.length) {
        safeBody.npaRegistry = current.npaRegistry;
      }
    }

    const config = await writeAdminRuntimeConfig(safeBody, userId);
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save admin config' }, { status: 500 });
  }
}
