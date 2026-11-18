
-- Rate templates
CREATE TABLE public.rate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('organization','brand','region')),
  template_code text NOT NULL,
  name text NOT NULL,
  description text,
  deposit_requirement text DEFAULT 'none',
  adjustment_type text,
  adjustment_value numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.rate_templates(organization_id);
CREATE INDEX ON public.rate_templates(brand_id);
CREATE INDEX ON public.rate_templates(region_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_templates TO authenticated;
GRANT ALL ON public.rate_templates TO service_role;
ALTER TABLE public.rate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_templates_select" ON public.rate_templates FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
    OR (region_id IS NOT NULL AND public.user_has_region_access(region_id))
  );
CREATE POLICY "rate_templates_write" ON public.rate_templates FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
  );
CREATE TRIGGER rate_templates_updated_at BEFORE UPDATE ON public.rate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per site-type prices in template (matched by site_type code across properties)
CREATE TABLE public.rate_template_site_type_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.rate_templates(id) ON DELETE CASCADE,
  site_type_code text NOT NULL,
  price numeric(10,2) NOT NULL,
  adjustment_type text,
  adjustment_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, site_type_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_template_site_type_prices TO authenticated;
GRANT ALL ON public.rate_template_site_type_prices TO service_role;
ALTER TABLE public.rate_template_site_type_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rtstp_all" ON public.rate_template_site_type_prices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rate_templates rt WHERE rt.id = template_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(rt.organization_id)
         OR (rt.brand_id IS NOT NULL AND public.user_has_brand_access(rt.brand_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rate_templates rt WHERE rt.id = template_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(rt.organization_id)
         OR (rt.brand_id IS NOT NULL AND public.user_has_brand_access(rt.brand_id)))));

-- Restrictions on template (MinLOS/MaxLOS/CTA/CTD/stop-sell)
CREATE TABLE public.rate_template_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.rate_templates(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  min_los integer,
  max_los integer,
  cta boolean NOT NULL DEFAULT false,
  ctd boolean NOT NULL DEFAULT false,
  stop_sell boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.rate_template_restrictions(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_template_restrictions TO authenticated;
GRANT ALL ON public.rate_template_restrictions TO service_role;
ALTER TABLE public.rate_template_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rtr_all" ON public.rate_template_restrictions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rate_templates rt WHERE rt.id = template_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(rt.organization_id)
         OR (rt.brand_id IS NOT NULL AND public.user_has_brand_access(rt.brand_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rate_templates rt WHERE rt.id = template_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(rt.organization_id)
         OR (rt.brand_id IS NOT NULL AND public.user_has_brand_access(rt.brand_id)))));

-- Push audit log
CREATE TABLE public.rate_template_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.rate_templates(id) ON DELETE CASCADE,
  pushed_by uuid REFERENCES auth.users(id),
  target_property_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  result_summary jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.rate_template_pushes(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_template_pushes TO authenticated;
GRANT ALL ON public.rate_template_pushes TO service_role;
ALTER TABLE public.rate_template_pushes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rtp_all" ON public.rate_template_pushes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rate_templates rt WHERE rt.id = template_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(rt.organization_id)
         OR (rt.brand_id IS NOT NULL AND public.user_has_brand_access(rt.brand_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rate_templates rt WHERE rt.id = template_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(rt.organization_id)
         OR (rt.brand_id IS NOT NULL AND public.user_has_brand_access(rt.brand_id)))));

-- Channel governance
CREATE TABLE public.channel_governance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  allowed_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  parity_enforced boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, brand_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_governance_policies TO authenticated;
GRANT ALL ON public.channel_governance_policies TO service_role;
ALTER TABLE public.channel_governance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cgp_select" ON public.channel_governance_policies FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
  );
CREATE POLICY "cgp_write" ON public.channel_governance_policies FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
  );
CREATE TRIGGER cgp_updated_at BEFORE UPDATE ON public.channel_governance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Portfolio metrics rollup
CREATE TABLE public.portfolio_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stay_date date NOT NULL,
  sites_available integer NOT NULL DEFAULT 0,
  sites_sold integer NOT NULL DEFAULT 0,
  occupancy_pct numeric(5,2) NOT NULL DEFAULT 0,
  adr numeric(10,2) NOT NULL DEFAULT 0,
  revpar numeric(10,2) NOT NULL DEFAULT 0,
  room_revenue numeric(12,2) NOT NULL DEFAULT 0,
  ancillary_revenue numeric(12,2) NOT NULL DEFAULT 0,
  total_revenue numeric(12,2) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, stay_date)
);
CREATE INDEX ON public.portfolio_metrics_daily(property_id, stay_date);
CREATE INDEX ON public.portfolio_metrics_daily(stay_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_metrics_daily TO authenticated;
GRANT ALL ON public.portfolio_metrics_daily TO service_role;
ALTER TABLE public.portfolio_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmd_select" ON public.portfolio_metrics_daily FOR SELECT TO authenticated
  USING (public.user_can_access_property(property_id));
CREATE POLICY "pmd_service_write" ON public.portfolio_metrics_daily FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_portfolio_metrics(_property_id uuid, _from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  total_sites integer;
  sold integer;
  rev numeric;
  anc numeric;
  rows_written integer := 0;
BEGIN
  SELECT COUNT(*) INTO total_sites FROM public.sites WHERE property_id = _property_id;
  d := _from;
  WHILE d <= _to LOOP
    SELECT COUNT(*)::int,
           COALESCE(SUM(r.total_amount / GREATEST((r.check_out_date - r.check_in_date),1)),0)
      INTO sold, rev
      FROM public.reservations r
     WHERE r.property_id = _property_id
       AND r.status NOT IN ('CANCELLED','NO_SHOW')
       AND d >= r.check_in_date AND d < r.check_out_date;

    SELECT COALESCE(SUM(ra.total_price),0) INTO anc
      FROM public.reservation_add_ons ra
      JOIN public.reservations r ON r.id = ra.reservation_id
     WHERE r.property_id = _property_id
       AND r.status NOT IN ('CANCELLED','NO_SHOW')
       AND d >= r.check_in_date AND d < r.check_out_date;

    INSERT INTO public.portfolio_metrics_daily
      (property_id, stay_date, sites_available, sites_sold, occupancy_pct, adr, revpar, room_revenue, ancillary_revenue, total_revenue, computed_at)
    VALUES (_property_id, d, COALESCE(total_sites,0), COALESCE(sold,0),
      CASE WHEN COALESCE(total_sites,0) > 0 THEN ROUND(sold::numeric * 100 / total_sites, 2) ELSE 0 END,
      CASE WHEN sold > 0 THEN ROUND(rev / sold, 2) ELSE 0 END,
      CASE WHEN COALESCE(total_sites,0) > 0 THEN ROUND(rev / total_sites, 2) ELSE 0 END,
      COALESCE(rev,0), COALESCE(anc,0), COALESCE(rev,0) + COALESCE(anc,0), now())
    ON CONFLICT (property_id, stay_date) DO UPDATE
      SET sites_available = EXCLUDED.sites_available,
          sites_sold = EXCLUDED.sites_sold,
          occupancy_pct = EXCLUDED.occupancy_pct,
          adr = EXCLUDED.adr,
          revpar = EXCLUDED.revpar,
          room_revenue = EXCLUDED.room_revenue,
          ancillary_revenue = EXCLUDED.ancillary_revenue,
          total_revenue = EXCLUDED.total_revenue,
          computed_at = now();
    rows_written := rows_written + 1;
    d := d + 1;
  END LOOP;
  RETURN rows_written;
END;
$$;
