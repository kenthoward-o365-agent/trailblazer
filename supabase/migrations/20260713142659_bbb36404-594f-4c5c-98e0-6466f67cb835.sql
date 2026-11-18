
-- =========================================
-- Phase 2: Membership & Loyalty Engine
-- =========================================

-- Enum: billing period
DO $$ BEGIN
  CREATE TYPE public.membership_billing_period AS ENUM ('monthly','quarterly','annual','lifetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_account_status AS ENUM ('active','pending','suspended','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_dues_status AS ENUM ('pending','paid','failed','refunded','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Programs
CREATE TABLE public.membership_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_period public.membership_billing_period NOT NULL DEFAULT 'annual',
  dues_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  auto_renew_default BOOLEAN NOT NULL DEFAULT true,
  points_per_currency_unit NUMERIC(12,4) NOT NULL DEFAULT 0,
  point_redemption_value NUMERIC(12,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_programs TO authenticated;
GRANT SELECT ON public.membership_programs TO anon;
GRANT ALL ON public.membership_programs TO service_role;
ALTER TABLE public.membership_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage programs" ON public.membership_programs
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));

CREATE POLICY "Staff view programs in their org" ON public.membership_programs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = membership_programs.organization_id
    )
  );

CREATE POLICY "Public read active programs" ON public.membership_programs
  FOR SELECT TO anon
  USING (is_active = true);

CREATE TRIGGER trg_membership_programs_updated
  BEFORE UPDATE ON public.membership_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tiers
CREATE TABLE public.membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.membership_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  dues_amount_override NUMERIC(12,2),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  free_nights_per_year INT NOT NULL DEFAULT 0,
  max_consecutive_nights INT,
  cooldown_days INT NOT NULL DEFAULT 0,
  parks_per_year_cap INT,
  priority_booking_window_days INT NOT NULL DEFAULT 0,
  points_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1,
  blackout_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_tiers TO authenticated;
GRANT SELECT ON public.membership_tiers TO anon;
GRANT ALL ON public.membership_tiers TO service_role;
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage tiers" ON public.membership_tiers
  FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.membership_programs p
      WHERE p.id = membership_tiers.program_id AND public.user_has_org_admin_access(p.organization_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.membership_programs p
      WHERE p.id = membership_tiers.program_id AND public.user_has_org_admin_access(p.organization_id)
    )
  );

CREATE POLICY "Staff view tiers" ON public.membership_tiers
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.membership_programs p
      JOIN public.user_property_access upa ON upa.organization_id = p.organization_id
      WHERE p.id = membership_tiers.program_id AND upa.user_id = auth.uid()
    )
  );

CREATE POLICY "Public read tiers" ON public.membership_tiers
  FOR SELECT TO anon
  USING (is_active = true);

CREATE TRIGGER trg_membership_tiers_updated
  BEFORE UPDATE ON public.membership_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_membership_tiers_program ON public.membership_tiers(program_id);

-- 3. Park eligibility
CREATE TABLE public.membership_program_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.membership_programs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, property_id, tier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_program_properties TO authenticated;
GRANT SELECT ON public.membership_program_properties TO anon;
GRANT ALL ON public.membership_program_properties TO service_role;
ALTER TABLE public.membership_program_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage program parks" ON public.membership_program_properties
  FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.membership_programs p
      WHERE p.id = membership_program_properties.program_id
        AND public.user_has_org_admin_access(p.organization_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.membership_programs p
      WHERE p.id = membership_program_properties.program_id
        AND public.user_has_org_admin_access(p.organization_id)
    )
  );

CREATE POLICY "Property staff view eligibility" ON public.membership_program_properties
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR public.user_can_access_property(property_id)
  );

CREATE POLICY "Public read eligibility" ON public.membership_program_properties
  FOR SELECT TO anon USING (true);

-- 4. Member accounts
CREATE TABLE public.member_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.membership_programs(id) ON DELETE RESTRICT,
  tier_id UUID REFERENCES public.membership_tiers(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  member_number TEXT NOT NULL,
  status public.membership_account_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  points_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  adyen_shopper_reference TEXT,
  adyen_recurring_detail_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, member_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_accounts TO authenticated;
GRANT ALL ON public.member_accounts TO service_role;
ALTER TABLE public.member_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage members" ON public.member_accounts
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));

CREATE POLICY "Staff view org members" ON public.member_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_accounts.organization_id
    )
  );

CREATE POLICY "Staff post updates on members in their org" ON public.member_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_accounts.organization_id
    )
  );

CREATE INDEX idx_member_accounts_guest ON public.member_accounts(guest_id);
CREATE INDEX idx_member_accounts_program ON public.member_accounts(program_id);
CREATE INDEX idx_member_accounts_number ON public.member_accounts(member_number);

CREATE TRIGGER trg_member_accounts_updated
  BEFORE UPDATE ON public.member_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Dues invoices
CREATE TABLE public.member_dues_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_account_id UUID NOT NULL REFERENCES public.member_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status public.membership_dues_status NOT NULL DEFAULT 'pending',
  attempted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  adyen_psp_reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_dues_invoices TO authenticated;
GRANT ALL ON public.member_dues_invoices TO service_role;
ALTER TABLE public.member_dues_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage dues" ON public.member_dues_invoices
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));

CREATE POLICY "Staff view org dues" ON public.member_dues_invoices
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_dues_invoices.organization_id
    )
  );

