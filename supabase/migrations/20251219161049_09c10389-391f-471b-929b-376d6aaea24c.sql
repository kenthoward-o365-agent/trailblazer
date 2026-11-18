-- Fix the trigger to use valid maintenance_status value
CREATE OR REPLACE FUNCTION public.update_site_status_on_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prop_type property_type;
BEGIN
  -- Only trigger when status changes to CHECKED_OUT
  IF NEW.status = 'CHECKED_OUT' AND OLD.status != 'CHECKED_OUT' AND NEW.site_id IS NOT NULL THEN
    -- Get property type
    SELECT p.property_type INTO prop_type
    FROM public.properties p
    WHERE p.id = NEW.property_id;
    
    -- Update site status based on property type
    IF prop_type = 'hotel' THEN
      UPDATE public.sites 
      SET housekeeping_status = 'dirty', occupancy_status = 'vacant'
      WHERE id = NEW.site_id;
    ELSE
      -- Campground: Use 'inspection' (valid constraint value) instead of 'waiting_inspection'
      UPDATE public.sites 
      SET maintenance_status = 'inspection', occupancy_status = 'vacant'
      WHERE id = NEW.site_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;