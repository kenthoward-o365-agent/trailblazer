
-- Public read of booking-gallery objects (this is a private bucket, so we need an explicit SELECT policy for anon+auth)
CREATE POLICY "Public read booking gallery"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'booking-gallery');

-- Staff write scoped to property folder: booking-gallery/{property_id}/...
CREATE POLICY "Staff upload booking gallery"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'booking-gallery'
    AND public.user_can_access_property((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Staff update booking gallery"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'booking-gallery'
    AND public.user_can_access_property((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Staff delete booking gallery"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'booking-gallery'
    AND public.user_can_access_property((storage.foldername(name))[1]::uuid)
  );