CREATE INDEX idx_dues_member ON public.member_dues_invoices(member_account_id);
CREATE INDEX idx_dues_status ON public.member_dues_invoices(status);

CREATE TRIGGER trg_dues_updated
  BEFORE UPDATE ON public.member_dues_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Points ledger
CREATE TABLE public.member_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_account_id UUID NOT NULL REFERENCES public.member_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delta NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.member_points_ledger TO authenticated;
GRANT ALL ON public.member_points_ledger TO service_role;
ALTER TABLE public.member_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view org points" ON public.member_points_ledger
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_points_ledger.organization_id
    )
  );

CREATE POLICY "Staff post points at their properties" ON public.member_points_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (property_id IS NOT NULL AND public.user_can_access_property(property_id))
  );

CREATE INDEX idx_points_member ON public.member_points_ledger(member_account_id);

-- 7. Entitlement usage
CREATE TABLE public.member_entitlement_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_account_id UUID NOT NULL REFERENCES public.member_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year INT NOT NULL,
  free_nights_used INT NOT NULL DEFAULT 0,
  total_nights_used INT NOT NULL DEFAULT 0,
  stays_count INT NOT NULL DEFAULT 0,
  parks_visited JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_stay_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_account_id, year)
);
GRANT SELECT, INSERT, UPDATE ON public.member_entitlement_usage TO authenticated;
GRANT ALL ON public.member_entitlement_usage TO service_role;
ALTER TABLE public.member_entitlement_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view entitlement" ON public.member_entitlement_usage
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_entitlement_usage.organization_id
    )
  );

CREATE POLICY "Staff post entitlement" ON public.member_entitlement_usage
  FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR public.user_has_org_admin_access(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_entitlement_usage.organization_id
    )
  )
  WITH CHECK (
    public.is_super_admin() OR public.user_has_org_admin_access(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.user_property_access upa
      WHERE upa.user_id = auth.uid() AND upa.organization_id = member_entitlement_usage.organization_id
    )
  );

CREATE TRIGGER trg_entitlement_updated
  BEFORE UPDATE ON public.member_entitlement_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Rate eligibility (gate rate plans by program/tier)
CREATE TABLE public.rate_membership_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id UUID NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.membership_programs(id) ON DELETE CASCADE,
  min_tier_priority INT NOT NULL DEFAULT 0,
  member_only BOOLEAN NOT NULL DEFAULT true,
  discount_percent_override NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rate_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_membership_eligibility TO authenticated;
GRANT SELECT ON public.rate_membership_eligibility TO anon;
GRANT ALL ON public.rate_membership_eligibility TO service_role;
ALTER TABLE public.rate_membership_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage rate eligibility" ON public.rate_membership_eligibility
  FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.rates r
      WHERE r.id = rate_membership_eligibility.rate_id
        AND public.user_can_access_property(r.property_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.rates r
      WHERE r.id = rate_membership_eligibility.rate_id
        AND public.user_can_access_property(r.property_id)
    )
  );

CREATE POLICY "Public read rate eligibility" ON public.rate_membership_eligibility
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_rate_elig_rate ON public.rate_membership_eligibility(rate_id);
CREATE INDEX idx_rate_elig_program ON public.rate_membership_eligibility(program_id);

-- 9. Member number generator
CREATE OR REPLACE FUNCTION public.generate_member_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_num TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.member_number IS NOT NULL AND length(NEW.member_number) > 0 THEN
    RETURN NEW;
  END IF;
  LOOP
    new_num := 'M' || LPAD(FLOOR(random()*1000000000)::TEXT, 9, '0');
    IF NOT EXISTS (SELECT 1 FROM public.member_accounts WHERE organization_id = NEW.organization_id AND member_number = new_num) THEN
      NEW.member_number := new_num;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique member number';
    END IF;
  END LOOP;
END;
$$;

CREATE TRIGGER trg_gen_member_number
  BEFORE INSERT ON public.member_accounts
  FOR EACH ROW EXECUTE FUNCTION public.generate_member_number();

-- 10. Points balance sync trigger
CREATE OR REPLACE FUNCTION public.sync_member_points_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.member_accounts
    SET points_balance = NEW.balance_after,
        updated_at = now()
    WHERE id = NEW.member_account_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_points_balance
  AFTER INSERT ON public.member_points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_points_balance();

-- 11. Helper: lookup active membership for a guest at a property
CREATE OR REPLACE FUNCTION public.get_active_memberships_for_property(_guest_id UUID, _property_id UUID)
RETURNS TABLE(
  member_account_id UUID,
  program_id UUID,
  tier_id UUID,
  tier_priority INT,
  discount_percent NUMERIC,
  member_number TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ma.id, ma.program_id, ma.tier_id, COALESCE(mt.priority, 0), COALESCE(mt.discount_percent, 0), ma.member_number
  FROM public.member_accounts ma
  LEFT JOIN public.membership_tiers mt ON mt.id = ma.tier_id
  WHERE ma.guest_id = _guest_id
    AND ma.status = 'active'
    AND (ma.expires_at IS NULL OR ma.expires_at > now())
    AND EXISTS (
      SELECT 1 FROM public.membership_program_properties mpp
      WHERE mpp.program_id = ma.program_id
        AND mpp.property_id = _property_id
        AND (mpp.tier_id IS NULL OR mpp.tier_id = ma.tier_id)
    );
$$;
