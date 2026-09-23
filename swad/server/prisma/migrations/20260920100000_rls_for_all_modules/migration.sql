DO $$
DECLARE
  t text;
  module_tables text[] := ARRAY[
    'suppliers','bills','bill_lines','payment_runs',
    'customers','invoices','invoice_lines','receipts',
    'bank_accounts','bank_statements','bank_statement_lines',
    'purchase_requests','purchase_orders','po_lines',
    'expense_claims','expense_lines',
    'assets','depreciation_runs',
    'inventory_items','stock_movements',
    'projects','project_costs','contracts',
    'budgets','budget_lines'
  ];
BEGIN
  FOREACH t IN ARRAY module_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());',
      t
    );
  END LOOP;
END $$;