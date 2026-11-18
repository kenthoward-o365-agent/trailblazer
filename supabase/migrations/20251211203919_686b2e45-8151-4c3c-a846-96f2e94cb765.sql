
-- Phase 1: Database Foundation for Hotel Property Type

-- 1.1 Create enums for property type and inventory mode
DO $$ BEGIN
  CREATE TYPE property_type AS ENUM ('campground', 'hotel');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_mode AS ENUM ('unit_required', 'type_floating');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE housekeeping_status AS ENUM ('clean', 'dirty', 'needs_inspection', 'out_of_order');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE occupancy_status AS ENUM ('vacant', 'occupied');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cleaning_type AS ENUM ('stayover', 'departure', 'deep_clean');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('pending', 'in_progress', 'completed', 'inspected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.2 Add property type and inventory mode to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS property_type property_type NOT NULL DEFAULT 'campground',
ADD COLUMN IF NOT EXISTS inventory_mode inventory_mode NOT NULL DEFAULT 'unit_required';

-- 1.3 Add hotel-specific columns to sites table
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS floor text,
ADD COLUMN IF NOT EXISTS view_type text,
ADD COLUMN IF NOT EXISTS bed_config text,
ADD COLUMN IF NOT EXISTS connecting_room_id uuid REFERENCES public.sites(id),
ADD COLUMN IF NOT EXISTS is_ada_accessible boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS zone_id uuid,
ADD COLUMN IF NOT EXISTS housekeeping_status housekeeping_status DEFAULT 'clean',
ADD COLUMN IF NOT EXISTS occupancy_status occupancy_status DEFAULT 'vacant';

-- 1.4 Create housekeeping_zones table
CREATE TABLE IF NOT EXISTS public.housekeeping_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'custom', -- floor, wing, custom
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key from sites to zones
ALTER TABLE public.sites
ADD CONSTRAINT sites_zone_id_fkey 
FOREIGN KEY (zone_id) REFERENCES public.housekeeping_zones(id) ON DELETE SET NULL;

-- 1.5 Create housekeeping_staff table (simple assignment tracking)
CREATE TABLE IF NOT EXISTS public.housekeeping_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 1.6 Create housekeeping_assignments table
CREATE TABLE IF NOT EXISTS public.housekeeping_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  assignment_date date NOT NULL DEFAULT CURRENT_DATE,
  staff_id uuid REFERENCES public.housekeeping_staff(id) ON DELETE SET NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  cleaning_type cleaning_type NOT NULL,
  status assignment_status NOT NULL DEFAULT 'pending',
  completed_at timestamp with time zone,
  inspected_by uuid,
  inspected_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 1.7 Create room_type_cleaning_times table
CREATE TABLE IF NOT EXISTS public.room_type_cleaning_times (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_type_id uuid NOT NULL REFERENCES public.site_types(id) ON DELETE CASCADE,
  stayover_minutes integer NOT NULL DEFAULT 30,
  departure_minutes integer NOT NULL DEFAULT 45,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(site_type_id)
);

-- 1.8 Create cleaning_preferences table
CREATE TABLE IF NOT EXISTS public.cleaning_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE UNIQUE,
  sheet_change_days integer DEFAULT 3,
  full_clean_interval integer DEFAULT 7,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 1.9 Create guest_room_preferences table
CREATE TABLE IF NOT EXISTS public.guest_room_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  preference_type text NOT NULL, -- floor, view, bed_config, ada, connecting
  preference_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(guest_id, preference_type)
);

-- 1.10 Modify reservations to allow nullable site_id for type_floating
ALTER TABLE public.reservations 
ALTER COLUMN site_id DROP NOT NULL;

-- Enable RLS on new tables
ALTER TABLE public.housekeeping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_type_cleaning_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_room_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for housekeeping_zones
CREATE POLICY "Staff can view housekeeping zones" ON public.housekeeping_zones
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage housekeeping zones" ON public.housekeeping_zones
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for housekeeping_staff
CREATE POLICY "Staff can view housekeeping staff" ON public.housekeeping_staff
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage housekeeping staff" ON public.housekeeping_staff
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for housekeeping_assignments
CREATE POLICY "Staff can view housekeeping assignments" ON public.housekeeping_assignments
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage housekeeping assignments" ON public.housekeeping_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role));

-- RLS Policies for room_type_cleaning_times
CREATE POLICY "Staff can view cleaning times" ON public.room_type_cleaning_times
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage cleaning times" ON public.room_type_cleaning_times
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for cleaning_preferences
CREATE POLICY "Staff can view cleaning preferences" ON public.cleaning_preferences
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage cleaning preferences" ON public.cleaning_preferences
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for guest_room_preferences
CREATE POLICY "Staff can view guest preferences" ON public.guest_room_preferences
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role));

CREATE POLICY "Staff can manage guest preferences" ON public.guest_room_preferences
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_housekeeping_zones_property ON public.housekeeping_zones(property_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_staff_property ON public.housekeeping_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_property_date ON public.housekeeping_assignments(property_id, assignment_date);
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_staff ON public.housekeeping_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_site ON public.housekeeping_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_sites_zone ON public.sites(zone_id);
CREATE INDEX IF NOT EXISTS idx_sites_housekeeping_status ON public.sites(housekeeping_status);
CREATE INDEX IF NOT EXISTS idx_guest_room_preferences_guest ON public.guest_room_preferences(guest_id);

-- Create function to update site housekeeping status on checkout
CREATE OR REPLACE FUNCTION public.update_site_status_on_checkout()
RETURNS TRIGGER AS $$
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
      -- Campground: Set to needs_inspection
      UPDATE public.sites 
      SET maintenance_status = 'waiting_inspection'
      WHERE id = NEW.site_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for checkout status update
DROP TRIGGER IF EXISTS trigger_update_site_status_on_checkout ON public.reservations;
CREATE TRIGGER trigger_update_site_status_on_checkout
  AFTER UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_status_on_checkout();

-- Create function to mark occupied rooms as dirty during dayend close
CREATE OR REPLACE FUNCTION public.mark_occupied_rooms_dirty(p_property_id uuid)
RETURNS void AS $$
BEGIN
  -- Mark all occupied rooms as dirty for stayover cleaning
  UPDATE public.sites s
  SET housekeeping_status = 'dirty'
  WHERE s.property_id = p_property_id
    AND s.occupancy_status = 'occupied'
    AND s.housekeeping_status = 'clean';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
