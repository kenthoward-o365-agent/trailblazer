-- Migration 4: Fix rate_rules table RLS
-- Remove public access and add property-scoped policies

-- Drop the dangerous public access policy (if not already dropped)
DROP POLICY IF EXISTS "Public can view rate rules" ON public.rate_rules;

-- Drop existing policies that may lack property scoping
DROP POLICY IF EXISTS "Staff can manage rate rules" ON public.rate_rules;

-- Add secure SELECT policy with property scope
CREATE POLICY "Staff can view property rate rules" 
ON public.rate_rules FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

-- Add secure INSERT policy with property scope
CREATE POLICY "Managers can create rate rules" 
ON public.rate_rules FOR INSERT TO authenticated
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure UPDATE policy with property scope
CREATE POLICY "Managers can update rate rules" 
ON public.rate_rules FOR UPDATE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure DELETE policy with property scope
CREATE POLICY "Managers can delete rate rules" 
ON public.rate_rules FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);