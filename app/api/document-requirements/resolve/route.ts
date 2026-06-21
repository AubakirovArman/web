import { NextRequest, NextResponse } from 'next/server';
import { resolveLsRegistrationRequiredDocuments } from '@/lib/document-requirements/ls-registration-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const values = body?.values && typeof body.values === 'object' ? body.values : {};
    const result = await resolveLsRegistrationRequiredDocuments(values);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to resolve document requirements' },
      { status: 500 },
    );
  }
}
