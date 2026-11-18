
-- 1. Chart of accounts: drop unscoped duplicates
DROP POLICY IF EXISTS "Admins and managers can manage accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins and managers can manage account groups" ON public.account_groups;
DROP POLICY IF EXISTS "Admins and managers can manage account taxes" ON public.account_taxes;

-- 2. add_ons: drop unscoped, add scoped equivalents
DROP POLICY IF EXISTS "Staff can insert add-ons" ON public.add_ons;
DROP POLICY IF EXISTS "Staff can update add-ons" ON public.add_ons;
DROP POLICY IF EXISTS "Staff can delete add-ons" ON public.add_ons;

CREATE POLICY "Staff can insert add-ons scoped" ON public.add_ons
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role))
  );
CREATE POLICY "Staff can update add-ons scoped" ON public.add_ons
  FOR UPDATE TO authenticated
  USING (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role))
  )
  WITH CHECK (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role))
  );
CREATE POLICY "Staff can delete add-ons scoped" ON public.add_ons
  FOR DELETE TO authenticated
  USING (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role))
  );

-- 3. properties: restrict create/delete to super_admin; drop unscoped update
DROP POLICY IF EXISTS "Admins can create properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can delete properties" ON public.properties;
DROP POLICY IF EXISTS "Staff can update properties" ON public.properties;

CREATE POLICY "Super admins can create properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());
CREATE POLICY "Super admins can delete properties" ON public.properties
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- 4. Rate tables and source_of_business: scope writes to parent property
DROP POLICY IF EXISTS "Staff can manage rate add-ons" ON public.rate_add_ons;
CREATE POLICY "Staff can manage rate add-ons scoped" ON public.rate_add_ons
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rates r WHERE r.id = rate_add_ons.rate_id AND user_has_property_access(r.property_id))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rates r WHERE r.id = rate_add_ons.rate_id AND user_has_property_access(r.property_id))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

DROP POLICY IF EXISTS "Staff can manage rate prices" ON public.rate_site_type_prices;
CREATE POLICY "Staff can manage rate prices scoped" ON public.rate_site_type_prices
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rates r WHERE r.id = rate_site_type_prices.rate_id AND user_has_property_access(r.property_id))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rates r WHERE r.id = rate_site_type_prices.rate_id AND user_has_property_access(r.property_id))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

DROP POLICY IF EXISTS "Staff can manage rate seasons" ON public.rate_seasons;
CREATE POLICY "Staff can manage rate seasons scoped" ON public.rate_seasons
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rates r WHERE r.id = rate_seasons.rate_id AND user_has_property_access(r.property_id))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rates r WHERE r.id = rate_seasons.rate_id AND user_has_property_access(r.property_id))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

DROP POLICY IF EXISTS "Staff can manage source of business" ON public.source_of_business;
CREATE POLICY "Staff can manage source of business scoped" ON public.source_of_business
  FOR ALL TO authenticated
  USING (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    user_has_property_access(property_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- 5. staff_activity_log: scope admin reads to shared-property staff
DROP POLICY IF EXISTS "Admins can view all activity" ON public.staff_activity_log;
CREATE POLICY "Admins can view shared-property activity" ON public.staff_activity_log
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.staff_profiles sp
        JOIN public.user_property_access target ON target.user_id = sp.user_id
        JOIN public.user_property_access viewer ON viewer.user_id = auth.uid()
        WHERE sp.id = staff_activity_log.staff_id
          AND (
            target.property_id = viewer.property_id
            OR (viewer.is_org_admin = true AND viewer.organization_id = target.organization_id)
          )
      )
    )
  );

-- 6. staff_profiles: scope to shared property/organization or self
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.staff_profiles;
CREATE POLICY "Staff can view shared profiles" ON public.staff_profiles
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.user_property_access target
      JOIN public.user_property_access viewer ON viewer.user_id = auth.uid()
      WHERE target.user_id = staff_profiles.user_id
        AND (
          target.property_id = viewer.property_id
          OR (viewer.is_org_admin = true AND viewer.organization_id = target.organization_id)
          OR (target.is_org_admin = true AND target.organization_id = viewer.organization_id)
        )
    )
  );

-- 7. user_roles: only super_admins can assign elevated roles
DROP POLICY IF EXISTS "Admins and super admins can manage roles" ON public.user_roles;

CREATE POLICY "Super admins can manage any role" ON public.user_roles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Admins can manage non-elevated roles in their scope" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND role NOT IN ('super_admin'::app_role, 'internal_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.user_property_access target
      JOIN public.user_property_access viewer ON viewer.user_id = auth.uid()
      WHERE target.user_id = user_roles.user_id
        AND (
          target.property_id = viewer.property_id
          OR (viewer.is_org_admin = true AND viewer.organization_id = target.organization_id)
        )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND role NOT IN ('super_admin'::app_role, 'internal_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.user_property_access target
      JOIN public.user_property_access viewer ON viewer.user_id = auth.uid()
      WHERE target.user_id = user_roles.user_id
        AND (
          target.property_id = viewer.property_id
          OR (viewer.is_org_admin = true AND viewer.organization_id = target.organization_id)
        )
    )
  );
