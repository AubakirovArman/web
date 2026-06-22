import { getRuntimePool } from '@/lib/db/runtime-postgres';
import type { UserRole } from '@/lib/auth/session';

export interface AppUserRow {
  id: string;
  role: UserRole;
  display_name: string | null;
  username: string | null;
  password_hash: string | null;
}

export async function findUserByUsername(username: string): Promise<AppUserRow | null> {
  const pool = getRuntimePool();
  const { rows } = await pool.query<AppUserRow>(
    'SELECT id, role, display_name, username, password_hash FROM app_users WHERE lower(username) = lower($1) LIMIT 1',
    [String(username).trim()],
  );
  return rows[0] || null;
}
