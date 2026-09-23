DO $$
DECLARE
  t text;
  new_tables text[] := ARRAY[
    'close_checklists','close_tasks',
    'documents',
    'payroll_runs','payroll_lines',
    'consolidation_groups','consolidation_group_entities','intercompany_transactions'
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
