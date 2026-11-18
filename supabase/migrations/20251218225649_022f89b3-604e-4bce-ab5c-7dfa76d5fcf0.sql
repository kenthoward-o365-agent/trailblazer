-- Phase 2.3: Fix guest/reservation tables RLS - guests, reservations, guest_room_preferences

-- For guests: they are organization-scoped, not property-scoped directly
-- We need to check via origin_property_id or via sharing groups
DROP POLICY IF EXISTS "Staff can view guests" ON public.guests;
DROP POLICY IF EXISTS "Staff can create guests" ON public.guests;
DROP POLICY IF EXISTS "Staff can update guests" ON public.guests;

-- Guests can be shared across properties in an organization via sharing groups
-- Staff can view guests if they have access to any property in the same organization
CREATE POLICY "Staff can view organization guests" 
ON public.guests FOR SELECT TO authenticated
USING (
  -- User has access to the origin property
  (origin_property_id IS NOT NULL AND user_has_property_access(origin_property_id))
  OR
  -- User has access to any property in the same organization
  EXISTS (
    SELECT 1 FROM public.user_property_access upa
    JOIN public.properties p ON p.id = upa.property_id
    WHERE upa.user_id = auth.uid()
    AND p.organization_id = guests.organization_id
  )
  OR is_super_admin()
);

CREATE POLICY "Staff can create guests" 
ON public.guests FOR INSERT TO authenticated
WITH CHECK (
  (origin_property_id IS NOT NULL AND user_has_property_access(origin_property_id))
  OR is_super_admin()
);

CREATE POLICY "Staff can update guests" 
ON public.guests FOR UPDATE TO authenticated
USING (
  (origin_property_id IS NOT NULL AND user_has_property_access(origin_property_id))
  OR
  EXISTS (
    SELECT 1 FROM public.user_property_access upa
    JOIN public.properties p ON p.id = upa.property_id
    WHERE upa.user_id = auth.uid()
    AND p.organization_id = guests.organization_id
  )
  OR is_super_admin()
);

-- Drop existing policies for reservations
DROP POLICY IF EXISTS "Staff can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can update reservations" ON public.reservations;

-- Create properly scoped policies for reservations
CREATE POLICY "Staff can view property reservations" 
ON public.reservations FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property reservations" 
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Staff can update property reservations" 
ON public.reservations FOR UPDATE TO authenticated
USING (user_has_property_access(property_id));

-- Drop existing policies for guest_room_preferences
DROP POLICY IF EXISTS "Staff can view guest preferences" ON public.guest_room_preferences;
DROP POLICY IF EXISTS "Staff can manage guest preferences" ON public.guest_room_preferences;

-- guest_room_preferences links to guests, so check via guest's organization
CREATE POLICY "Staff can view guest room preferences" 
ON public.guest_room_preferences FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.id = guest_room_preferences.guest_id
    AND (
      (g.origin_property_id IS NOT NULL AND user_has_property_access(g.origin_property_id))
      OR EXISTS (
        SELECT 1 FROM public.user_property_access upa
        JOIN public.properties p ON p.id = upa.property_id
        WHERE upa.user_id = auth.uid()
        AND p.organization_id = g.organization_id
      )
    )
  )
  OR is_super_admin()
);

CREATE POLICY "Staff can manage guest room preferences" 
ON public.guest_room_preferences FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.id = guest_room_preferences.guest_id
    AND (
      (g.origin_property_id IS NOT NULL AND user_has_property_access(g.origin_property_id))
      OR EXISTS (
        SELECT 1 FROM public.user_property_access upa
        JOIN public.properties p ON p.id = upa.property_id
        WHERE upa.user_id = auth.uid()
        AND p.organization_id = g.organization_id
      )
    )
  )
  OR is_super_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.id = guest_room_preferences.guest_id
    AND (
      (g.origin_property_id IS NOT NULL AND user_has_property_access(g.origin_property_id))
      OR EXISTS (
        SELECT 1 FROM public.user_property_access upa
        JOIN public.properties p ON p.id = upa.property_id
        WHERE upa.user_id = auth.uid()
        AND p.organization_id = g.organization_id
      )
    )
  )
  OR is_super_admin()
);