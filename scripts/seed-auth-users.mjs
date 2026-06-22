import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

const DATABASE_URL =
  process.env.NDDA_DATABASE_URL ||
  process.env.REFERENCE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';

// id | role | username | password | display_name
const USERS = [
  ['user-applicant', 'applicant', 'applicant', 'Applicant#2026', 'Заявитель (демо)'],
  ['user-expert', 'expert', 'expert', 'Expert#2026', 'Эксперт (демо)'],
  ['user-admin', 'admin', 'admin', 'Admin#2026', 'Администратор (демо)'],
];

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

for (const [id, role, username, password, displayName] of USERS) {
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO app_users (id, role, username, password_hash, display_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, username = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name, updated_at = now()`,
    [id, role, username, passwordHash, displayName],
  );
  console.log(`seeded ${role}: ${username}`);
}

await pool.end();
console.log('done');
