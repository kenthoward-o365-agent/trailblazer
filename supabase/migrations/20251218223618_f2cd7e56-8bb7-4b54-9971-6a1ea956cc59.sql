-- Migration 5: Fix seasons table RLS
-- Remove public access and add property-scoped policies

-- Drop the dangerous public access policy
DROP POLICY IF EXISTS "Public can view seasons" ON public.seasons;

-- Drop existing policies that may lack property scoping
DROP POLICY IF EXISTS "Staff can manage seasons" ON public.seasons;

-- Add secure SELECT policy with property scope
CREATE POLICY "Staff can view property seasons" 
ON public.seasons FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

-- Add secure INSERT policy with property scope
CREATE POLICY "Managers can create seasons" 
ON public.seasons FOR INSERT TO authenticated
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure UPDATE policy with property scope
CREATE POLICY "Managers can update seasons" 
ON public.seasons FOR UPDATE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure DELETE policy with property scope
CREATE POLICY "Managers can delete seasons" 
ON public.seasons FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);