
-- =========================================================
-- PHASE 1 ENTERPRISE FOUNDATIONS
-- Brand & Region hierarchy, Central Household, Guest Identities
-- =========================================================

-- ---- Extend app_role enum with brand_admin and regional_manager ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'brand_admin' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'brand_admin';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'regional_manager' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'regional_manager';
  END IF;
END $$;

-- =========================================================
-- 1. BRANDS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  slug text,
  description text,
  logo_url text,
  primary_color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_brands_org ON public.brands(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. REGIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, name)
);

CREATE INDEX IF NOT EXISTS idx_regions_brand ON public.regions(brand_id);
CREATE INDEX IF NOT EXISTS idx_regions_org ON public.regions(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 3. PROPERTIES: add brand_id and region_id
-- =========================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_brand ON public.properties(brand_id);
CREATE INDEX IF NOT EXISTS idx_properties_region ON public.properties(region_id);

-- =========================================================
-- 4. USER BRAND / REGION ACCESS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_brand_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_brand_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_uba_user ON public.user_brand_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uba_brand ON public.user_brand_access(brand_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_brand_access TO authenticated;
GRANT ALL ON public.user_brand_access TO service_role;
ALTER TABLE public.user_brand_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_region_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_ura_user ON public.user_region_access(user_id);
CREATE INDEX IF NOT EXISTS idx_ura_region ON public.user_region_access(region_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_region_access TO authenticated;
GRANT ALL ON public.user_region_access TO service_role;
ALTER TABLE public.user_region_access ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5. HOUSEHOLDS (central family record)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text,
  primary_email text,
  primary_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  ltv_amount numeric(12,2) NOT NULL DEFAULT 0,
  stay_count integer NOT NULL DEFAULT 0,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_households_org ON public.households(organization_id);
CREATE INDEX IF NOT EXISTS idx_households_email ON public.households(primary_email);
CREATE INDEX IF NOT EXISTS idx_households_phone ON public.households(primary_phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. GUEST IDENTITIES (dedupe keys)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.guest_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  identity_type text NOT NULL CHECK (identity_type IN ('email','phone','external_id')),
  identity_value text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, identity_type, identity_value)
);

CREATE INDEX IF NOT EXISTS idx_gi_guest ON public.guest_identities(guest_id);
CREATE INDEX IF NOT EXISTS idx_gi_org_value ON public.guest_identities(organization_id, identity_value);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_identities TO authenticated;
GRANT ALL ON public.guest_identities TO service_role;
ALTER TABLE public.guest_identities ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 7. GUESTS: household + master link
-- =========================================================
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS master_guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guests_household ON public.guests(household_id);
CREATE INDEX IF NOT EXISTS idx_guests_master ON public.guests(master_guest_id);

-- =========================================================
-- 8. HELPER FUNCTIONS (SECURITY DEFINER, no RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_has_brand_access(_brand_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_brand_access
      WHERE user_id = auth.uid() AND brand_id = _brand_id
    )
    OR EXISTS (
      SELECT 1 FROM public.brands b
      JOIN public.user_property_access upa ON upa.organization_id = b.organization_id
      WHERE b.id = _brand_id
        AND upa.user_id = auth.uid()
        AND upa.is_org_admin = true
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_region_access(_region_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_region_access
      WHERE user_id = auth.uid() AND region_id = _region_id
    )
    OR EXISTS (
      SELECT 1 FROM public.regions r
      WHERE r.id = _region_id
        AND public.user_has_brand_access(r.brand_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_admin_access(_organization_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_property_access
      WHERE user_id = auth.uid()
        AND organization_id = _organization_id
        AND is_org_admin = true
    );
$$;

-- Extend property access to include brand/region scoping
CREATE OR REPLACE FUNCTION public.user_can_access_property(_property_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _brand_id uuid;
  _region_id uuid;
BEGIN
  IF public.is_super_admin() THEN RETURN TRUE; END IF;

  -- Existing direct property or org admin path
  IF EXISTS (
    SELECT 1 FROM public.user_property_access upa
    JOIN public.properties p ON p.id = _property_id
    WHERE upa.user_id = auth.uid()
    AND (
      upa.property_id = _property_id
      OR (upa.is_org_admin = true AND upa.organization_id = p.organization_id)
    )
  ) THEN
    RETURN TRUE;
  END IF;

  -- New: brand/region scoped access
  SELECT brand_id, region_id INTO _brand_id, _region_id
  FROM public.properties WHERE id = _property_id;

  IF _brand_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_brand_access
    WHERE user_id = auth.uid() AND brand_id = _brand_id
  ) THEN RETURN TRUE; END IF;

  IF _region_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_region_access
    WHERE user_id = auth.uid() AND region_id = _region_id
  ) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- =========================================================
-- 9. RLS POLICIES
-- =========================================================

-- brands
DROP POLICY IF EXISTS "brands_select" ON public.brands;
CREATE POLICY "brands_select" ON public.brands
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR public.user_has_brand_access(id)
  );

DROP POLICY IF EXISTS "brands_write" ON public.brands;
CREATE POLICY "brands_write" ON public.brands
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));

-- regions
DROP POLICY IF EXISTS "regions_select" ON public.regions;
CREATE POLICY "regions_select" ON public.regions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR public.user_has_brand_access(brand_id)
    OR public.user_has_region_access(id)
  );

DROP POLICY IF EXISTS "regions_write" ON public.regions;
CREATE POLICY "regions_write" ON public.regions
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (public.user_has_brand_access(brand_id) AND EXISTS (
      SELECT 1 FROM public.user_brand_access
      WHERE user_id = auth.uid() AND brand_id = regions.brand_id AND is_brand_admin = true
    ))
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
  );

