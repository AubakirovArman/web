import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/auth/users';
import { verifyPassword } from '@/lib/auth/password';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session';
import { getPermissionsForRole } from '@/lib/auth/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json().catch(() => ({}));
    if (!username || !password) {
      return NextResponse.json({ error: 'Укажите логин и пароль' }, { status: 400 });
    }
    const user = await findUserByUsername(String(username));
    if (!user || !user.password_hash || !(await verifyPassword(String(password), user.password_hash))) {
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }
    const name = user.display_name || user.username || user.id;
    const perms = await getPermissionsForRole(user.role);
    const token = await signSession({ sub: user.id, role: user.role, name, perms });
    const response = NextResponse.json({ ok: true, role: user.role, name });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
      secure: false, // приложение обслуживается по HTTP (localhost); для HTTPS-прод → true
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Не удалось выполнить вход' }, { status: 500 });
  }
}
