-- Add max_sites column to properties table
ALTER TABLE public.properties ADD COLUMN max_sites integer DEFAULT 50;

-- Update the check_site_limit function to use property-level limit
CREATE OR REPLACE FUNCTION public.check_site_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  -- Get max sites from property
  SELECT p.max_sites INTO max_allowed 
  FROM public.properties p WHERE p.id = NEW.property_id;
  
  -- If no max_sites set, allow (for migration period)
  IF max_allowed IS NULL THEN RETURN NEW; END IF;
  
  -- Count current sites for this property
  SELECT COUNT(*) INTO current_count
  FROM public.sites s
  WHERE s.property_id = NEW.property_id;
  
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Site limit reached (% of %). Please contact Trailblazer support to increase your site limit.', current_count, max_allowed;
  END IF;
  
  RETURN NEW;
END;
$function$;