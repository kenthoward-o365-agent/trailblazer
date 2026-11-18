
-- 1. Tighten execute_readonly_query: only service_role may call (it's used by admin tools via edge function)
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon, authenticated;

-- 2. statement_sends: scope to authenticated staff with property access
DROP POLICY IF EXISTS "Staff can view statement sends" ON public.statement_sends;
DROP POLICY IF EXISTS "Staff can create statement sends" ON public.statement_sends;
CREATE POLICY "Staff can view statement sends"
ON public.statement_sends FOR SELECT TO authenticated
USING (
  public.user_has_property_access(property_id)
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'front_desk') OR is_super_admin())
);
CREATE POLICY "Staff can create statement sends"
ON public.statement_sends FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_property_access(property_id)
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'front_desk') OR is_super_admin())
);

-- 3. user_custom_roles: restrict SELECT to authenticated users who can see the target user (same org/property)
DROP POLICY IF EXISTS "Authenticated staff can view user custom roles" ON public.user_custom_roles;
CREATE POLICY "Staff can view user custom roles in their orgs"
ON public.user_custom_roles FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_property_access self
    JOIN public.user_property_access target ON target.user_id = user_custom_roles.user_id
    WHERE self.user_id = auth.uid()
      AND (
        (self.is_org_admin = true AND self.organization_id = target.organization_id)
        OR self.property_id = target.property_id
      )
  )
);

-- 4. Storage: campground-maps — enforce property-scoped path on write/delete, drop broad listing
DROP POLICY IF EXISTS "Authenticated users can upload campground maps" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update campground maps" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete campground maps" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload campground maps" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update campground maps" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view campground maps" ON storage.objects;
DROP POLICY IF EXISTS "Public users can view campground maps" ON storage.objects;

CREATE POLICY "Staff can upload campground maps for accessible property"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'campground-maps'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR is_super_admin())
);
CREATE POLICY "Staff can update campground maps for accessible property"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'campground-maps'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "Staff can delete campground maps for accessible property"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'campground-maps'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR is_super_admin())
);
-- No SELECT policy on storage.objects: public bucket still allows direct getPublicUrl reads, but listing is blocked.

-- 5. Storage: campaign-images — same property-scoped pattern
DROP POLICY IF EXISTS "Authenticated users can upload campaign images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete campaign images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view campaign images" ON storage.objects;

CREATE POLICY "Staff can upload campaign images for accessible property"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'campaign-images'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "Staff can delete campaign images for accessible property"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'campaign-images'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
);
