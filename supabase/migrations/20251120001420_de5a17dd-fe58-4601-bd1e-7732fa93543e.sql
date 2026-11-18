-- Add RLS policies to allow staff to update properties
CREATE POLICY "Staff can update properties"
ON public.properties
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Allow all authenticated users to update map-related fields for now
-- This can be restricted further if needed
CREATE POLICY "Authenticated users can update property map"
ON public.properties
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);