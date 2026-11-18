
-- =========================================================
-- CHANNEL MANAGER: ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.channel_code AS ENUM ('expedia', 'bookingcom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.channel_status AS ENUM ('disconnected', 'connected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.channel_holdback_type AS ENUM ('fixed', 'percent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.channel_queue_status AS ENUM ('pending', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.channel_sync_direction AS ENUM ('outbound', 'inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1. channels
-- =========================================================
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel_code public.channel_code NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  hotel_id text,
  currency text NOT NULL DEFAULT 'USD',
  credentials_ref text,
  mock_mode boolean NOT NULL DEFAULT true,
  status public.channel_status NOT NULL DEFAULT 'disconnected',
  last_ari_sync_at timestamptz,
  last_res_pull_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, channel_code)
);
CREATE INDEX idx_channels_property ON public.channels(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_property_access" ON public.channels
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. channel_site_type_mappings
-- =========================================================
CREATE TABLE public.channel_site_type_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site_type_id uuid NOT NULL REFERENCES public.site_types(id) ON DELETE CASCADE,
  external_room_type_code text NOT NULL,
  external_room_type_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, site_type_id)
);
CREATE INDEX idx_cstm_property ON public.channel_site_type_mappings(property_id);
CREATE INDEX idx_cstm_channel ON public.channel_site_type_mappings(channel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_site_type_mappings TO authenticated;
GRANT ALL ON public.channel_site_type_mappings TO service_role;
ALTER TABLE public.channel_site_type_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cstm_property_access" ON public.channel_site_type_mappings
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_cstm_updated_at
  BEFORE UPDATE ON public.channel_site_type_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3. channel_rate_mappings
-- =========================================================
CREATE TABLE public.channel_rate_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rate_id uuid NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  external_rate_plan_code text NOT NULL,
  external_rate_plan_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, rate_id)
);
CREATE INDEX idx_crm_property ON public.channel_rate_mappings(property_id);
CREATE INDEX idx_crm_channel ON public.channel_rate_mappings(channel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_rate_mappings TO authenticated;
GRANT ALL ON public.channel_rate_mappings TO service_role;
ALTER TABLE public.channel_rate_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_property_access" ON public.channel_rate_mappings
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_crm_updated_at
  BEFORE UPDATE ON public.channel_rate_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. channel_holdback_rules
-- =========================================================
CREATE TABLE public.channel_holdback_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  site_type_id uuid REFERENCES public.site_types(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  hold_type public.channel_holdback_type NOT NULL,
  hold_value integer NOT NULL CHECK (hold_value >= 0),
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chr_property ON public.channel_holdback_rules(property_id);
CREATE INDEX idx_chr_channel ON public.channel_holdback_rules(channel_id);
CREATE INDEX idx_chr_site_type ON public.channel_holdback_rules(site_type_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_holdback_rules TO authenticated;
GRANT ALL ON public.channel_holdback_rules TO service_role;
ALTER TABLE public.channel_holdback_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chr_property_access" ON public.channel_holdback_rules
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_chr_updated_at
  BEFORE UPDATE ON public.channel_holdback_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5. channel_content
-- =========================================================
CREATE TABLE public.channel_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site_type_id uuid NOT NULL REFERENCES public.site_types(id) ON DELETE CASCADE,
  display_name text,
  short_description text,
  long_description text,
  max_occupancy integer,
  amenities jsonb NOT NULL DEFAULT '{}'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  gallery_asset_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  last_pushed_at timestamptz,
  push_status text NOT NULL DEFAULT 'draft',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, site_type_id)
);
CREATE INDEX idx_cc_property ON public.channel_content(property_id);
CREATE INDEX idx_cc_channel ON public.channel_content(channel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_content TO authenticated;
GRANT ALL ON public.channel_content TO service_role;
ALTER TABLE public.channel_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_property_access" ON public.channel_content
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_cc_updated_at
  BEFORE UPDATE ON public.channel_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. channel_ari_queue
-- =========================================================
CREATE TABLE public.channel_ari_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site_type_id uuid NOT NULL REFERENCES public.site_types(id) ON DELETE CASCADE,
  stay_date date NOT NULL,
  available_count integer NOT NULL DEFAULT 0,
  rate_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  status public.channel_queue_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_caq_pending ON public.channel_ari_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_caq_property ON public.channel_ari_queue(property_id);
CREATE INDEX idx_caq_lookup ON public.channel_ari_queue(channel_id, site_type_id, stay_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_ari_queue TO authenticated;
GRANT ALL ON public.channel_ari_queue TO service_role;
ALTER TABLE public.channel_ari_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caq_property_access" ON public.channel_ari_queue
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_caq_updated_at
  BEFORE UPDATE ON public.channel_ari_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 7. channel_reservations_inbox
-- =========================================================
CREATE TABLE public.channel_reservations_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  external_reservation_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_reservation_id)
);
CREATE INDEX idx_cri_property ON public.channel_reservations_inbox(property_id);
CREATE INDEX idx_cri_status ON public.channel_reservations_inbox(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_reservations_inbox TO authenticated;
GRANT ALL ON public.channel_reservations_inbox TO service_role;
ALTER TABLE public.channel_reservations_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cri_property_access" ON public.channel_reservations_inbox
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TRIGGER update_cri_updated_at
  BEFORE UPDATE ON public.channel_reservations_inbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 8. channel_sync_log
-- =========================================================
CREATE TABLE public.channel_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  direction public.channel_sync_direction NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  http_status integer,
  duration_ms integer,
  items_count integer,
  request_summary jsonb,
  response_summary jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_csl_property ON public.channel_sync_log(property_id, created_at DESC);
CREATE INDEX idx_csl_channel ON public.channel_sync_log(channel_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_sync_log TO authenticated;
GRANT ALL ON public.channel_sync_log TO service_role;
ALTER TABLE public.channel_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csl_property_access" ON public.channel_sync_log
  FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

-- =========================================================
-- 9. Trigger: enqueue ARI updates when reservations change
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_channel_ari_on_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch RECORD;
  d date;
  start_d date;
  end_d date;
  st_id uuid;
BEGIN
  st_id := COALESCE(NEW.site_type_id, OLD.site_type_id);
  start_d := COALESCE(NEW.check_in_date, OLD.check_in_date);
  end_d   := COALESCE(NEW.check_out_date, OLD.check_out_date);

  IF st_id IS NULL OR start_d IS NULL OR end_d IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  FOR ch IN
    SELECT c.id AS channel_id, c.property_id
    FROM public.channels c
    JOIN public.channel_site_type_mappings m
      ON m.channel_id = c.id AND m.site_type_id = st_id AND m.is_active = true
    WHERE c.property_id = COALESCE(NEW.property_id, OLD.property_id)
      AND c.is_enabled = true
  LOOP
    d := start_d;
    WHILE d < end_d LOOP
      INSERT INTO public.channel_ari_queue
        (channel_id, property_id, site_type_id, stay_date, status)
      VALUES (ch.channel_id, ch.property_id, st_id, d, 'pending')
      ON CONFLICT DO NOTHING;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER reservations_enqueue_channel_ari
  AFTER INSERT OR UPDATE OF status, check_in_date, check_out_date, site_type_id
  OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_channel_ari_on_reservation();
