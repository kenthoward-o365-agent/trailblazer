
-- Organization compliance & trust settings
CREATE TABLE public.org_compliance_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_residency text NOT NULL DEFAULT 'US' CHECK (data_residency IN ('US','CA','EU')),
  byok_enabled boolean NOT NULL DEFAULT false,
  byok_key_reference text,
  dpa_url text,
  subprocessors_url text,
  soc2_readiness_state text NOT NULL DEFAULT 'in_progress' CHECK (soc2_readiness_state IN ('not_started','in_progress','ready','certified')),
  soc2_last_review_at timestamptz,
  security_contact_email text,
  incident_response_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_compliance_settings TO authenticated;
GRANT ALL ON public.org_compliance_settings TO service_role;
ALTER TABLE public.org_compliance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org admins manage compliance" ON public.org_compliance_settings
  FOR ALL TO authenticated
  USING (public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.user_has_org_admin_access(organization_id));
CREATE TRIGGER trg_org_compliance_updated BEFORE UPDATE ON public.org_compliance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-org API quotas
CREATE TABLE public.org_api_quotas (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  daily_request_limit integer NOT NULL DEFAULT 100000,
  burst_per_minute integer NOT NULL DEFAULT 600,
  booking_engine_daily_limit integer NOT NULL DEFAULT 50000,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_api_quotas TO authenticated;
GRANT ALL ON public.org_api_quotas TO service_role;
ALTER TABLE public.org_api_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org admins manage quotas" ON public.org_api_quotas
  FOR ALL TO authenticated
  USING (public.user_has_org_admin_access(organization_id))
  WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_org_api_quotas_updated BEFORE UPDATE ON public.org_api_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily API usage rollup
CREATE TABLE public.api_quota_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  booking_engine_count integer NOT NULL DEFAULT 0,
  throttled_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, usage_date)
);
GRANT SELECT ON public.api_quota_usage TO authenticated;
GRANT ALL ON public.api_quota_usage TO service_role;
ALTER TABLE public.api_quota_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org admins view usage" ON public.api_quota_usage
  FOR SELECT TO authenticated
  USING (public.user_has_org_admin_access(organization_id));

-- Brand white-label
CREATE TABLE public.brand_white_label (
  brand_id uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  custom_domain text,
  sender_email text,
  sender_name text,
  theme_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_url text,
  favicon_url text,
  primary_color text,
  accent_color text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_white_label TO authenticated;
GRANT ALL ON public.brand_white_label TO service_role;
ALTER TABLE public.brand_white_label ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand admins manage white label" ON public.brand_white_label
  FOR ALL TO authenticated
  USING (public.user_has_brand_access(brand_id))
  WITH CHECK (public.user_has_brand_access(brand_id));
CREATE TRIGGER trg_brand_wl_updated BEFORE UPDATE ON public.brand_white_label
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service status incidents (public status page)
CREATE TABLE public.service_status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical','maintenance')),
  affected_components text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_status_incidents TO anon, authenticated;
GRANT ALL ON public.service_status_incidents TO service_role;
ALTER TABLE public.service_status_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents public read" ON public.service_status_incidents
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "super admin write incidents" ON public.service_status_incidents
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_status_incidents_updated BEFORE UPDATE ON public.service_status_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_status_incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.service_status_incidents(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_status_incident_updates TO anon, authenticated;
GRANT ALL ON public.service_status_incident_updates TO service_role;
ALTER TABLE public.service_status_incident_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incident updates public read" ON public.service_status_incident_updates
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "super admin write incident updates" ON public.service_status_incident_updates
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Webhook catalog
CREATE TABLE public.webhook_catalog_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  payload_example jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_catalog_endpoints TO anon, authenticated;
GRANT ALL ON public.webhook_catalog_endpoints TO service_role;
ALTER TABLE public.webhook_catalog_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog public read" ON public.webhook_catalog_endpoints
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "super admin write catalog" ON public.webhook_catalog_endpoints
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER trg_webhook_catalog_updated BEFORE UPDATE ON public.webhook_catalog_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Org sandbox environments
CREATE TABLE public.org_sandbox_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sandbox_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Sandbox',
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  provisioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (parent_organization_id, sandbox_organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_sandbox_environments TO authenticated;
GRANT ALL ON public.org_sandbox_environments TO service_role;
ALTER TABLE public.org_sandbox_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org admins view sandboxes" ON public.org_sandbox_environments
  FOR SELECT TO authenticated
  USING (public.user_has_org_admin_access(parent_organization_id));
CREATE POLICY "super admin manage sandboxes" ON public.org_sandbox_environments
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Seed webhook catalog with common events
INSERT INTO public.webhook_catalog_endpoints (event_key, display_name, description, category) VALUES
  ('reservation.created','Reservation Created','Fired when a new reservation is created via any channel.','reservations'),
  ('reservation.updated','Reservation Updated','Fired when a reservation''s dates, status, or totals change.','reservations'),
  ('reservation.cancelled','Reservation Cancelled','Fired when a reservation is cancelled.','reservations'),
  ('folio.posted','Folio Posting','Fired when a charge or payment is posted to a folio.','accounting'),
  ('payment.captured','Payment Captured','Fired when a payment authorization is captured.','payments'),
  ('membership.created','Membership Created','Fired when a member enrolls or upgrades.','memberships'),
  ('membership.dues_charged','Membership Dues Charged','Fired after a successful dues billing run.','memberships'),
  ('night_audit.completed','Night Audit Completed','Fired after a property''s night audit succeeds.','operations'),
  ('workorder.status_changed','Work Order Status Changed','Fired when a work order changes status.','operations');
