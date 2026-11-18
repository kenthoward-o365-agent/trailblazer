-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Staff can view rate prices" ON public.rate_site_type_prices;

-- Create proper SELECT policy that requires property access via rates table
CREATE POLICY "Staff can view rate prices" 
ON public.rate_site_type_prices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.rates r 
    WHERE r.id = rate_id 
    AND user_has_property_access(r.property_id)
  )
);