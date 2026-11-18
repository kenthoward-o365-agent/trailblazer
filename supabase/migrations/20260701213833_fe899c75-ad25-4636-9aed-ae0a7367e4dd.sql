CREATE OR REPLACE FUNCTION public.generate_booking_public_slug()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_slug TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- 22-char URL-safe token built from two md5 hashes of random values
    new_slug := replace(replace(replace(
      encode(decode(substr(md5(random()::text || clock_timestamp()::text) || md5(random()::text), 1, 32), 'hex'), 'base64'),
      '+', '-'), '/', '_'), '=', '');
    new_slug := substr(new_slug, 1, 22);

    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE booking_public_slug = new_slug) THEN
      RETURN new_slug;
    END IF;
    attempts := attempts + 1;
    IF attempts > 5 THEN
      RAISE EXCEPTION 'Could not generate unique booking slug';
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_booking_public_slug() TO authenticated;