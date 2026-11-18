-- Phase 2.5: Fix housekeeping tables RLS

-- Drop existing policies for cleaning_preferences
DROP POLICY IF EXISTS "Staff can view cleaning preferences" ON public.cleaning_preferences;
DROP POLICY IF EXISTS "Managers can manage cleaning preferences" ON public.cleaning_preferences;

-- Create properly scoped policies for cleaning_preferences
CREATE POLICY "Staff can view property cleaning preferences" 
ON public.cleaning_preferences FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property cleaning preferences" 
ON public.cleaning_preferences FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for housekeeping_assignments
DROP POLICY IF EXISTS "Staff can view housekeeping assignments" ON public.housekeeping_assignments;
DROP POLICY IF EXISTS "Staff can manage housekeeping assignments" ON public.housekeeping_assignments;

-- Create properly scoped policies for housekeeping_assignments
CREATE POLICY "Staff can view property housekeeping assignments" 
ON public.housekeeping_assignments FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can manage property housekeeping assignments" 
ON public.housekeeping_assignments FOR ALL TO authenticated
USING (user_has_property_access(property_id))
WITH CHECK (user_has_property_access(property_id));

-- Drop existing policies for housekeeping_staff
DROP POLICY IF EXISTS "Staff can view housekeeping staff" ON public.housekeeping_staff;
DROP POLICY IF EXISTS "Managers can manage housekeeping staff" ON public.housekeeping_staff;

-- Create properly scoped policies for housekeeping_staff
CREATE POLICY "Staff can view property housekeeping staff" 
ON public.housekeeping_staff FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property housekeeping staff" 
ON public.housekeeping_staff FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for housekeeping_zones
DROP POLICY IF EXISTS "Staff can view housekeeping zones" ON public.housekeeping_zones;
DROP POLICY IF EXISTS "Managers can manage housekeeping zones" ON public.housekeeping_zones;

-- Create properly scoped policies for housekeeping_zones
CREATE POLICY "Staff can view property housekeeping zones" 
ON public.housekeeping_zones FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property housekeeping zones" 
ON public.housekeeping_zones FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);