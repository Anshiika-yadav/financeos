-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — tenant isolation backstop (Phase 0, rule 1)
-- ═══════════════════════════════════════════════════════════════════════════

-- Returns NULL when app.tenant_id has not been set for this connection/tx.
-- IMPORTANT: this makes the policies FAIL-CLOSED — if the app forgets to set
-- the tenant context, queries return/affect ZERO rows instead of leaking data.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE sql STABLE;

-- ─── tenants: special case — uses "id" as its own tenant key, and needs a
-- bootstrap allowance for INSERT because no tenant context exists yet when a
-- brand-new tenant is first being created. ──────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_select ON tenants
  FOR SELECT USING (id = current_tenant_id());
CREATE POLICY tenant_self_update ON tenants
  FOR UPDATE USING (id = current_tenant_id()) WITH CHECK (id = current_tenant_id());
CREATE POLICY tenant_bootstrap_insert ON tenants
  FOR INSERT WITH CHECK (true); -- gated by app-layer signup logic, not RLS

-- ─── roles: tenantId is NULLABLE (NULL = platform-wide built-in role visible
-- to every tenant). Regular tenant-created roles must still be scoped. ──────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON roles
  USING ("tenantId" = current_tenant_id() OR "tenantId" IS NULL)
  WITH CHECK ("tenantId" = current_tenant_id());

-- ─── standard tenant-owned tables: plain tenantId = current_tenant_id() ────
DO $$
DECLARE
  t text;
  standard_tables text[] := ARRAY[
    'audit_logs',
    'fiscal_periods',
    'fiscal_years',
    'gl_accounts',
    'gl_dimension_values',
    'gl_dimensions',
    'gl_journal_lines',
    'gl_journals',
    'legal_entities',
    'tax_profiles',
    'tax_rates',
    'tenant_users'
  ];
BEGIN
  FOREACH t IN ARRAY standard_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());',
      t
    );
  END LOOP;
END $$;