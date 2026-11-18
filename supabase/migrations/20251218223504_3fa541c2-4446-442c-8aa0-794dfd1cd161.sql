-- Migration 1: Fix properties table RLS
-- Remove public access and add property-scoped policies

-- Drop the dangerous public access policy
DROP POLICY IF EXISTS "Public can view properties" ON public.properties;

-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Authenticated users can update property map" ON public.properties;

-- Add secure SELECT policy - staff can only view properties they have access to
CREATE POLICY "Staff can view accessible properties" 
ON public.properties FOR SELECT TO authenticated
USING (user_has_property_access(id));

-- Add secure UPDATE policy with role checks
CREATE POLICY "Staff can update accessible properties" 
ON public.properties FOR UPDATE TO authenticated
USING (
  user_has_property_access(id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    is_super_admin()
  )
);