-- Add rotation column to sites table for site orientation
ALTER TABLE public.sites
ADD COLUMN rotation integer DEFAULT 0;

COMMENT ON COLUMN public.sites.rotation IS 'Rotation angle in degrees (0-360) for site orientation on map';