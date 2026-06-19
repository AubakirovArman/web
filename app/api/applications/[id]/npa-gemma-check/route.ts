import { NextRequest, NextResponse } from 'next/server';
import { runNpaGemmaCheck } from '@/lib/applications/npa-gemma-check/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runNpaGemmaCheck(id, body, req.headers.get('x-user-id') || 'system');
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to run NPA automated check' }, { status: 500 });
  }
}
