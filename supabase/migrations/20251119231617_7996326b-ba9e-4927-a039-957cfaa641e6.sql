-- Create storage bucket for campground map images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campground-maps', 'campground-maps', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for campground maps
CREATE POLICY "Staff can upload campground maps"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'campground-maps' AND
  (SELECT has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Staff can update campground maps"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'campground-maps' AND
  (SELECT has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Anyone can view campground maps"
ON storage.objects FOR SELECT
USING (bucket_id = 'campground-maps');

-- Add vehicle-specific fields to sites table
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS max_vehicle_length INTEGER,
ADD COLUMN IF NOT EXISTS has_towed_vehicle_parking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_towing_vehicle_parking BOOLEAN DEFAULT false;

-- Add campground map settings to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS map_image_url TEXT,
ADD COLUMN IF NOT EXISTS map_width INTEGER DEFAULT 1200,
ADD COLUMN IF NOT EXISTS map_height INTEGER DEFAULT 800;

-- Insert new RV-specific site types (only if they don't exist)
DO $$
DECLARE
  property_uuid UUID;
BEGIN
  -- Get the first property ID
  SELECT id INTO property_uuid FROM public.properties LIMIT 1;
  
  IF property_uuid IS NOT NULL THEN
    -- Insert Tent Camping site type
    INSERT INTO public.site_types (name, description, base_price, property_id)
    VALUES (
      'Tent Camping',
      'Traditional tent camping site with fire pit',
      25.00,
      property_uuid
    )
    ON CONFLICT DO NOTHING;
    
    -- Insert Class A RV site type
    INSERT INTO public.site_types (name, description, base_price, property_id)
    VALUES (
      'Class A RV',
      'Large pull-through site for Class A motorhomes with full hookups',
      75.00,
      property_uuid
    )
    ON CONFLICT DO NOTHING;
    
    -- Insert Class B RV site type
    INSERT INTO public.site_types (name, description, base_price, property_id)
    VALUES (
      'Class B RV',
      'Medium site for Class B motorhomes and campervans',
      55.00,
      property_uuid
    )
    ON CONFLICT DO NOTHING;
    
    -- Insert Class C RV site type
    INSERT INTO public.site_types (name, description, base_price, property_id)
    VALUES (
      'Class C RV',
      'Standard site for Class C motorhomes with full hookups',
      65.00,
      property_uuid
    )
    ON CONFLICT DO NOTHING;
    
    -- Insert Towable RV site type
    INSERT INTO public.site_types (name, description, base_price, property_id)
    VALUES (
      'Towable RV',
      'Site for travel trailers and fifth wheels with vehicle parking',
      60.00,
      property_uuid
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;