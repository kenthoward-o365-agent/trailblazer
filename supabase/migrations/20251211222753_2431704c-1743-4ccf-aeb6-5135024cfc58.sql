-- Phase 2: Create user_has_property_access function for RLS policies
CREATE OR REPLACE FUNCTION public.user_has_property_access(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    is_super_admin() 
    OR EXISTS (
      SELECT 1 FROM user_property_access upa
      JOIN properties p ON p.id = _property_id
      WHERE upa.user_id = auth.uid()
      AND (
        upa.property_id = _property_id
        OR (upa.is_org_admin = true AND upa.organization_id = p.organization_id)
      )
    )
$$;

-- Phase 4: Guest Sharing Groups - Create tables
CREATE TABLE IF NOT EXISTS public.guest_sharing_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_sharing_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.guest_sharing_groups(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, property_id)
);

-- Add organization_id and origin_property_id to guests table
ALTER TABLE public.guests 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS origin_property_id UUID REFERENCES public.properties(id);

-- Create index for efficient guest lookups
CREATE INDEX IF NOT EXISTS idx_guests_organization_id ON public.guests(organization_id);
CREATE INDEX IF NOT EXISTS idx_guests_origin_property_id ON public.guests(origin_property_id);
CREATE INDEX IF NOT EXISTS idx_guest_sharing_group_members_property ON public.guest_sharing_group_members(property_id);

-- Enable RLS on new tables
ALTER TABLE public.guest_sharing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_sharing_group_members ENABLE ROW LEVEL SECURITY;

-- RLS for guest_sharing_groups
CREATE POLICY "Org admins can manage sharing groups"
ON public.guest_sharing_groups
FOR ALL
USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "Staff can view sharing groups in their org"
ON public.guest_sharing_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_property_access upa
    WHERE upa.user_id = auth.uid()
    AND upa.organization_id = guest_sharing_groups.organization_id
  )
);

-- RLS for guest_sharing_group_members
CREATE POLICY "Org admins can manage group members"
ON public.guest_sharing_group_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM guest_sharing_groups gsg
    WHERE gsg.id = guest_sharing_group_members.group_id
    AND (is_super_admin() OR is_org_admin(gsg.organization_id))
  )
);

CREATE POLICY "Staff can view group members"
ON public.guest_sharing_group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM guest_sharing_groups gsg
    JOIN user_property_access upa ON upa.organization_id = gsg.organization_id
    WHERE gsg.id = guest_sharing_group_members.group_id
    AND upa.user_id = auth.uid()
  )
);

-- Create can_access_guest function for guest visibility
CREATE OR REPLACE FUNCTION public.can_access_guest(_guest_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guest_org_id uuid;
  guest_origin_property uuid;
  property_org_id uuid;
BEGIN
  -- Super admins can access all guests
  IF is_super_admin() THEN RETURN TRUE; END IF;

  -- Get guest's organization and origin property
  SELECT organization_id, origin_property_id INTO guest_org_id, guest_origin_property
  FROM guests WHERE id = _guest_id;

  -- Get property's organization
  SELECT organization_id INTO property_org_id
  FROM properties WHERE id = _property_id;

  -- If guest has no organization (legacy), allow access based on property access
  IF guest_org_id IS NULL THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  -- If guest is from the same property, allow access
  IF guest_origin_property = _property_id THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  -- Check if properties are in the same sharing group
  IF EXISTS (
    SELECT 1 
    FROM guest_sharing_group_members gsgm1
    JOIN guest_sharing_group_members gsgm2 ON gsgm1.group_id = gsgm2.group_id
    WHERE gsgm1.property_id = guest_origin_property
    AND gsgm2.property_id = _property_id
  ) THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  RETURN FALSE;
END;
$$;

-- Update guests table RLS to use can_access_guest for cross-property sharing
-- First drop existing policies that might conflict
DROP POLICY IF EXISTS "Staff can view guests" ON public.guests;
DROP POLICY IF EXISTS "Staff can create guests" ON public.guests;
DROP POLICY IF EXISTS "Staff can update guests" ON public.guests;

-- Create new policies that support property-level guest isolation with sharing
CREATE POLICY "Staff can view guests"
ON public.guests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role) 
  OR has_role(auth.uid(), 'front_desk'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Staff can create guests"
ON public.guests
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role) 
  OR has_role(auth.uid(), 'front_desk'::app_role)
);

CREATE POLICY "Staff can update guests"
ON public.guests
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role) 
  OR has_role(auth.uid(), 'front_desk'::app_role)
);

-- Add trigger for updated_at on guest_sharing_groups
CREATE TRIGGER update_guest_sharing_groups_updated_at
  BEFORE UPDATE ON public.guest_sharing_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();