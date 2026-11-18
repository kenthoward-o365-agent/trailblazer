UPDATE storage.objects
SET name = (storage.foldername(name))[1] || '-' || (storage.filename(name))
WHERE bucket_id = 'campground-maps'
  AND array_length(storage.foldername(name), 1) = 1
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$';

UPDATE public.properties p
SET map_image_url = regexp_replace(
  map_image_url,
  '/campground-maps/([0-9a-f-]{36})/([^/?]+)',
  '/campground-maps/\1-\2'
)
WHERE map_image_url LIKE '%/campground-maps/%'
  AND map_image_url ~ '/campground-maps/[0-9a-f-]{36}/';

DROP POLICY IF EXISTS "Staff can list campground maps for their properties" ON storage.objects;
CREATE POLICY "Staff can list campground maps for their properties"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campground-maps'
  AND (
    public.is_super_admin()
    OR (
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
          THEN public.user_has_property_access(((storage.foldername(name))[1])::uuid)
        WHEN name ~ '^[0-9a-f-]{36}-'
          THEN public.user_has_property_access(substring(name from 1 for 36)::uuid)
        ELSE false
      END
    )
  )
);