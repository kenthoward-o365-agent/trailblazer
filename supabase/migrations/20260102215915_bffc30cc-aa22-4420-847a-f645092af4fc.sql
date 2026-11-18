-- Add favorite_site_id to guests table
ALTER TABLE public.guests 
ADD COLUMN favorite_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

-- Add assignment_locked to reservations table
ALTER TABLE public.reservations 
ADD COLUMN assignment_locked boolean DEFAULT false;