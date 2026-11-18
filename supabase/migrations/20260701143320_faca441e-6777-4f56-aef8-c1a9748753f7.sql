
-- 1. Helper: is the current session MFA-verified (aal2)?
CREATE OR REPLACE FUNCTION public.current_user_has_mfa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_mfa() TO authenticated, service_role;

-- 2. payment_cards: writes are backend-only; SELECT gated on MFA
DROP POLICY IF EXISTS "Staff can create property payment cards" ON public.payment_cards;
DROP POLICY IF EXISTS "Staff can update property payment cards" ON public.payment_cards;
DROP POLICY IF EXISTS "Managers can delete property payment cards" ON public.payment_cards;
DROP POLICY IF EXISTS "Staff can view property payment cards" ON public.payment_cards;

CREATE POLICY "Payment cards: MFA staff read"
ON public.payment_cards
FOR SELECT
TO authenticated
USING (
  public.current_user_has_mfa()
  AND (
    ((property_id IS NOT NULL) AND public.user_has_property_access(property_id))
    OR EXISTS (
      SELECT 1 FROM public.ledger_accounts la
      WHERE la.id = payment_cards.ledger_account_id
        AND public.user_has_property_access(la.property_id)
    )
    OR public.is_super_admin()
  )
);

-- INSERT / UPDATE / DELETE: no policy for authenticated => denied. service_role bypasses RLS.

-- 3. payment_authorizations: writes backend-only
DROP POLICY IF EXISTS "Staff can create property payment authorizations" ON public.payment_authorizations;
DROP POLICY IF EXISTS "Staff can update property payment authorizations" ON public.payment_authorizations;

-- keep existing SELECT policy; it stays property-scoped

-- 4. payment_transactions: writes backend-only
DROP POLICY IF EXISTS "Staff can create property payment transactions" ON public.payment_transactions;

-- keep existing SELECT policy

-- 5. Revoke direct table write privileges from authenticated so RLS bypass via
--    grants alone can't happen. SELECT stays granted for the SELECT policies to work.
REVOKE INSERT, UPDATE, DELETE ON public.payment_cards FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_authorizations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM authenticated;

GRANT ALL ON public.payment_cards TO service_role;
GRANT ALL ON public.payment_authorizations TO service_role;
GRANT ALL ON public.payment_transactions TO service_role;
