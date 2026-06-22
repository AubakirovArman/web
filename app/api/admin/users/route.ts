import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { listUsers, findUserByUsername, createUser, USER_ROLES } from '@/lib/auth/users';
import { hashPassword } from '@/lib/auth/password';
import type { UserRole } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Не удалось загрузить пользователей' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || '') as UserRole;
    const displayName = String(body.displayName || '').trim() || username;

    if (!username || !password) return NextResponse.json({ error: 'Укажите логин и пароль' }, { status: 400 });
    if (username.length < 3) return NextResponse.json({ error: 'Логин не короче 3 символов' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Пароль не короче 6 символов' }, { status: 400 });
    if (!USER_ROLES.includes(role)) return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });
    if (await findUserByUsername(username)) return NextResponse.json({ error: 'Логин уже занят' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    await createUser({ id: `user-${randomUUID()}`, username, passwordHash, role, displayName });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 });
  }
}
