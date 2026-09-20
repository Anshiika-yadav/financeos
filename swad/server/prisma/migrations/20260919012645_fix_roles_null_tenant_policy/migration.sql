DROP POLICY tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  USING ("tenantId" = current_tenant_id() OR "tenantId" IS NULL)
  WITH CHECK ("tenantId" = current_tenant_id() OR "tenantId" IS NULL);
  DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'tenants','roles','audit_logs','fiscal_periods','fiscal_years',
    'gl_accounts','gl_dimension_values','gl_dimensions','gl_journal_lines',
    'gl_journals','legal_entities','tax_profiles','tax_rates','tenant_users'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;