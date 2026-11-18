
ALTER TABLE public.booking_engine_settings
  ADD COLUMN IF NOT EXISTS custom_css TEXT,
  ADD COLUMN IF NOT EXISTS header_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS footer_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS footer_note TEXT,
  ADD COLUMN IF NOT EXISTS widget_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.booking_engine_settings.custom_css IS 'Scoped CSS injected into public booking pages (wrapped under .booking-brand)';
COMMENT ON COLUMN public.booking_engine_settings.header_links IS 'Array of {label,url,open_in_new_tab} nav items in the public header';
COMMENT ON COLUMN public.booking_engine_settings.footer_columns IS 'Array of {title, links:[{label,url}]} for the public footer';
COMMENT ON COLUMN public.booking_engine_settings.widget_config IS 'Booking widget presentation: {button_label, button_color, text_color, radius, layout, show_site_type}';
