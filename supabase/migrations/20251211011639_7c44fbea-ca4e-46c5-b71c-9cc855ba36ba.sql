-- Create a security definer function to check org admin status without recursion
CREATE OR REPLACE FUNCTION public.is_org_admin(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_property_access
    WHERE user_id = auth.uid() 
    AND organization_id = _organization_id 
    AND is_org_admin = true
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Org admins can manage their org user access" ON public.user_property_access;
DROP POLICY IF EXISTS "Org users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can view their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Org users can view their property groups" ON public.property_groups;

-- Recreate policies using the security definer function
CREATE POLICY "Org admins can manage their org user access" 
ON public.user_property_access 
FOR ALL 
USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "Org users can view their organization" 
ON public.organizations 
FOR SELECT 
USING (is_super_admin() OR is_org_admin(id));

CREATE POLICY "Org admins can view their subscription" 
ON public.subscriptions 
FOR SELECT 
USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "Org users can view their property groups" 
ON public.property_groups 
FOR SELECT 
USING (is_super_admin() OR is_org_admin(organization_id));