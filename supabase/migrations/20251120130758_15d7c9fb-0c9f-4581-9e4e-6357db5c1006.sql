-- Add size columns to sites table for custom icon dimensions
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS map_width numeric,
ADD COLUMN IF NOT EXISTS map_height numeric;