import { NextResponse } from 'next/server';
import { readCustomParameters } from '@/lib/admin/custom-fields-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Определения кастомных полей для мастера заявителя и конструктора условий.
// Доступно любому авторизованному пользователю (только чтение) — в отличие от
// /api/admin/fields, требующего право admin:fields.
export async function GET() {
  try {
    const customFields = await readCustomParameters();
    return NextResponse.json({ customFields });
  } catch (error: any) {
    return NextResponse.json({ customFields: [] });
  }
}
