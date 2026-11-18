-- Add maintenance status fields to sites table
ALTER TABLE public.sites 
ADD COLUMN maintenance_status text DEFAULT 'available' CHECK (maintenance_status IN ('available', 'inspection', 'unavailable')),
ADD COLUMN unavailable_start_date date,
ADD COLUMN unavailable_end_date date,
ADD COLUMN unavailable_reason text;

-- Create index for efficient status queries
CREATE INDEX idx_sites_maintenance_status ON public.sites(maintenance_status);