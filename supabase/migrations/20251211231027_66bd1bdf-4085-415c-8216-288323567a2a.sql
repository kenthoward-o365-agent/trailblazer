-- Add hotel-specific room type attributes to site_types table
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS code VARCHAR(6);
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS room_class TEXT;
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS bed_type TEXT;
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS smoking_preference TEXT DEFAULT 'Non-Smoking';
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS floor_size_sqft INTEGER;
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS max_adults INTEGER DEFAULT 2;
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS max_children INTEGER DEFAULT 0;
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS is_wheelchair_accessible BOOLEAN DEFAULT false;
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS featured_amenities TEXT[];
ALTER TABLE public.site_types ADD COLUMN IF NOT EXISTS room_views TEXT[];

-- Add RLS policies for site_types management
CREATE POLICY "Staff can manage site types" ON public.site_types
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);