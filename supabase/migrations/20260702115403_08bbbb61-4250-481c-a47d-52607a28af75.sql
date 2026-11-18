DROP POLICY IF EXISTS "Read booking gallery under property folder" ON storage.objects;

CREATE POLICY "Read booking gallery under property folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-gallery'
  AND public.user_can_access_property(((storage.foldername(name))[1])::uuid)
);