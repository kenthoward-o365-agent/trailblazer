-- Fix guests SELECT policy to use authenticated role instead of public
DROP POLICY IF EXISTS "Staff can view organization guests" ON public.guests;

CREATE POLICY "Staff can view organization guests" ON public.guests
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      origin_property_id IS NOT NULL
      AND public.user_can_access_property(origin_property_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.guest_id = guests.id
        AND public.user_can_access_property(r.property_id)
    )
  );