-- Add a restrictive policy - no one needs direct access to this table
-- The trigger function runs as SECURITY DEFINER and bypasses RLS
CREATE POLICY "No direct access to confirmation sequences"
ON public.property_confirmation_sequences
FOR ALL
USING (false);