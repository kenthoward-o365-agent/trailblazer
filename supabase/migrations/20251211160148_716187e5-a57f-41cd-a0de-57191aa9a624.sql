-- Drop the overly permissive SELECT policy on ledger_accounts table
DROP POLICY IF EXISTS "Staff can view ledger accounts" ON public.ledger_accounts;

-- Create new policy that restricts ledger account data to authenticated staff only
CREATE POLICY "Staff can view ledger accounts"
ON public.ledger_accounts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);