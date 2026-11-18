
-- Revoke public execute on current_user_has_mfa (SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.current_user_has_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_mfa() TO authenticated, service_role;

-- OTA connections: restrict SELECT to admin/manager
DROP POLICY IF EXISTS "Staff can view property OTA connections" ON public.ota_connections;
CREATE POLICY "Admins can view property OTA connections"
ON public.ota_connections FOR SELECT TO authenticated
USING (
  user_has_property_access(property_id)
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR is_super_admin())
);

-- Payment authorizations: require MFA
DROP POLICY IF EXISTS "Staff can view property payment authorizations" ON public.payment_authorizations;
CREATE POLICY "MFA staff view payment authorizations"
ON public.payment_authorizations FOR SELECT TO authenticated
USING (current_user_has_mfa() AND user_has_property_access(property_id));

-- Payment transactions: require MFA
DROP POLICY IF EXISTS "Staff can view property payment transactions" ON public.payment_transactions;
CREATE POLICY "MFA staff view payment transactions"
ON public.payment_transactions FOR SELECT TO authenticated
USING (current_user_has_mfa() AND user_has_property_access(property_id));

-- Payment cards: explicit deny INSERT/UPDATE for authenticated (service_role bypasses RLS)
CREATE POLICY "Payment cards: deny authenticated inserts"
ON public.payment_cards FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Payment cards: deny authenticated updates"
ON public.payment_cards FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);
