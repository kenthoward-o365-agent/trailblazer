
-- Intercompany transfers
CREATE TABLE public.intercompany_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_property_id uuid NOT NULL REFERENCES public.properties(id),
  to_property_id uuid NOT NULL REFERENCES public.properties(id),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  memo text,
  reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed')),
  posted_at timestamptz,
  posted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_property_id <> to_property_id)
);
CREATE INDEX ON public.intercompany_transfers(organization_id);
CREATE INDEX ON public.intercompany_transfers(from_property_id);
CREATE INDEX ON public.intercompany_transfers(to_property_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intercompany_transfers TO authenticated;
GRANT ALL ON public.intercompany_transfers TO service_role;
ALTER TABLE public.intercompany_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ict_select" ON public.intercompany_transfers FOR SELECT TO authenticated
  USING (public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR public.user_can_access_property(from_property_id)
    OR public.user_can_access_property(to_property_id));
CREATE POLICY "ict_write" ON public.intercompany_transfers FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));
CREATE TRIGGER ict_updated_at BEFORE UPDATE ON public.intercompany_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Consolidated AR customers
CREATE TABLE public.consolidated_ar_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  billing_email text,
  billing_address jsonb,
  credit_limit numeric(12,2),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidated_ar_customers TO authenticated;
GRANT ALL ON public.consolidated_ar_customers TO service_role;
ALTER TABLE public.consolidated_ar_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "car_select" ON public.consolidated_ar_customers FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));
CREATE POLICY "car_write" ON public.consolidated_ar_customers FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_org_admin_access(organization_id));
CREATE TRIGGER car_updated_at BEFORE UPDATE ON public.consolidated_ar_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.consolidated_ar_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.consolidated_ar_customers(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidated_ar_links TO authenticated;
GRANT ALL ON public.consolidated_ar_links TO service_role;
ALTER TABLE public.consolidated_ar_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carl_all" ON public.consolidated_ar_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consolidated_ar_customers c WHERE c.id = customer_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(c.organization_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consolidated_ar_customers c WHERE c.id = customer_id
    AND (public.is_super_admin() OR public.user_has_org_admin_access(c.organization_id))));

-- GL export schedules
CREATE TABLE public.gl_export_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  target text NOT NULL CHECK (target IN ('quickbooks','netsuite','sage','dynamics','csv')),
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily','weekly','monthly')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, target)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_export_schedules TO authenticated;
GRANT ALL ON public.gl_export_schedules TO service_role;
ALTER TABLE public.gl_export_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gls_select" ON public.gl_export_schedules FOR SELECT TO authenticated
  USING (public.user_can_access_property(property_id));
CREATE POLICY "gls_write" ON public.gl_export_schedules FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_can_access_property(property_id))
  WITH CHECK (public.is_super_admin() OR public.user_can_access_property(property_id));
