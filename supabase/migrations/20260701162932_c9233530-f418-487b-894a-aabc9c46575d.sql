
-- 1. Properties: booking engine fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS booking_engine_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS booking_custom_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS booking_custom_domain TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_properties_booking_public_slug ON public.properties(booking_public_slug) WHERE booking_public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_booking_custom_slug ON public.properties(booking_custom_slug) WHERE booking_custom_slug IS NOT NULL;

-- 2. booking_engine_settings
CREATE TABLE IF NOT EXISTS public.booking_engine_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  tagline TEXT,
  about_markdown TEXT,
  hero_image_path TEXT,
  logo_image_path TEXT,
  primary_color TEXT DEFAULT '#0f766e',
  contact_email TEXT,
  contact_phone TEXT,
  social_facebook TEXT,
  social_instagram TEXT,
  social_website TEXT,
  min_advance_days INTEGER NOT NULL DEFAULT 0,
  max_advance_days INTEGER NOT NULL DEFAULT 365,
  min_nights INTEGER NOT NULL DEFAULT 1,
  max_nights INTEGER NOT NULL DEFAULT 30,
  same_day_cutoff_time TIME DEFAULT '16:00',
  terms_and_conditions TEXT,
  cancellation_summary TEXT,
  allow_search_engine_indexing BOOLEAN NOT NULL DEFAULT false,
  confirmation_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_engine_settings TO authenticated;
GRANT ALL ON public.booking_engine_settings TO service_role;
ALTER TABLE public.booking_engine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own property booking settings"
  ON public.booking_engine_settings FOR SELECT TO authenticated
  USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage own property booking settings"
  ON public.booking_engine_settings FOR ALL TO authenticated
  USING (user_can_access_property(property_id))
  WITH CHECK (user_can_access_property(property_id));

CREATE TRIGGER trg_booking_engine_settings_updated
  BEFORE UPDATE ON public.booking_engine_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. deposit_policies
CREATE TABLE IF NOT EXISTS public.deposit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  deposit_type TEXT NOT NULL DEFAULT 'percent', -- percent | fixed | first_night | none
  deposit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_due TEXT NOT NULL DEFAULT 'at_booking', -- at_booking | days_before
  deposit_due_days INTEGER,
  payment_mode TEXT NOT NULL DEFAULT 'deposit', -- deposit | full | guarantee
  cancellation_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  no_show_charge_type TEXT NOT NULL DEFAULT 'percent', -- percent | fixed | full_stay | none
  no_show_charge_value NUMERIC(10,2) NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_policies TO authenticated;
GRANT ALL ON public.deposit_policies TO service_role;
ALTER TABLE public.deposit_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view deposit policies" ON public.deposit_policies FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage deposit policies" ON public.deposit_policies FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_deposit_policies_updated BEFORE UPDATE ON public.deposit_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. site_type_booking_config
CREATE TABLE IF NOT EXISTS public.site_type_booking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site_type_id UUID NOT NULL UNIQUE REFERENCES public.site_types(id) ON DELETE CASCADE,
  is_bookable_online BOOLEAN NOT NULL DEFAULT true,
  public_description TEXT,
  allow_specific_site_pick BOOLEAN NOT NULL DEFAULT true,
  min_nights INTEGER,
  max_nights INTEGER,
  max_rig_length INTEGER,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_type_booking_config TO authenticated;
GRANT ALL ON public.site_type_booking_config TO service_role;
ALTER TABLE public.site_type_booking_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view site type booking config" ON public.site_type_booking_config FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage site type booking config" ON public.site_type_booking_config FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_site_type_bcfg_updated BEFORE UPDATE ON public.site_type_booking_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. site_booking_config
CREATE TABLE IF NOT EXISTS public.site_booking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site_id UUID NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  is_bookable_online BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_rig_length INTEGER,
  public_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_booking_config TO authenticated;
