
CREATE POLICY "WO photos select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND public.user_has_property_access((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "WO photos insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND public.user_has_property_access((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "WO photos delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND public.user_has_property_access((storage.foldername(name))[1]::uuid)
  );
