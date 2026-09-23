DO $$
DECLARE
  t text;
  new_tables text[] := ARRAY[
    'saved_report_views',
    'control_definitions','control_tests',
    'approval_limits','numbering_sequences','module_feature_flags'
  ];
BEGIN
  FOREACH t IN ARRAY new_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());',
      t
    );
  END LOOP;
END $$;
