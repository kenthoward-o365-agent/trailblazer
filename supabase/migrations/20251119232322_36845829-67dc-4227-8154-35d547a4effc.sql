-- Add description field to sites table
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add icon field to site_types table for type-specific icons
ALTER TABLE public.site_types
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'tent';

-- Update existing site types with appropriate icons
UPDATE public.site_types
SET icon = CASE
  WHEN name = 'Tent Camping' THEN 'tent'
  WHEN name = 'Class A RV' THEN 'bus'
  WHEN name = 'Class B RV' THEN 'truck'
  WHEN name = 'Class C RV' THEN 'home'
  WHEN name = 'Towable RV' THEN 'caravan'
  ELSE 'map-pin'
END;

-- Add RLS policies for staff to manage sites
CREATE POLICY "Staff can create sites"
ON public.sites FOR INSERT
WITH CHECK (
  (SELECT has_role(auth.uid(), 'admin')) OR 
  (SELECT has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Staff can update sites"
ON public.sites FOR UPDATE
USING (
  (SELECT has_role(auth.uid(), 'admin')) OR 
  (SELECT has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Staff can delete sites"
ON public.sites FOR DELETE
USING (
  (SELECT has_role(auth.uid(), 'admin')) OR 
  (SELECT has_role(auth.uid(), 'manager'))
);