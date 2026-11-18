-- Fix guest names missing in reservations: adjust guests SELECT policy to allow access
-- whenever the guest has any reservation at a property the user can access.

DROP POLICY IF EXISTS "Staff can view organization guests" ON public.guests;

CREATE POLICY "Staff can view organization guests" ON public.guests
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (
      guests.origin_property_id IS NOT NULL
      AND public.user_can_access_property(guests.origin_property_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.guest_id = guests.id
        AND public.user_can_access_property(r.property_id)
    )
  );