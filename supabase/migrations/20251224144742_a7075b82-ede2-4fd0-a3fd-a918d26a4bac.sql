-- Fix existing hidden payment_cards rows so they are readable by property-scoped policies
UPDATE public.payment_cards pc
SET property_id = r.property_id
FROM public.reservations r
WHERE pc.reservation_id = r.id
  AND pc.property_id IS NULL;

UPDATE public.payment_cards pc
SET property_id = la.property_id
FROM public.ledger_accounts la
WHERE pc.ledger_account_id = la.id
  AND pc.property_id IS NULL;

-- Ensure new payment_cards always get a unique card_sequence per reservation (avoids 23505 unique_card_sequence_per_reservation)
CREATE OR REPLACE FUNCTION public.payment_cards_before_insert_set_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Best-effort: populate property_id when omitted
  IF NEW.property_id IS NULL THEN
    IF NEW.reservation_id IS NOT NULL THEN
      SELECT r.property_id INTO NEW.property_id
      FROM public.reservations r
      WHERE r.id = NEW.reservation_id;
    ELSIF NEW.ledger_account_id IS NOT NULL THEN
      SELECT la.property_id INTO NEW.property_id
      FROM public.ledger_accounts la
      WHERE la.id = NEW.ledger_account_id;
    END IF;
  END IF;

  -- Always assign next sequence for reservation-linked cards to satisfy unique constraint
  IF NEW.reservation_id IS NOT NULL THEN
    -- Prevent race conditions if two cards are added simultaneously
    PERFORM pg_advisory_xact_lock(hashtext(NEW.reservation_id::text));

    SELECT COALESCE(MAX(pc.card_sequence), 0) + 1
      INTO NEW.card_sequence
    FROM public.payment_cards pc
    WHERE pc.reservation_id = NEW.reservation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_cards_before_insert_set_defaults ON public.payment_cards;
CREATE TRIGGER trg_payment_cards_before_insert_set_defaults
BEFORE INSERT ON public.payment_cards
FOR EACH ROW
EXECUTE FUNCTION public.payment_cards_before_insert_set_defaults();