GRANT ALL ON public.site_booking_config TO service_role;
ALTER TABLE public.site_booking_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view site booking config" ON public.site_booking_config FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage site booking config" ON public.site_booking_config FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_site_bcfg_updated BEFORE UPDATE ON public.site_booking_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. rate_booking_config
CREATE TABLE IF NOT EXISTS public.rate_booking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rate_id UUID NOT NULL UNIQUE REFERENCES public.rates(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  public_name TEXT,
  public_description TEXT,
  deposit_policy_id UUID REFERENCES public.deposit_policies(id) ON DELETE SET NULL,
  payment_mode_override TEXT, -- deposit | full | guarantee | NULL(use policy)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_booking_config TO authenticated;
GRANT ALL ON public.rate_booking_config TO service_role;
ALTER TABLE public.rate_booking_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view rate booking config" ON public.rate_booking_config FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage rate booking config" ON public.rate_booking_config FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_rate_bcfg_updated BEFORE UPDATE ON public.rate_booking_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. gallery_assets
CREATE TABLE IF NOT EXISTS public.gallery_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  scope TEXT NOT NULL, -- property | site_type | site | package
  scope_id UUID,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hero BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gallery_assets_scope ON public.gallery_assets(property_id, scope, scope_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_assets TO authenticated;
GRANT ALL ON public.gallery_assets TO service_role;
ALTER TABLE public.gallery_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view gallery assets" ON public.gallery_assets FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage gallery assets" ON public.gallery_assets FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_gallery_assets_updated BEFORE UPDATE ON public.gallery_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. booking_holds
CREATE TABLE IF NOT EXISTS public.booking_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site_type_id UUID REFERENCES public.site_types(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  rate_id UUID REFERENCES public.rates(id) ON DELETE SET NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_holds_lookup ON public.booking_holds(property_id, check_in, check_out, expires_at);
GRANT SELECT ON public.booking_holds TO authenticated;
GRANT ALL ON public.booking_holds TO service_role;
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view booking holds" ON public.booking_holds FOR SELECT TO authenticated USING (user_can_access_property(property_id));

-- 9. packages (schema only, UI phase 2)
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  charge_type TEXT NOT NULL DEFAULT 'per_stay', -- per_stay | per_night | per_person
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view packages" ON public.packages FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage packages" ON public.packages FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_items TO authenticated;
GRANT ALL ON public.package_items TO service_role;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view package items" ON public.package_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_items.package_id AND user_can_access_property(p.property_id)));
CREATE POLICY "Staff manage package items" ON public.package_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_items.package_id AND user_can_access_property(p.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_items.package_id AND user_can_access_property(p.property_id)));

-- 10. promo_codes (schema only)
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- percent | fixed | free_nights | waive_deposit
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  valid_from DATE,
  valid_to DATE,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view promo codes" ON public.promo_codes FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage promo codes" ON public.promo_codes FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_promo_codes_updated BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. los_discount_rules (schema only)
CREATE TABLE IF NOT EXISTS public.los_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_nights INTEGER NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- percent | fixed_per_night
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.los_discount_rules TO authenticated;
GRANT ALL ON public.los_discount_rules TO service_role;
ALTER TABLE public.los_discount_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view los rules" ON public.los_discount_rules FOR SELECT TO authenticated USING (user_can_access_property(property_id));
CREATE POLICY "Staff manage los rules" ON public.los_discount_rules FOR ALL TO authenticated USING (user_can_access_property(property_id)) WITH CHECK (user_can_access_property(property_id));
CREATE TRIGGER trg_los_rules_updated BEFORE UPDATE ON public.los_discount_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Slug generator function
CREATE OR REPLACE FUNCTION public.generate_booking_public_slug()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_slug TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- 22-char URL-safe token (base64url without padding)
    new_slug := replace(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), '=', '');
    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE booking_public_slug = new_slug) THEN
      RETURN new_slug;
    END IF;
    attempts := attempts + 1;
    IF attempts > 5 THEN
      RAISE EXCEPTION 'Could not generate unique booking slug';
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_booking_public_slug() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_booking_public_slug() TO service_role;
