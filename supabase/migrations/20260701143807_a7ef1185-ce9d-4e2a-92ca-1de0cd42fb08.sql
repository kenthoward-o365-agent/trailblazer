
CREATE OR REPLACE FUNCTION public.pci_retention_sweep()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_deleted int := 0;
  tx_deleted int := 0;
  log_deleted int := 0;
  cards_purged int := 0;
BEGIN
  DELETE FROM public.payment_authorizations
   WHERE created_at < now() - interval '13 months'
     AND status IN ('EXPIRED','CANCELLED','REVERSED','CAPTURED','REFUNDED');
  GET DIAGNOSTICS auth_deleted = ROW_COUNT;

  DELETE FROM public.payment_transactions
   WHERE created_at < now() - interval '18 months';
  GET DIAGNOSTICS tx_deleted = ROW_COUNT;

  DELETE FROM public.api_logs
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS log_deleted = ROW_COUNT;

  UPDATE public.payment_cards
     SET cardholder_name = NULL,
         expiry_month = NULL,
         expiry_year = NULL
   WHERE updated_at < now() - interval '24 months'
     AND NOT EXISTS (
       SELECT 1 FROM public.payment_authorizations pa
        WHERE pa.payment_card_id = payment_cards.id
          AND pa.status NOT IN ('EXPIRED','CANCELLED','REVERSED','REFUNDED')
     );
  GET DIAGNOSTICS cards_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'auth_deleted', auth_deleted,
    'tx_deleted', tx_deleted,
    'log_deleted', log_deleted,
    'cards_purged', cards_purged
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pci_retention_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pci_retention_sweep() TO service_role;