-- user_brand_access
DROP POLICY IF EXISTS "uba_select" ON public.user_brand_access;
CREATE POLICY "uba_select" ON public.user_brand_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
  );

DROP POLICY IF EXISTS "uba_write" ON public.user_brand_access;
CREATE POLICY "uba_write" ON public.user_brand_access
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));

-- user_region_access
DROP POLICY IF EXISTS "ura_select" ON public.user_region_access;
CREATE POLICY "ura_select" ON public.user_region_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR public.user_has_brand_access(brand_id)
  );

DROP POLICY IF EXISTS "ura_write" ON public.user_region_access;
CREATE POLICY "ura_write" ON public.user_region_access
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR public.user_has_brand_access(brand_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR public.user_has_brand_access(brand_id)
  );

-- households
DROP POLICY IF EXISTS "households_select" ON public.households;
CREATE POLICY "households_select" ON public.households
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access
      WHERE user_id = auth.uid() AND organization_id = households.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_brand_access
      WHERE user_id = auth.uid() AND organization_id = households.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_region_access
      WHERE user_id = auth.uid() AND organization_id = households.organization_id
    )
  );

DROP POLICY IF EXISTS "households_write" ON public.households;
CREATE POLICY "households_write" ON public.households
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
  );

-- guest_identities
DROP POLICY IF EXISTS "gi_select" ON public.guest_identities;
CREATE POLICY "gi_select" ON public.guest_identities
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access
      WHERE user_id = auth.uid() AND organization_id = guest_identities.organization_id
    )
  );

DROP POLICY IF EXISTS "gi_write" ON public.guest_identities;
CREATE POLICY "gi_write" ON public.guest_identities
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access
      WHERE user_id = auth.uid() AND organization_id = guest_identities.organization_id
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access
      WHERE user_id = auth.uid() AND organization_id = guest_identities.organization_id
    )
  );

-- =========================================================
-- 10. TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS trg_brands_updated_at ON public.brands;
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_regions_updated_at ON public.regions;
CREATE TRIGGER trg_regions_updated_at BEFORE UPDATE ON public.regions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_households_updated_at ON public.households;
CREATE TRIGGER trg_households_updated_at BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
