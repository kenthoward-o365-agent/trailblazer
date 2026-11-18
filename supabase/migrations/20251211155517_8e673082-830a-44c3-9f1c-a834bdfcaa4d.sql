-- Drop the overly permissive SELECT policy on guests table
DROP POLICY IF EXISTS "Guests can view own data" ON public.guests;

-- Create new policy that restricts guest data to authenticated staff only
CREATE POLICY "Staff can view guests"
ON public.guests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add UPDATE policy for staff to update guest information
CREATE POLICY "Staff can update guests"
ON public.guests
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- Update INSERT policy to be staff-only as well
DROP POLICY IF EXISTS "Anyone can create guest" ON public.guests;

CREATE POLICY "Staff can create guests"
ON public.guests
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);