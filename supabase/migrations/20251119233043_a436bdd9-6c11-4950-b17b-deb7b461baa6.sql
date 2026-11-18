-- Add site_access_type column to sites table
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS site_access_type TEXT DEFAULT 'back_in' CHECK (site_access_type IN ('back_in', 'pull_through'));