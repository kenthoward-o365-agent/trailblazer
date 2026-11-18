-- Migration 2: Fix sites table RLS
-- Remove public access and add property-scoped policies

-- Drop the dangerous public access policy
DROP POLICY IF EXISTS "Public can view active sites" ON public.sites;

-- Drop existing write policies that lack property scoping
DROP POLICY IF EXISTS "Admins and managers can update sites" ON public.sites;
DROP POLICY IF EXISTS "Front desk can update sites" ON public.sites;
DROP POLICY IF EXISTS "Staff can create sites" ON public.sites;
DROP POLICY IF EXISTS "Staff can delete sites" ON public.sites;

-- Add secure SELECT policy
CREATE POLICY "Staff can view property sites" 
ON public.sites FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

-- Add secure UPDATE policy with property scope
CREATE POLICY "Staff can update property sites" 
ON public.sites FOR UPDATE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'front_desk') OR
    is_super_admin()
  )
);

-- Add secure INSERT policy with property scope
CREATE POLICY "Managers can create property sites" 
ON public.sites FOR INSERT TO authenticated
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure DELETE policy with property scope
CREATE POLICY "Managers can delete property sites" 
ON public.sites FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);