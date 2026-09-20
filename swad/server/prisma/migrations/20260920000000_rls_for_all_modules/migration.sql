-- Extends the tenant-isolation RLS backstop (see the earlier
-- enable_row_level_security migration) to every table added by the
-- AP/AR/Treasury/Procurement/Expenses/Assets/Inventory/Projects/
-- Budgeting/Tax modules. These tables were created without RLS when
-- the modules were first built; every route touching them has since
-- been updated to use req.withTenantDb (which sets app.tenant_id via
-- a transaction), so it is now safe to FORCE row-level security here
-- for real defense-in-depth, not just app-layer filtering.
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
