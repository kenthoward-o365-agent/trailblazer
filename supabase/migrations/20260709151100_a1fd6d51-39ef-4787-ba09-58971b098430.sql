CREATE OR REPLACE FUNCTION public.cleanup_expired_booking_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.booking_holds
   WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_booking_holds() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_booking_holds() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_booking_holds() TO service_role;

DO $$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'cleanup-expired-booking-holds';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;

  PERFORM cron.schedule(
    'cleanup-expired-booking-holds',
    '*/5 * * * *',
    $cron$SELECT public.cleanup_expired_booking_holds();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;