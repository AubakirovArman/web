import { NextRequest, NextResponse } from 'next/server';
import { readRoles, writeRoles, type AppRole } from '@/lib/auth/roles';
import { PERMISSIONS } from '@/lib/auth/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const roles = await readRoles();
    return NextResponse.json({ roles, permissions: PERMISSIONS });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось загрузить роли' }, { status: 500 });
  }
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

// id роли — только ASCII (используется в HTTP-заголовках, где недопустим не-Latin1).
function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Создать роль. body: { name, permissions, description }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Укажите название роли' }, { status: 400 });
    const roles = await readRoles();
    let id = slugify(String(body?.id || name)) || `role-${Date.now().toString(36)}`;
    if (roles.some((r) => r.id === id)) id = `${id}-${Date.now().toString(36)}`;
    const role: AppRole = {
      id,
      name,
      permissions: Array.isArray(body?.permissions) ? body.permissions.map(String) : [],
      description: body?.description ? String(body.description) : undefined,
      builtin: false,
    };
    const next = await writeRoles([...roles, role]);
    return NextResponse.json({ role: next.find((r) => r.id === id), roles: next });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось создать роль' }, { status: 500 });
  }
}
