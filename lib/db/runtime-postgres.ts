import { Pool } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb';

const globalForRuntimeDb = globalThis as unknown as {
  runtimePool?: Pool;
  runtimeSchemaReady?: Promise<void>;
};

export function getRuntimeDatabaseUrl() {
  return process.env.NDDA_DATABASE_URL || process.env.REFERENCE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function getRuntimePool() {
  if (!globalForRuntimeDb.runtimePool) {
    const pool = new Pool({
      connectionString: getRuntimeDatabaseUrl(),
      max: 8,
      // Закрывать простаивающие коннекты ЧЕРЕЗ 30с — раньше, чем их тихо прибьёт БД/файрвол.
      // Это устраняет «первый запрос после простоя падает, refresh лечит»: после долгого
      // простоя пул пуст → берётся свежий коннект, а не мёртвый.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    // БЕЗ этого обработчика ошибка на простаивающем клиенте роняет процесс Node.
    pool.on('error', (err) => {
      console.error('[runtime-postgres] idle client error:', err?.message || err);
    });
    globalForRuntimeDb.runtimePool = pool;
  }
  return globalForRuntimeDb.runtimePool;
}

/** Признак «коннект умер» — такие ошибки безопасно повторить на свежем коннекте. */
function isConnectionError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || error || '').toLowerCase();
  const code = String((error as { code?: string })?.code || '');
  return (
    msg.includes('connection terminated') ||
    msg.includes('connection ended') ||
    msg.includes('server closed the connection') ||
    msg.includes('terminating connection') ||
    msg.includes('econnreset') ||
    msg.includes('epipe') ||
    msg.includes('socket hang up') ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === '57P01' || // admin_shutdown
    code === '57P02' || // crash_shutdown
    code === '08006' || // connection_failure
    code === '08003' // connection_does_not_exist
  );
}

/**
 * Выполнить запрос с одной повторной попыткой на свежем коннекте, если первый
 * упал из-за мёртвого/закрытого соединения (страховка от гонок при простое).
 */
export async function runtimeQuery<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = getRuntimePool();
  try {
    return (await pool.query(text, params as any)) as any;
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    console.warn('[runtime-postgres] connection error, retrying on fresh connection:', String((error as any)?.message || error));
    await new Promise((r) => setTimeout(r, 150));
    return (await pool.query(text, params as any)) as any;
  }
}

export async function ensureRuntimeSchema() {
  if (!globalForRuntimeDb.runtimeSchemaReady) {
    // Не кэшируем неудачу: если инициализация схемы упала транзиентно
    // (например, гонка/недоступность БД при первом запросе после рестарта),
    // сбрасываем промис, чтобы следующий вызов попробовал снова.
    globalForRuntimeDb.runtimeSchemaReady = createRuntimeSchema().catch((error) => {
      globalForRuntimeDb.runtimeSchemaReady = undefined;
      throw error;
    });
  }
  return globalForRuntimeDb.runtimeSchemaReady;
}

async function createRuntimeSchema() {
  const pool = getRuntimePool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id text PRIMARY KEY,
      role text NOT NULL CHECK (length(trim(role)) > 0),
      display_name text,
      email text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    INSERT INTO app_users (id, role, display_name)
    VALUES ('system', 'system', 'System')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS admin_runtime_config (
      key text PRIMARY KEY DEFAULT 'default',
      data jsonb NOT NULL,
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS runtime_applications (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      status text,
      object_type text,
      procedure text,
      applicant_user_id text,
      assigned_expert_user_id text,
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS runtime_applications_status_idx ON runtime_applications(status);
    CREATE INDEX IF NOT EXISTS runtime_applications_object_type_idx ON runtime_applications(object_type);
    CREATE INDEX IF NOT EXISTS runtime_applications_procedure_idx ON runtime_applications(procedure);
    CREATE INDEX IF NOT EXISTS runtime_applications_applicant_user_idx ON runtime_applications(applicant_user_id);
    CREATE INDEX IF NOT EXISTS runtime_applications_expert_user_idx ON runtime_applications(assigned_expert_user_id);

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id bigserial PRIMARY KEY,
      actor_user_id text NOT NULL DEFAULT 'system',
      action text NOT NULL,
      entity text,
      entity_id text,
      summary text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC);

    CREATE TABLE IF NOT EXISTS runtime_dictionaries (
      key text PRIMARY KEY,
      data jsonb NOT NULL,
      source text NOT NULL DEFAULT 'seed',
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS document_requirement_rules (
      id text PRIMARY KEY,
      scope_object_type text NOT NULL,
      scope_procedure text NOT NULL,
      doc_code text NOT NULL,
      document_type_id text,
      document_name text NOT NULL,
      row_type text,
      upload_required boolean NOT NULL DEFAULT true,
      source_structure text,
      dossier_variant text,
      module_part text,
      domestic_equivalent text,
      required_document text,
      applicability text NOT NULL,
      show_logic text NOT NULL,
      condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      condition_text text,
      linked_params jsonb NOT NULL DEFAULT '[]'::jsonb,
      activation_missing_params jsonb NOT NULL DEFAULT '[]'::jsonb,
      recommended_params_for_validation jsonb NOT NULL DEFAULT '[]'::jsonb,
      validation_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
      normalization_status text NOT NULL,
      original_trigger_expression text,
      source_reference text,
      confidence text,
      normalization_notes text,
      active boolean NOT NULL DEFAULT true,
      version integer NOT NULL DEFAULT 1,
      source text NOT NULL DEFAULT 'imported',
      created_by_user_id text NOT NULL DEFAULT 'system',
      updated_by_user_id text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS document_requirement_rules_scope_idx
      ON document_requirement_rules(scope_object_type, scope_procedure, active);
    CREATE INDEX IF NOT EXISTS document_requirement_rules_doc_code_idx
      ON document_requirement_rules(doc_code);
    CREATE INDEX IF NOT EXISTS document_requirement_rules_document_type_idx
      ON document_requirement_rules(document_type_id);
    CREATE INDEX IF NOT EXISTS document_requirement_rules_dossier_variant_idx
      ON document_requirement_rules(dossier_variant);
  `);
}

export function normalizeRuntimeUserId(value: unknown, fallback = 'system') {
  const userId = String(value || '').trim();
  return userId || fallback;
}

export function sanitizeJsonForPostgres<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '') as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonForPostgres(item)) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = sanitizeJsonForPostgres(item);
    }
    return result as T;
  }

  return value;
}
