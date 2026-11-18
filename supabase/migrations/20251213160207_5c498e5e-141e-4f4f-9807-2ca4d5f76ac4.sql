-- Custom roles table (property-specific)
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, name)
);

-- User custom role assignments
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  custom_role_id uuid NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, custom_role_id)
);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_roles
CREATE POLICY "Staff can view custom roles" ON public.custom_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage custom roles" ON public.custom_roles
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM user_property_access upa 
      JOIN properties p ON p.id = custom_roles.property_id
      WHERE upa.user_id = auth.uid() 
      AND upa.organization_id = p.organization_id 
      AND upa.is_org_admin = true
    )
  );

-- RLS Policies for user_custom_roles
CREATE POLICY "Staff can view user custom roles" ON public.user_custom_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage user custom roles" ON public.user_custom_roles
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM user_property_access upa 
      WHERE upa.user_id = auth.uid() 
      AND upa.is_org_admin = true
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();