
-- Fix rate_add_ons security: remove public SELECT policy and add property-based access

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Staff can view rate add-ons" ON rate_add_ons;

-- Create a new policy that restricts SELECT to authenticated staff with property access
-- Access is determined by joining through the rates table to get property_id
CREATE POLICY "Staff can view rate add-ons" 
ON rate_add_ons 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rates r
    WHERE r.id = rate_add_ons.rate_id
    AND user_has_property_access(r.property_id)
  )
);
