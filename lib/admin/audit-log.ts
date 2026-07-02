import { getRuntimePool, ensureRuntimeSchema, normalizeRuntimeUserId } from '@/lib/db/runtime-postgres';

export interface AuditEntry {
  id: string;
  actorUserId: string;
  action: string;
  entity?: string;
  entityId?: string;
  summary?: string;
  createdAt: string;
}

/**
 * Записать событие изменения логики (тип/требование/условие/поле/роль/НПА).
 * Fire-and-forget: никогда не бросает — аудит не должен ломать основную операцию.
 */
export async function logAudit(input: {
  actorUserId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  summary?: string;
}): Promise<void> {
  try {
    await ensureRuntimeSchema();
    const pool = getRuntimePool();
    await pool.query(
      `INSERT INTO admin_audit_log (actor_user_id, action, entity, entity_id, summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        normalizeRuntimeUserId(input.actorUserId),
        String(input.action).slice(0, 120),
        input.entity ? String(input.entity).slice(0, 120) : null,
        input.entityId ? String(input.entityId).slice(0, 200) : null,
        input.summary ? String(input.summary).slice(0, 1000) : null,
      ],
    );
  } catch (error) {
    console.warn('[audit-log] failed:', (error as { message?: string })?.message || error);
  }
}

export async function readAuditLog(limit = 200): Promise<AuditEntry[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const { rows } = await pool.query(
    `SELECT id, actor_user_id, action, entity, entity_id, summary, created_at
     FROM admin_audit_log ORDER BY created_at DESC, id DESC LIMIT $1`,
    [Math.min(Math.max(1, limit), 1000)],
  );
  return rows.map((r) => ({
    id: String(r.id),
    actorUserId: r.actor_user_id,
    action: r.action,
    entity: r.entity || undefined,
    entityId: r.entity_id || undefined,
    summary: r.summary || undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}
