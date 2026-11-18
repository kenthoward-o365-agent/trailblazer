
-- Restrict accounting_integrations SELECT/UPDATE/DELETE to admin/manager roles
DROP POLICY IF EXISTS "Users with property access can view accounting integrations" ON public.accounting_integrations;
DROP POLICY IF EXISTS "Users with property access can update accounting integrations" ON public.accounting_integrations;
DROP POLICY IF EXISTS "Users with property access can delete accounting integrations" ON public.accounting_integrations;
DROP POLICY IF EXISTS "Users with property access can insert accounting integrations" ON public.accounting_integrations;

CREATE POLICY "Admins/managers can view accounting integrations"
  ON public.accounting_integrations FOR SELECT
  TO authenticated
  USING (
    public.user_has_property_access(property_id)
    AND (
      public.is_super_admin()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Admins/managers can insert accounting integrations"
  ON public.accounting_integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_property_access(property_id)
    AND (
      public.is_super_admin()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Admins/managers can update accounting integrations"
  ON public.accounting_integrations FOR UPDATE
  TO authenticated
  USING (
    public.user_has_property_access(property_id)
    AND (
      public.is_super_admin()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Admins/managers can delete accounting integrations"
  ON public.accounting_integrations FOR DELETE
  TO authenticated
  USING (
    public.user_has_property_access(property_id)
    AND (
      public.is_super_admin()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- Restrict accounting_sync_log SELECT to admin/manager roles
DROP POLICY IF EXISTS "Users with property access can view sync log" ON public.accounting_sync_log;

CREATE POLICY "Admins/managers can view sync log"
  ON public.accounting_sync_log FOR SELECT
  TO authenticated
  USING (
    public.user_has_property_access(property_id)
    AND (
      public.is_super_admin()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- Revoke anon EXECUTE on SECURITY DEFINER trigger functions (they are only meant to run from triggers)
REVOKE EXECUTE ON FUNCTION public.generate_pos_order_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_folio_posting_property_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_journal_entry_line_property_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_ledger_transaction_property_id() FROM anon, PUBLIC;
