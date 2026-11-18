-- Phase 2.2: Fix ledger tables RLS - ledger_accounts, ledger_transactions, folio_postings

-- Drop existing policies for ledger_accounts
DROP POLICY IF EXISTS "Staff can view ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Staff can create ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Staff can update ledger accounts" ON public.ledger_accounts;

-- Create properly scoped policies for ledger_accounts
CREATE POLICY "Staff can view property ledger accounts" 
ON public.ledger_accounts FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can insert property ledger accounts" 
ON public.ledger_accounts FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Staff can update property ledger accounts" 
ON public.ledger_accounts FOR UPDATE TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can delete ledger accounts" 
ON public.ledger_accounts FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for ledger_transactions
DROP POLICY IF EXISTS "Staff can view ledger transactions" ON public.ledger_transactions;
DROP POLICY IF EXISTS "Staff can create ledger transactions" ON public.ledger_transactions;
DROP POLICY IF EXISTS "Admins and managers can manage ledger transactions" ON public.ledger_transactions;

-- Create properly scoped policies for ledger_transactions (via ledger_accounts)
CREATE POLICY "Staff can view property ledger transactions" 
ON public.ledger_transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la 
    WHERE la.id = ledger_transactions.ledger_account_id 
    AND user_has_property_access(la.property_id)
  )
);

CREATE POLICY "Staff can insert property ledger transactions" 
ON public.ledger_transactions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la 
    WHERE la.id = ledger_transactions.ledger_account_id 
    AND user_has_property_access(la.property_id)
  )
);

CREATE POLICY "Managers can update ledger transactions" 
ON public.ledger_transactions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la 
    WHERE la.id = ledger_transactions.ledger_account_id 
    AND user_has_property_access(la.property_id)
  ) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for folio_postings
DROP POLICY IF EXISTS "Staff can view folio postings" ON public.folio_postings;
DROP POLICY IF EXISTS "Staff can create folio postings" ON public.folio_postings;

-- Create properly scoped policies for folio_postings (via ledger_accounts)
CREATE POLICY "Staff can view property folio postings" 
ON public.folio_postings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la 
    WHERE la.id = folio_postings.ledger_account_id 
    AND user_has_property_access(la.property_id)
  )
);

CREATE POLICY "Staff can insert property folio postings" 
ON public.folio_postings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la 
    WHERE la.id = folio_postings.ledger_account_id 
    AND user_has_property_access(la.property_id)
  )
);

CREATE POLICY "Managers can update folio postings" 
ON public.folio_postings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ledger_accounts la 
    WHERE la.id = folio_postings.ledger_account_id 
    AND user_has_property_access(la.property_id)
  ) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);