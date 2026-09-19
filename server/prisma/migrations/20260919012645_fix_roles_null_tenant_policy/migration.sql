DROP POLICY tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  USING ("tenantId" = current_tenant_id() OR "tenantId" IS NULL)
  WITH CHECK ("tenantId" = current_tenant_id() OR "tenantId" IS NULL);