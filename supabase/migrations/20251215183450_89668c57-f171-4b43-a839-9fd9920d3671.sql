-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Staff can view folio postings" ON public.folio_postings;

-- Create a properly secured SELECT policy that requires staff roles
CREATE POLICY "Staff can view folio postings" 
ON public.folio_postings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);