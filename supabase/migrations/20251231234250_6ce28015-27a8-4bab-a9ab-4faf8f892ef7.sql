-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Staff can view source of business" ON public.source_of_business;

-- Create a proper SELECT policy that requires property access
CREATE POLICY "Staff can view source of business" 
ON public.source_of_business 
FOR SELECT 
USING (user_has_property_access(property_id));