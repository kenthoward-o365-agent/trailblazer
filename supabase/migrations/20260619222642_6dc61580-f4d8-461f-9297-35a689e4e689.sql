
-- 1. Normalize existing data (defensive)
UPDATE public.properties SET property_type = 'campground', inventory_mode = 'unit_required';

-- 2. Drop hotel-only tables
DROP TABLE IF EXISTS public.housekeeping_assignments CASCADE;
DROP TABLE IF EXISTS public.housekeeping_staff CASCADE;
DROP TABLE IF EXISTS public.housekeeping_zones CASCADE;
DROP TABLE IF EXISTS public.room_type_cleaning_times CASCADE;

-- 3. Drop hotel-only function
DROP FUNCTION IF EXISTS public.mark_occupied_rooms_dirty(uuid);

-- 4. Replace checkout trigger function with campground-only logic
CREATE OR REPLACE FUNCTION public.update_site_status_on_checkout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'CHECKED_OUT' AND OLD.status != 'CHECKED_OUT' AND NEW.site_id IS NOT NULL THEN
    UPDATE public.sites 
    SET maintenance_status = 'inspection', occupancy_status = 'vacant'
    WHERE id = NEW.site_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Drop hotel-only columns from properties
ALTER TABLE public.properties 
  DROP COLUMN IF EXISTS property_type,
  DROP COLUMN IF EXISTS inventory_mode;

-- 6. Drop hotel-only columns from sites (after trigger updated)
-- Update trigger again to not reference occupancy_status if dropping it
CREATE OR REPLACE FUNCTION public.update_site_status_on_checkout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'CHECKED_OUT' AND OLD.status != 'CHECKED_OUT' AND NEW.site_id IS NOT NULL THEN
    UPDATE public.sites 
    SET maintenance_status = 'inspection'
    WHERE id = NEW.site_id;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.sites 
  DROP COLUMN IF EXISTS housekeeping_status,
  DROP COLUMN IF EXISTS occupancy_status;

-- 7. Drop enum types
DROP TYPE IF EXISTS public.property_type;
DROP TYPE IF EXISTS public.inventory_mode;
