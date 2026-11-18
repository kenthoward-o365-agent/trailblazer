
CREATE POLICY "Read booking gallery under property folder"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'booking-gallery'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id::text = (storage.foldername(name))[1]
  )
);
