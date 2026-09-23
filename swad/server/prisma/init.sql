-- FinanceOS PostgreSQL initialization
-- Runs once when the container starts against a fresh database.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Row-Level Security setup ─────────────────────────────────────────────────
-- Called by the app's Prisma client connection setup:
--   SET app.tenant_id = '<tenantId>';
-- RLS policies use current_setting('app.tenant_id') as the backstop.

-- Helper: safely get tenant_id from session variable (returns empty string if not set)
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.tenant_id', true), '')
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Enable RLS on tenant-owned tables (run after Prisma migrations) ──────────
-- NOTE: Prisma migrations create the tables; this script enables RLS after.
-- We wrap in a DO block so it is idempotent.

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'tenants', 'tenant_users', 'tenant_user_roles',
    'audit_logs', 'legal_entities', 'fiscal_years', 'fiscal_periods',
    'gl_accounts', 'gl_dimensions', 'gl_dimension_values',
    'gl_journals', 'gl_journal_lines',
    'tax_profiles', 'tax_rates'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Only enable if table exists (safe for partial migration state)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Policies are created in individual migration files (see prisma/migrations/)
