
CREATE POLICY "campaign_images_select_by_property"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-images'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "campaign_images_update_by_property"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'campaign-images'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'campaign-images'
  AND public.user_has_property_access(((storage.foldername(name))[1])::uuid)
);
