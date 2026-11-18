
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS default_online_buffer integer NOT NULL DEFAULT 0;

ALTER TABLE public.site_type_booking_config
  ADD COLUMN IF NOT EXISTS online_buffer integer;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_default_online_buffer_range CHECK (default_online_buffer >= 0 AND default_online_buffer <= 50);

ALTER TABLE public.site_type_booking_config
  ADD CONSTRAINT site_type_booking_config_online_buffer_range CHECK (online_buffer IS NULL OR (online_buffer >= 0 AND online_buffer <= 50));
