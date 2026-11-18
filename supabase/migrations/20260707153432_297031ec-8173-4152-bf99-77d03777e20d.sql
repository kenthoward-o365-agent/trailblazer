
-- 1. Fix site_custom_attributes SELECT "OR true" bypass
DROP POLICY IF EXISTS "Users can view custom attributes for their properties" ON public.site_custom_attributes;
CREATE POLICY "Users can view custom attributes for their properties"
  ON public.site_custom_attributes FOR SELECT
  TO authenticated
  USING (user_can_access_property(property_id));

-- 2. Revoke anon EXECUTE on trigger helper function
REVOKE EXECUTE ON FUNCTION public.enforce_max_site_custom_attributes() FROM PUBLIC, anon;

-- 3. Require MFA to read QuickBooks tokens on accounting_integrations
DROP POLICY IF EXISTS "Admins/managers can view accounting integrations" ON public.accounting_integrations;
CREATE POLICY "Admins/managers can view accounting integrations"
  ON public.accounting_integrations FOR SELECT
  TO authenticated
  USING (
    user_has_property_access(property_id)
    AND (is_super_admin() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    AND current_user_has_mfa()
  );

-- 4. Require MFA to read OTA connection API keys
DROP POLICY IF EXISTS "Admins can view property OTA connections" ON public.ota_connections;
CREATE POLICY "Admins can view property OTA connections"
  ON public.ota_connections FOR SELECT
  TO authenticated
  USING (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR is_super_admin())
    AND current_user_has_mfa()
  );

-- 5. Add restrictive UPDATE/DELETE policies on api_logs (fail-closed hardening)
CREATE POLICY "Nobody can update api_logs"
  ON public.api_logs FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "Nobody can delete api_logs"
  ON public.api_logs FOR DELETE
  TO authenticated
  USING (false);

-- 6. Add explicit INSERT/UPDATE/DELETE policies to guest_sharing_group_members
-- (existing ALL policy covers org admins; add explicit scoped ones for clarity/coverage)
CREATE POLICY "Org admins can insert group members"
  ON public.guest_sharing_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guest_sharing_groups gsg
      WHERE gsg.id = guest_sharing_group_members.group_id
        AND (is_super_admin() OR is_org_admin(gsg.organization_id))
    )
    AND EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.guest_sharing_groups gsg ON gsg.id = guest_sharing_group_members.group_id
      WHERE p.id = guest_sharing_group_members.property_id
        AND p.organization_id = gsg.organization_id
    )
  );

CREATE POLICY "Org admins can delete group members"
  ON public.guest_sharing_group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guest_sharing_groups gsg
      WHERE gsg.id = guest_sharing_group_members.group_id
        AND (is_super_admin() OR is_org_admin(gsg.organization_id))
    )
  );
