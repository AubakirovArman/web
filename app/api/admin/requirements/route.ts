import { NextResponse } from 'next/server';
import { readAdminNpaRegistryOnly } from '@/lib/admin/server-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Short, human label for the source act, e.g. "Решение № 88".
function buildNpaShortName(record: { number?: string; actType?: string; name?: string }): string {
  const number = (record.number || '').trim();
  if (number) return number;
  const actType = (record.actType || '').trim();
  if (actType) return actType;
  const name = (record.name || '').trim();
  return name.length > 40 ? `${name.slice(0, 40).trim()}…` : name;
}

// Prepend the act name to a "bare" point like "п. 2" → "Решение № 88 п. 2".
// If the point already references an act (Решение/Приказ/№…), keep it as-is.
function buildPointLabel(point: string, npaShortName: string): string {
  const value = (point || '').trim();
  if (!value) return npaShortName;
  if (!npaShortName) return value;
  if (/реш|прик|кодекс|соглаш|пост|№\s*\d/i.test(value)) return value;
  return `${npaShortName} ${value}`;
}

export async function GET() {
  try {
    const records = await readAdminNpaRegistryOnly();
    const requirements = records.flatMap((record) => {
      const npaShortName = buildNpaShortName(record);
      return record.requirements.map((requirement) => {
        const point = requirement.point || record.name;
        return {
          ...requirement,
          npaId: record.id,
          npaName: record.name,
          npaShortName,
          code: requirement.code || record.number || record.id,
          point,
          pointLabel: buildPointLabel(point, npaShortName),
        };
      });
    });
    return NextResponse.json({ requirements, npaCount: records.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read requirements' }, { status: 500 });
  }
}
