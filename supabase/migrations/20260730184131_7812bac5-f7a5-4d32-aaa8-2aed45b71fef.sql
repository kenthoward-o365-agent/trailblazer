UPDATE storage.objects
SET name = regexp_replace(name, '^([0-9a-f-]{36})-', '\1/')
WHERE bucket_id = 'campground-maps'
  AND name ~ '^[0-9a-f-]{36}-';

UPDATE public.properties p
SET map_image_url = regexp_replace(map_image_url, '/campground-maps/([0-9a-f-]{36})-', '/campground-maps/\1/')
WHERE map_image_url LIKE '%/campground-maps/%'
  AND map_image_url ~ '/campground-maps/[0-9a-f-]{36}-';