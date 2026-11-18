
-- 1. change_journal: scope inserts to user property access
DROP POLICY IF EXISTS "Authenticated users can insert changes" ON public.change_journal;
CREATE POLICY "Users can insert changes for their properties" ON public.change_journal
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_has_property_access(property_id));

-- 2. organizations: let staff in the org read it
CREATE POLICY "Staff can view their organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR is_org_admin(id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = organizations.id
    )
  );

-- 3. user_custom_roles: scope admin writes via custom_roles.property_id + target user scope
DROP POLICY IF EXISTS "Admins can manage user custom roles" ON public.user_custom_roles;

CREATE POLICY "Super admins manage any user custom role" ON public.user_custom_roles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Admins manage scoped user custom roles" ON public.user_custom_roles
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.custom_roles cr
      WHERE cr.id = user_custom_roles.custom_role_id
        AND user_has_property_access(cr.property_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_property_access target
      JOIN public.user_property_access viewer ON viewer.user_id = auth.uid()
      WHERE target.user_id = user_custom_roles.user_id
        AND (
          target.property_id = viewer.property_id
          OR (viewer.is_org_admin = true AND viewer.organization_id = target.organization_id)
        )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.custom_roles cr
      WHERE cr.id = user_custom_roles.custom_role_id
        AND user_has_property_access(cr.property_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_property_access target
      JOIN public.user_property_access viewer ON viewer.user_id = auth.uid()
      WHERE target.user_id = user_custom_roles.user_id
        AND (
          target.property_id = viewer.property_id
          OR (viewer.is_org_admin = true AND viewer.organization_id = target.organization_id)
        )
    )
  );

-- 4. storage.objects: SELECT policy for campground-maps scoped to property
CREATE POLICY "Staff can list campground maps for their properties"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'campground-maps'
    AND (
      public.is_super_admin()
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
      )
    )
  );
