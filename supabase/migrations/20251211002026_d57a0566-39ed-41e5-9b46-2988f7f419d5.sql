-- Phase 1b: Core Multi-Tenant Tables, Functions, and RLS

-- 1.2 Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  billing_email TEXT,
  payment_status TEXT NOT NULL DEFAULT 'active' CHECK (payment_status IN ('active', 'suspended', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  max_sites INTEGER NOT NULL DEFAULT 50,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  price_per_site NUMERIC NOT NULL DEFAULT 0,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- 1.4 Create property_groups table (for Chains/Management Companies)
CREATE TABLE public.property_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  share_chart_of_accounts BOOLEAN NOT NULL DEFAULT false,
  share_reporting BOOLEAN NOT NULL DEFAULT false,
  share_user_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.5 Add columns to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS property_group_id UUID REFERENCES public.property_groups(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 1.6 Create user_property_access table
CREATE TABLE public.user_property_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  is_org_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- 1.7 Create indexes for performance
CREATE INDEX idx_user_property_access_user ON public.user_property_access(user_id);
CREATE INDEX idx_user_property_access_org ON public.user_property_access(organization_id);
CREATE INDEX idx_properties_organization ON public.properties(organization_id);
CREATE INDEX idx_properties_group ON public.properties(property_group_id);

-- 1.8 Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_property_access ENABLE ROW LEVEL SECURITY;

-- 1.9 Create super_admin check function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- 1.10 Create user property access check function
CREATE OR REPLACE FUNCTION public.user_can_access_property(_property_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins can access everything
  IF is_super_admin() THEN RETURN TRUE; END IF;
  
  -- Check direct property access or org admin status
  RETURN EXISTS (
    SELECT 1 FROM public.user_property_access upa
    JOIN public.properties p ON p.id = _property_id
    WHERE upa.user_id = auth.uid()
    AND (
      upa.property_id = _property_id 
      OR (upa.is_org_admin = true AND upa.organization_id = p.organization_id)
    )
  );
END;
$$;

-- 1.11 RLS Policies for organizations
CREATE POLICY "Super admins can manage organizations"
ON public.organizations FOR ALL
USING (is_super_admin());

CREATE POLICY "Org users can view their organization"
ON public.organizations FOR SELECT
USING (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM public.user_property_access
    WHERE user_id = auth.uid() AND organization_id = organizations.id
  )
);

-- 1.12 RLS Policies for subscriptions
CREATE POLICY "Super admins can manage subscriptions"
ON public.subscriptions FOR ALL
USING (is_super_admin());

CREATE POLICY "Org admins can view their subscription"
ON public.subscriptions FOR SELECT
USING (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM public.user_property_access
    WHERE user_id = auth.uid() 
    AND organization_id = subscriptions.organization_id
    AND is_org_admin = true
  )
);

-- 1.13 RLS Policies for property_groups
CREATE POLICY "Super admins can manage property groups"
ON public.property_groups FOR ALL
USING (is_super_admin());

CREATE POLICY "Org users can view their property groups"
ON public.property_groups FOR SELECT
USING (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM public.user_property_access
    WHERE user_id = auth.uid() AND organization_id = property_groups.organization_id
  )
);

-- 1.14 RLS Policies for user_property_access
CREATE POLICY "Super admins can manage user access"
ON public.user_property_access FOR ALL
USING (is_super_admin());

CREATE POLICY "Org admins can manage their org user access"
ON public.user_property_access FOR ALL
USING (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM public.user_property_access upa
    WHERE upa.user_id = auth.uid() 
    AND upa.organization_id = user_property_access.organization_id
    AND upa.is_org_admin = true
  )
);

CREATE POLICY "Users can view their own access"
ON public.user_property_access FOR SELECT
USING (user_id = auth.uid());

-- 1.15 Add updated_at triggers
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_groups_updated_at
BEFORE UPDATE ON public.property_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.16 Site limit enforcement trigger
CREATE OR REPLACE FUNCTION public.check_site_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  -- Get organization from property
  SELECT p.organization_id INTO org_id 
  FROM public.properties p WHERE p.id = NEW.property_id;
  
  -- If no organization set, allow (for migration period)
  IF org_id IS NULL THEN RETURN NEW; END IF;
  
  -- Get max sites from subscription
  SELECT s.max_sites INTO max_allowed
  FROM public.subscriptions s WHERE s.organization_id = org_id;
  
  -- If no subscription, allow (for migration period)
  IF max_allowed IS NULL THEN RETURN NEW; END IF;
  
  -- Count ALL sites across all properties in org
  SELECT COUNT(*) INTO current_count
  FROM public.sites s
  JOIN public.properties p ON p.id = s.property_id
  WHERE p.organization_id = org_id;
  
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Site limit reached (% of %). Please contact sales to increase your subscription.', current_count, max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_site_limit
BEFORE INSERT ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.check_site_limit();