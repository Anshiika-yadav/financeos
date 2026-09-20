CREATE POLICY self_membership_lookup ON tenant_users
  FOR SELECT USING ("userId" = current_setting('app.actor_id', true));