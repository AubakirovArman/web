import { NextRequest, NextResponse } from 'next/server';
import { readAdminRuntimeConfig, writeAdminRuntimeConfig } from '@/lib/admin/server-store';
import { gzipJson } from '@/lib/api/gzip-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const config = await readAdminRuntimeConfig();
    // `?lite=1` returns only what runtime consumers (wizard, expert, fields
    // panel) actually use — documentTypes + rules — dropping the ~2.3 MB of
    // lsDossierDocumentTypes + npaRegistry from the response.
    if (request.nextUrl.searchParams.get('lite') === '1') {
      return gzipJson(request, {
        documentTypes: config.documentTypes,
        rules: config.rules,
        updatedAt: config.updatedAt,
      });
    }
    return gzipJson(request, config);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read admin config' }, { status: 500 });
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
    return NextResponse.json({ error: 'Failed to save admin config' }, { status: 500 });
  }
}
