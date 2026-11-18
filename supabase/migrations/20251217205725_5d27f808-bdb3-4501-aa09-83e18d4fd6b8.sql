-- Add site_type_id to reservations table for type_floating inventory mode
ALTER TABLE public.reservations
ADD COLUMN site_type_id uuid REFERENCES public.site_types(id);

-- Add an index for performance when filtering by site_type
CREATE INDEX idx_reservations_site_type_id ON public.reservations(site_type_id);

COMMENT ON COLUMN public.reservations.site_type_id IS 'The booked room/site type, independent of specific room assignment. Used for type_floating inventory mode.';