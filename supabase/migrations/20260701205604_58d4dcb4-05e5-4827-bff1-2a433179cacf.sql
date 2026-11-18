
ALTER TABLE public.booking_engine_settings
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS text_color text,
  ADD COLUMN IF NOT EXISTS heading_font text,
  ADD COLUMN IF NOT EXISTS body_font text,
  ADD COLUMN IF NOT EXISTS button_radius text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_source_url text,
  ADD COLUMN IF NOT EXISTS brand_synced_at timestamptz;
