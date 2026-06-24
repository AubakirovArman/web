import { randomUUID } from 'crypto';
import type { Application } from '@/lib/types';
import { ensureRuntimeSchema, getRuntimePool, normalizeRuntimeUserId, sanitizeJsonForPostgres } from '@/lib/db/runtime-postgres';

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normalizeApplications(value: unknown): Application[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<Application> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
      status: item.status || 'draft',
      values: item.values && typeof item.values === 'object' ? item.values : {},
      files: Array.isArray(item.files) ? item.files : [],
      checklist: Array.isArray(item.checklist) ? item.checklist : [],
      findings: Array.isArray(item.findings) ? item.findings : [],
      expertCheckDecisions:
        item.expertCheckDecisions && typeof item.expertCheckDecisions === 'object'
          ? item.expertCheckDecisions
          : {},
    })) as Application[];
}

export async function readApplications(): Promise<Application[]> {
  return readApplicationsFromPostgres();
}

/**
 * Lightweight list read for the expert table / global provider.
 * Strips the heavy per-file `extracted` text and inline `url` data so that
 * mounting any page does not transfer megabytes of OCR/parse output.
 * Full per-file data is fetched on demand via readApplicationById.
 */
export async function readApplicationSummaries(): Promise<Application[]> {
  const applications = await readApplicationsFromPostgres();
  return applications.map(stripApplicationHeavyFields);
}

function stripApplicationHeavyFields(app: Application): Application {
  if (!Array.isArray(app.files) || app.files.length === 0) return app;
  return {
    ...app,
    files: app.files.map((file) => {
      const { extracted: _extracted, url: _url, ...rest } = file;
      return rest;
    }),
  };
}

export async function readApplicationById(id: string): Promise<Application | null> {
  if (!id) return null;
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const result = await pool.query(`SELECT data FROM runtime_applications WHERE id = $1 LIMIT 1`, [id]);
  if (result.rows.length === 0) return null;
  return normalizeApplications([result.rows[0].data])[0] || null;
}

async function readApplicationsFromPostgres(): Promise<Application[]> {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const result = await pool.query(
    `
      SELECT data
      FROM runtime_applications
      ORDER BY updated_at DESC, created_at DESC
    `
  );

  return normalizeApplications(result.rows.map((row) => row.data));
}

export async function writeApplications(applications: unknown, userId = 'system'): Promise<Application[]> {
  const normalized = normalizeApplications(applications);
  return enqueueWrite(() => writeApplicationsUnlocked(normalized, userId));
}

async function writeApplicationsUnlocked(normalized: Application[], userId = 'system'): Promise<Application[]> {
  await writeApplicationsToPostgres(normalized, userId);
  return normalized;
}

async function writeApplicationsToPostgres(normalized: Application[], userId = 'system') {
  await ensureRuntimeSchema();
  const pool = getRuntimePool();
  const client = await pool.connect();
  const normalizedUserId = normalizeRuntimeUserId(userId);

  try {
    await client.query('BEGIN');
    if (normalized.length === 0) {
      await client.query('DELETE FROM runtime_applications');
    } else {
      await client.query('DELETE FROM runtime_applications WHERE NOT (id = ANY($1::text[]))', [normalized.map((app) => app.id)]);
    }

    for (const app of normalized) {
      const userIds = extractApplicationUserIds(app, normalizedUserId);
      await client.query(
        `
          INSERT INTO runtime_applications (
            id,
            data,
            status,
            object_type,
            procedure,
            applicant_user_id,
            assigned_expert_user_id,
            created_by_user_id,
            updated_by_user_id,
            created_at,
            updated_at
          )
          VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $8, COALESCE($9::timestamptz, now()), now())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data,
                status = EXCLUDED.status,
                object_type = EXCLUDED.object_type,
                procedure = EXCLUDED.procedure,
                applicant_user_id = EXCLUDED.applicant_user_id,
                assigned_expert_user_id = EXCLUDED.assigned_expert_user_id,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = now()
        `,
        [
          app.id,
          JSON.stringify(sanitizeJsonForPostgres(app)),
          app.status,
          stringValue(app.values?.['param-object-type']),
          stringValue(app.values?.['param-procedure']),
          userIds.applicantUserId,
          userIds.assignedExpertUserId,
          normalizedUserId,
          app.createdAt || null,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertApplication(application: unknown, userId = 'system'): Promise<Application[]> {
  const [normalized] = normalizeApplications([application]);
  if (!normalized) return readApplications();

  return enqueueWrite(async () => {
    const applications = await readApplications();
    const index = applications.findIndex((item) => item.id === normalized.id);
    const next = index >= 0 ? applications.map((item) => (item.id === normalized.id ? normalized : item)) : [normalized, ...applications];

    return writeApplicationsUnlocked(next, userId);
  });
}

export async function patchApplication(
  id: string,
  updater: (application: Application) => Application,
  userId = 'system'
): Promise<Application | null> {
  let updated: Application | null = null;

  await enqueueWrite(async () => {
    const applications = await readApplications();
    const next = applications.map((item) => {
      if (item.id !== id) return item;
      updated = updater(item);
      return updated;
    });
    await writeApplicationsUnlocked(next, userId);
    return next;
  });

  return updated;
}

function extractApplicationUserIds(app: Application, fallbackUserId: string) {
  const values = app.values || {};
  const source = app as Application & {
    applicantUserId?: string;
    assignedExpertUserId?: string;
    createdByUserId?: string;
    updatedByUserId?: string;
  };

  return {
    applicantUserId: stringValue(source.applicantUserId || values['param-applicant-user-id'] || values['param-user-id']) || fallbackUserId,
    assignedExpertUserId: stringValue(source.assignedExpertUserId || values['param-expert-user-id']) || null,
  };
}

function stringValue(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') : String(value || '').trim();
}
