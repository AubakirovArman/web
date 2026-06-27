import { getRuntimePool } from '@/lib/db/runtime-postgres';
import type { UserRole } from '@/lib/auth/session';

export interface AppUserRow {
  id: string;
  role: UserRole;
  display_name: string | null;
  username: string | null;
  password_hash: string | null;
}

export interface AppUserPublic {
  id: string;
  role: UserRole;
  displayName: string | null;
  username: string | null;
  createdAt: string | null;
}

export const USER_ROLES: UserRole[] = ['applicant', 'expert', 'admin'];

export async function findUserByUsername(username: string): Promise<AppUserRow | null> {
  const pool = getRuntimePool();
  const { rows } = await pool.query<AppUserRow>(
    'SELECT id, role, display_name, username, password_hash FROM app_users WHERE lower(username) = lower($1) LIMIT 1',
    [String(username).trim()],
  );
  return rows[0] || null;
}

export async function getUserById(id: string): Promise<AppUserRow | null> {
  const pool = getRuntimePool();
  const { rows } = await pool.query<AppUserRow>(
    'SELECT id, role, display_name, username, password_hash FROM app_users WHERE id = $1 LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

export async function listUsers(): Promise<AppUserPublic[]> {
  const pool = getRuntimePool();
  const { rows } = await pool.query(
    `SELECT id, role, display_name, username, created_at
     FROM app_users WHERE username IS NOT NULL
     ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'expert' THEN 1 ELSE 2 END, username`,
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    username: row.username,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));
}

export async function countAdmins(): Promise<number> {
  const pool = getRuntimePool();
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM app_users WHERE role = 'admin' AND username IS NOT NULL`);
  return Number(rows[0]?.n || 0);
}

export async function countUsersByRole(role: string): Promise<number> {
  const pool = getRuntimePool();
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM app_users WHERE role = $1 AND username IS NOT NULL`, [role]);
  return Number(rows[0]?.n || 0);
}

export async function createUser(params: { id: string; username: string; passwordHash: string; role: UserRole; displayName: string }): Promise<void> {
  const pool = getRuntimePool();
  await pool.query(
    `INSERT INTO app_users (id, username, password_hash, role, display_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [params.id, params.username.trim(), params.passwordHash, params.role, params.displayName],
  );
}

export async function updateUser(id: string, patch: { role?: UserRole; displayName?: string; passwordHash?: string }): Promise<void> {
  const pool = getRuntimePool();
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.role) { sets.push(`role = $${i++}`); values.push(patch.role); }
  if (patch.displayName !== undefined) { sets.push(`display_name = $${i++}`); values.push(patch.displayName); }
  if (patch.passwordHash) { sets.push(`password_hash = $${i++}`); values.push(patch.passwordHash); }
  if (sets.length === 0) return;
  sets.push('updated_at = now()');
  values.push(id);
  await pool.query(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $${i}`, values);
}

export async function deleteUser(id: string): Promise<void> {
  const pool = getRuntimePool();
  await pool.query('DELETE FROM app_users WHERE id = $1', [id]);
}
