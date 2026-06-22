import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser, countAdmins, USER_ROLES } from '@/lib/auth/users';
import { hashPassword } from '@/lib/auth/password';
import type { UserRole } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const patch: { role?: UserRole; displayName?: string; passwordHash?: string } = {};

    if (body.role !== undefined) {
      const role = String(body.role) as UserRole;
      if (!USER_ROLES.includes(role)) return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });
      // Нельзя снять роль с последнего администратора
      if (target.role === 'admin' && role !== 'admin' && (await countAdmins()) <= 1) {
        return NextResponse.json({ error: 'Нельзя снять роль с последнего администратора' }, { status: 409 });
      }
      patch.role = role;
    }
    if (body.displayName !== undefined) patch.displayName = String(body.displayName).trim();
    if (body.password) {
      if (String(body.password).length < 6) return NextResponse.json({ error: 'Пароль не короче 6 символов' }, { status: 400 });
      patch.passwordHash = await hashPassword(String(body.password));
    }

    await updateUser(id, patch);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Не удалось обновить пользователя' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    if (id === 'system') return NextResponse.json({ error: 'Системного пользователя удалить нельзя' }, { status: 409 });

    const actingUserId = req.headers.get('x-user-id');
    if (actingUserId && actingUserId === id) {
      return NextResponse.json({ error: 'Нельзя удалить собственную учётную запись' }, { status: 409 });
    }
    if (target.role === 'admin' && (await countAdmins()) <= 1) {
      return NextResponse.json({ error: 'Нельзя удалить последнего администратора' }, { status: 409 });
    }

    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Не удалось удалить пользователя' }, { status: 500 });
  }
}
