-- Phase 2.4: Fix payment tables RLS - payment_cards, payment_authorizations, payment_transactions

-- Drop existing policies for payment_cards
DROP POLICY IF EXISTS "Staff can view payment cards" ON public.payment_cards;
DROP POLICY IF EXISTS "Staff can create payment cards" ON public.payment_cards;
DROP POLICY IF EXISTS "Staff can update payment cards" ON public.payment_cards;
DROP POLICY IF EXISTS "Admins and managers can delete payment cards" ON public.payment_cards;

-- Create properly scoped policies for payment_cards
CREATE POLICY "Staff can view property payment cards" 
ON public.payment_cards FOR SELECT TO authenticated
USING (
  (property_id IS NOT NULL AND user_has_property_access(property_id))
  OR
  -- Also allow viewing via ledger_account
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la
    WHERE la.id = payment_cards.ledger_account_id
    AND user_has_property_access(la.property_id)
  )
  OR is_super_admin()
);

CREATE POLICY "Staff can create property payment cards" 
ON public.payment_cards FOR INSERT TO authenticated
WITH CHECK (
  (property_id IS NOT NULL AND user_has_property_access(property_id))
  OR
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la
    WHERE la.id = payment_cards.ledger_account_id
    AND user_has_property_access(la.property_id)
  )
);

CREATE POLICY "Staff can update property payment cards" 
ON public.payment_cards FOR UPDATE TO authenticated
USING (
  (property_id IS NOT NULL AND user_has_property_access(property_id))
  OR
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la
    WHERE la.id = payment_cards.ledger_account_id
    AND user_has_property_access(la.property_id)
  )
);

CREATE POLICY "Managers can delete property payment cards" 
ON public.payment_cards FOR DELETE TO authenticated
USING (
  (
    (property_id IS NOT NULL AND user_has_property_access(property_id))
    OR
    EXISTS (
      SELECT 1 FROM public.ledger_accounts la
      WHERE la.id = payment_cards.ledger_account_id
      AND user_has_property_access(la.property_id)
    )
  )
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- Drop existing policies for payment_authorizations
DROP POLICY IF EXISTS "Staff can view payment authorizations" ON public.payment_authorizations;
DROP POLICY IF EXISTS "Staff can create payment authorizations" ON public.payment_authorizations;
DROP POLICY IF EXISTS "Staff can update payment authorizations" ON public.payment_authorizations;

-- Create properly scoped policies for payment_authorizations
CREATE POLICY "Staff can view property payment authorizations" 
ON public.payment_authorizations FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property payment authorizations" 
ON public.payment_authorizations FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Staff can update property payment authorizations" 
ON public.payment_authorizations FOR UPDATE TO authenticated
USING (user_has_property_access(property_id));

-- Drop existing policies for payment_transactions
DROP POLICY IF EXISTS "Staff can view payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can create payment transactions" ON public.payment_transactions;

-- Create properly scoped policies for payment_transactions
CREATE POLICY "Staff can view property payment transactions" 
ON public.payment_transactions FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property payment transactions" 
ON public.payment_transactions FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));