import { NextRequest, NextResponse } from 'next/server';
import { patchApplication } from '@/lib/applications/server-store';
import type { Finding } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  const { id, findingId } = await params;

  try {
    const body = await request.json();
    const patch = (body?.patch ?? body) as Partial<Finding>;

    const userId = request.headers.get('x-user-id') || body?.userId || 'system';
    const updated = await patchApplication(
      id,
      (application) => ({
        ...application,
        findings: application.findings.map((finding) =>
          finding.id === findingId ? { ...finding, ...patch } : finding
        ),
      }),
      userId
    );

    if (!updated) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const finding = updated.findings.find((item) => item.id === findingId);
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ application: updated, finding });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 });
  }
}
