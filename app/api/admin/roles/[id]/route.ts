import { NextRequest, NextResponse } from 'next/server';
import { readRoles, writeRoles } from '@/lib/auth/roles';
import { countUsersByRole } from '@/lib/auth/users';
import { findEscalatedPermissions } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Изменить роль (название/права/описание).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const roleId = decodeURIComponent(id);
    const body = await request.json().catch(() => ({}));
    const roles = await readRoles();
    const role = roles.find((r) => r.id === roleId);
    if (!role) return NextResponse.json({ error: 'Роль не найдена' }, { status: 404 });
    if (roleId === 'admin') {
      return NextResponse.json({ error: 'Права роли «Администратор» нельзя ограничить' }, { status: 400 });
    }
    if (Array.isArray(body?.permissions)) {
      const requested = body.permissions.map(String);
      const perms = (request.headers.get('x-user-perms') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const escalated = findEscalatedPermissions(requested, perms);
      if (escalated.length) {
        return NextResponse.json({ error: `Нельзя выдать права выше своих: ${escalated.join(', ')}` }, { status: 403 });
      }
      role.permissions = requested;
    }
    if (typeof body?.name === 'string' && body.name.trim()) role.name = body.name.trim();
    if (typeof body?.description === 'string') role.description = body.description;
    const next = await writeRoles(roles);
    void logAudit({ actorUserId: request.headers.get('x-user-id'), action: 'role.update', entity: 'role', entityId: roleId, summary: `Изменена роль «${role.name}»` });
    return NextResponse.json({ role: next.find((r) => r.id === roleId), roles: next });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось сохранить роль' }, { status: 500 });
  }
}

// Удалить роль (только кастомную и не занятую пользователями).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const roleId = decodeURIComponent(id);
    const roles = await readRoles();
    const role = roles.find((r) => r.id === roleId);
    if (!role) return NextResponse.json({ error: 'Роль не найдена' }, { status: 404 });
    if (role.builtin) return NextResponse.json({ error: 'Встроенную роль нельзя удалить' }, { status: 400 });
    const used = await countUsersByRole(roleId);
    if (used > 0) {
      return NextResponse.json(
        { error: `Роль назначена ${used} пользовател(ям). Сначала смените их роль.` },
        { status: 409 },
      );
    }
    const next = await writeRoles(roles.filter((r) => r.id !== roleId));
    void logAudit({ actorUserId: request.headers.get('x-user-id'), action: 'role.delete', entity: 'role', entityId: roleId, summary: `Удалена роль «${role.name}»` });
    return NextResponse.json({ ok: true, roles: next });
  } catch (error: any) {
    return NextResponse.json({ error: 'Не удалось удалить роль' }, { status: 500 });
  }
}
