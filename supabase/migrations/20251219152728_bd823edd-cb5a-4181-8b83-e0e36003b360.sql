-- Update RLS policy on guests table to use can_access_guest function
-- This allows access to guests who have reservations at the current property

DROP POLICY IF EXISTS "Staff can view organization guests" ON guests;

CREATE POLICY "Staff can view organization guests" ON guests
  FOR SELECT
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.user_id = auth.uid()
      AND can_access_guest(guests.id, upa.property_id)
    )
  );