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
    globalForRuntimeDb.runtimePool = new Pool({
      connectionString: getRuntimeDatabaseUrl(),
      max: 8,
    });
  }
  return globalForRuntimeDb.runtimePool;
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
      role text NOT NULL CHECK (role IN ('applicant', 'expert', 'admin', 'system')),
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
