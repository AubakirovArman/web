import { NextRequest, NextResponse } from 'next/server';
import {
  readAdminNpaRegistryOnly,
  readAdminRuntimeConfig,
  writeAdminRuntimeConfig,
} from '@/lib/admin/server-store';
import { buildNpaRecordFromPreview } from '@/lib/admin/npa-record-builder';
import type { AdminNpaRecord } from '@/lib/admin/admin-page-types';

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

// Сохранить НПА в реестр из результата Gemma-превью (или готовую запись).
// Read-modify-write полного admin-config: documentTypes и прочее сохраняются.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = request.headers.get('x-user-id') || body?.userId || 'system';

    let record: AdminNpaRecord;
    if (body?.record && typeof body.record === 'object') {
      record = body.record as AdminNpaRecord;
    } else if (body?.preview?.extraction) {
      const mappings = body?.mappings && typeof body.mappings === 'object' ? body.mappings : {};
      record = buildNpaRecordFromPreview(body.preview, mappings);
    } else {
      return NextResponse.json({ error: 'preview или record обязателен' }, { status: 400 });
    }

    if (!record.requirements?.length) {
      return NextResponse.json({ error: 'В документе не извлечено ни одного требования' }, { status: 400 });
    }

    const config = await readAdminRuntimeConfig();
    const registry: AdminNpaRecord[] = Array.isArray((config as any).npaRegistry)
      ? ((config as any).npaRegistry as AdminNpaRecord[])
      : [];
    // upsert по id (повторное добавление того же акта — обновляет запись)
    const nextRegistry = [...registry.filter((item) => item.id !== record.id), record];

    await writeAdminRuntimeConfig({ ...config, npaRegistry: nextRegistry }, userId);

    return NextResponse.json({ record, count: nextRegistry.length });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить НПА в реестр' }, { status: 500 });
  }
}
