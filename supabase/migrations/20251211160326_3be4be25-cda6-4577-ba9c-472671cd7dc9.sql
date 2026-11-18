-- Drop overly permissive policies on reservations table
DROP POLICY IF EXISTS "Anyone can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can update reservations" ON public.reservations;

-- Create staff-only SELECT policy
CREATE POLICY "Staff can view reservations"
ON public.reservations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Create staff-only INSERT policy
CREATE POLICY "Staff can create reservations"
ON public.reservations
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- Create staff-only UPDATE policy
CREATE POLICY "Staff can update reservations"
ON public.reservations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);