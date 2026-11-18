
REVOKE EXECUTE ON FUNCTION public.assign_organization_client_number() FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Public read booking gallery" ON storage.objects;

REVOKE SELECT ON public.ota_connections FROM authenticated, anon;
GRANT SELECT (id, property_id, ota_name, api_endpoint, is_active, created_at, updated_at)
  ON public.ota_connections TO authenticated;

DROP POLICY IF EXISTS "Admins and super admins can view all roles" ON public.user_roles;

CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (is_super_admin());

CREATE POLICY "Admins can view roles in their scope"
ON public.user_roles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_property_access target
    JOIN public.user_property_access self
      ON self.user_id = auth.uid()
     AND (
       self.property_id = target.property_id
       OR (self.is_org_admin = true AND self.organization_id = target.organization_id)
     )
    WHERE target.user_id = user_roles.user_id
  )
);
