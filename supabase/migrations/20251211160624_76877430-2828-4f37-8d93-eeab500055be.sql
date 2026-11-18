-- Update user_roles policies to allow admin and super_admin to manage roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Admins and super admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins and super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update staff_profiles policies to allow all staff roles to view profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.staff_profiles;

CREATE POLICY "Staff can view all profiles"
ON public.staff_profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);