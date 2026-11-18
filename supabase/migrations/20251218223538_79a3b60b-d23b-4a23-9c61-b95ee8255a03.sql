-- Migration 3: Fix site_types table RLS
-- Remove public access and add property-scoped policies

-- Drop the dangerous public access policy
DROP POLICY IF EXISTS "Public can view site types" ON public.site_types;

-- Drop existing manage policy that may lack property scoping
DROP POLICY IF EXISTS "Staff can manage site types" ON public.site_types;

-- Add secure SELECT policy
CREATE POLICY "Staff can view property site types" 
ON public.site_types FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

-- Add secure INSERT policy with property scope
CREATE POLICY "Managers can create site types" 
ON public.site_types FOR INSERT TO authenticated
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure UPDATE policy with property scope
CREATE POLICY "Managers can update site types" 
ON public.site_types FOR UPDATE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);

-- Add secure DELETE policy with property scope
CREATE POLICY "Managers can delete site types" 
ON public.site_types FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);