CREATE TRIGGER gls_updated_at BEFORE UPDATE ON public.gl_export_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Regional work order pool
CREATE TABLE public.regional_work_order_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  dispatched_to_user_id uuid REFERENCES auth.users(id),
  sla_hours integer,
  travel_minutes integer,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','dispatched','in_progress','completed','cancelled')),
  dispatched_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id)
);
CREATE INDEX ON public.regional_work_order_pool(region_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_work_order_pool TO authenticated;
GRANT ALL ON public.regional_work_order_pool TO service_role;
ALTER TABLE public.regional_work_order_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwop_select" ON public.regional_work_order_pool FOR SELECT TO authenticated
  USING (public.user_has_region_access(region_id) OR public.user_can_access_property(property_id));
CREATE POLICY "rwop_write" ON public.regional_work_order_pool FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.user_has_region_access(region_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_region_access(region_id));
CREATE TRIGGER rwop_updated_at BEFORE UPDATE ON public.regional_work_order_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Executive report snapshots
CREATE TABLE public.executive_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('organization','brand','region','property')),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, brand_id, region_id, property_id, period_start, period_end, scope)
);
CREATE INDEX ON public.executive_report_snapshots(organization_id, period_end DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_report_snapshots TO authenticated;
GRANT ALL ON public.executive_report_snapshots TO service_role;
ALTER TABLE public.executive_report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ers_select" ON public.executive_report_snapshots FOR SELECT TO authenticated
  USING (public.is_super_admin()
    OR public.user_has_org_admin_access(organization_id)
    OR (brand_id IS NOT NULL AND public.user_has_brand_access(brand_id))
    OR (region_id IS NOT NULL AND public.user_has_region_access(region_id))
    OR (property_id IS NOT NULL AND public.user_can_access_property(property_id)));
CREATE POLICY "ers_write" ON public.executive_report_snapshots FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Compute executive snapshot from portfolio metrics + memberships
CREATE OR REPLACE FUNCTION public.compute_executive_snapshot(
  _organization_id uuid,
  _brand_id uuid,
  _region_id uuid,
  _period_start date,
  _period_end date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap_id uuid;
  k jsonb;
  scope_val text;
BEGIN
  scope_val := CASE
    WHEN _region_id IS NOT NULL THEN 'region'
    WHEN _brand_id IS NOT NULL THEN 'brand'
    ELSE 'organization'
  END;

  WITH props AS (
    SELECT p.id FROM public.properties p
    WHERE p.organization_id = _organization_id
      AND (_brand_id IS NULL OR p.brand_id = _brand_id)
      AND (_region_id IS NULL OR p.region_id = _region_id)
  ),
  agg AS (
    SELECT
      COALESCE(SUM(m.room_revenue),0) AS room_revenue,
      COALESCE(SUM(m.ancillary_revenue),0) AS ancillary_revenue,
      COALESCE(SUM(m.total_revenue),0) AS total_revenue,
      COALESCE(SUM(m.sites_sold),0) AS sites_sold,
      COALESCE(SUM(m.sites_available),0) AS sites_available,
      CASE WHEN SUM(m.sites_available) > 0
        THEN ROUND(SUM(m.sites_sold)::numeric * 100 / SUM(m.sites_available), 2)
        ELSE 0 END AS occupancy_pct,
      CASE WHEN SUM(m.sites_sold) > 0
        THEN ROUND(SUM(m.room_revenue) / SUM(m.sites_sold), 2)
        ELSE 0 END AS adr,
      CASE WHEN SUM(m.sites_available) > 0
        THEN ROUND(SUM(m.room_revenue) / SUM(m.sites_available), 2)
        ELSE 0 END AS revpar
    FROM public.portfolio_metrics_daily m
    JOIN props ON props.id = m.property_id
    WHERE m.stay_date BETWEEN _period_start AND _period_end
  ),
  members AS (
    SELECT COUNT(*) AS active_members
    FROM public.member_accounts ma
    JOIN public.membership_programs mp ON mp.id = ma.program_id
    WHERE mp.organization_id = _organization_id
      AND ma.status = 'active'
  )
  SELECT jsonb_build_object(
    'total_revenue', agg.total_revenue,
    'room_revenue', agg.room_revenue,
    'ancillary_revenue', agg.ancillary_revenue,
    'occupancy_pct', agg.occupancy_pct,
    'adr', agg.adr,
    'revpar', agg.revpar,
    'sites_sold', agg.sites_sold,
    'sites_available', agg.sites_available,
    'active_members', members.active_members
  ) INTO k FROM agg, members;

  INSERT INTO public.executive_report_snapshots
    (organization_id, brand_id, region_id, scope, period_start, period_end, kpis)
  VALUES (_organization_id, _brand_id, _region_id, scope_val, _period_start, _period_end, COALESCE(k, '{}'::jsonb))
  ON CONFLICT (organization_id, brand_id, region_id, property_id, period_start, period_end, scope)
  DO UPDATE SET kpis = EXCLUDED.kpis, computed_at = now()
  RETURNING id INTO snap_id;

  RETURN snap_id;
END;
$$;
