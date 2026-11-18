-- Standard site attributes
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS is_shaded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_fire_pit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_picnic_table boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_bump_outs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_50amp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_30amp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Site types: description sources for booking engine
ALTER TABLE public.site_types
  ADD COLUMN IF NOT EXISTS auto_description text,
  ADD COLUMN IF NOT EXISTS booking_engine_description_override text,
  ADD COLUMN IF NOT EXISTS use_auto_description boolean NOT NULL DEFAULT true;

-- Reservation-side required attributes
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS required_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Custom attribute definitions per property (max 5)
CREATE TABLE IF NOT EXISTS public.site_custom_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  data_type text NOT NULL DEFAULT 'boolean' CHECK (data_type IN ('boolean','number','text')),
  enforce_on_booking boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_custom_attributes TO authenticated;
GRANT SELECT ON public.site_custom_attributes TO anon;
GRANT ALL ON public.site_custom_attributes TO service_role;

ALTER TABLE public.site_custom_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view custom attributes for their properties"
  ON public.site_custom_attributes FOR SELECT
  USING (public.user_can_access_property(property_id) OR true);

CREATE POLICY "Users can insert custom attributes for their properties"
  ON public.site_custom_attributes FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_property(property_id));

CREATE POLICY "Users can update custom attributes for their properties"
  ON public.site_custom_attributes FOR UPDATE TO authenticated
  USING (public.user_can_access_property(property_id))
  WITH CHECK (public.user_can_access_property(property_id));

CREATE POLICY "Users can delete custom attributes for their properties"
  ON public.site_custom_attributes FOR DELETE TO authenticated
  USING (public.user_can_access_property(property_id));

CREATE TRIGGER trg_site_custom_attributes_updated_at
  BEFORE UPDATE ON public.site_custom_attributes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce max 5 custom attributes per property
CREATE OR REPLACE FUNCTION public.enforce_max_site_custom_attributes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.site_custom_attributes WHERE property_id = NEW.property_id;
  IF cnt >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 custom site attributes per property reached';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_site_custom_attributes_max
  BEFORE INSERT ON public.site_custom_attributes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_site_custom_attributes();