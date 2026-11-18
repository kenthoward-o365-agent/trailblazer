-- =====================================================
-- MULTI-GUEST FOLIO SYSTEM - SCHEMA CHANGES
-- =====================================================

-- 1. Create reservation_guests junction table
CREATE TABLE public.reservation_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id),
  folio_number INT NOT NULL CHECK (folio_number BETWEEN 1 AND 4),
  guest_confirmation_number TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reservation_id, folio_number),
  UNIQUE(reservation_id, guest_id)
);

-- Enable RLS
ALTER TABLE public.reservation_guests ENABLE ROW LEVEL SECURITY;

-- RLS Policies using existing user_has_property_access function via reservation lookup
CREATE POLICY "Staff can view reservation guests"
  ON public.reservation_guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_guests.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can insert reservation guests"
  ON public.reservation_guests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_guests.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can update reservation guests"
  ON public.reservation_guests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_guests.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can delete reservation guests"
  ON public.reservation_guests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_guests.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

-- 2. Add reservation_guest_id to ledger_accounts
ALTER TABLE public.ledger_accounts 
ADD COLUMN reservation_guest_id UUID REFERENCES public.reservation_guests(id) ON DELETE SET NULL;

-- 3. Add reservation_guest_id to payment_cards
ALTER TABLE public.payment_cards 
ADD COLUMN reservation_guest_id UUID REFERENCES public.reservation_guests(id) ON DELETE SET NULL;

-- 4. Add transfer tracking columns to folio_postings
ALTER TABLE public.folio_postings
ADD COLUMN source_posting_id UUID REFERENCES public.folio_postings(id),
ADD COLUMN source_ledger_account_id UUID REFERENCES public.ledger_accounts(id),
ADD COLUMN transfer_note TEXT;

-- 5. Create folio_split_rules table
CREATE TABLE public.folio_split_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id),
  split_type TEXT NOT NULL CHECK (split_type IN ('percentage', 'fixed_amount')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reservation_id, account_id)
);

ALTER TABLE public.folio_split_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view split rules"
  ON public.folio_split_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = folio_split_rules.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can insert split rules"
  ON public.folio_split_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = folio_split_rules.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can update split rules"
  ON public.folio_split_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = folio_split_rules.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can delete split rules"
  ON public.folio_split_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = folio_split_rules.reservation_id
      AND user_has_property_access(r.property_id)
    )
  );

-- 6. Create folio_split_rule_allocations table
CREATE TABLE public.folio_split_rule_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_rule_id UUID NOT NULL REFERENCES public.folio_split_rules(id) ON DELETE CASCADE,
  reservation_guest_id UUID NOT NULL REFERENCES public.reservation_guests(id) ON DELETE CASCADE,
  allocation_value DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(split_rule_id, reservation_guest_id)
);

ALTER TABLE public.folio_split_rule_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view split allocations"
  ON public.folio_split_rule_allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.folio_split_rules fsr
      JOIN public.reservations r ON fsr.reservation_id = r.id
      WHERE fsr.id = folio_split_rule_allocations.split_rule_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can insert split allocations"
  ON public.folio_split_rule_allocations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folio_split_rules fsr
      JOIN public.reservations r ON fsr.reservation_id = r.id
      WHERE fsr.id = folio_split_rule_allocations.split_rule_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can update split allocations"
  ON public.folio_split_rule_allocations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.folio_split_rules fsr
      JOIN public.reservations r ON fsr.reservation_id = r.id
      WHERE fsr.id = folio_split_rule_allocations.split_rule_id
      AND user_has_property_access(r.property_id)
    )
  );

CREATE POLICY "Staff can delete split allocations"
  ON public.folio_split_rule_allocations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.folio_split_rules fsr
      JOIN public.reservations r ON fsr.reservation_id = r.id
      WHERE fsr.id = folio_split_rule_allocations.split_rule_id
      AND user_has_property_access(r.property_id)
    )
  );

-- 7. Create indexes for performance
CREATE INDEX idx_reservation_guests_reservation_id ON public.reservation_guests(reservation_id);
CREATE INDEX idx_reservation_guests_guest_id ON public.reservation_guests(guest_id);
CREATE INDEX idx_ledger_accounts_reservation_guest_id ON public.ledger_accounts(reservation_guest_id);
CREATE INDEX idx_payment_cards_reservation_guest_id ON public.payment_cards(reservation_guest_id);
CREATE INDEX idx_folio_split_rules_reservation_id ON public.folio_split_rules(reservation_id);
CREATE INDEX idx_folio_split_rule_allocations_split_rule_id ON public.folio_split_rule_allocations(split_rule_id);
CREATE INDEX idx_folio_postings_source_posting_id ON public.folio_postings(source_posting_id);

-- 8. Create triggers for updated_at
CREATE TRIGGER update_reservation_guests_updated_at
  BEFORE UPDATE ON public.reservation_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folio_split_rules_updated_at
  BEFORE UPDATE ON public.folio_split_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Data Migration: Create reservation_guests records for existing reservations
INSERT INTO public.reservation_guests (reservation_id, guest_id, folio_number, guest_confirmation_number, is_primary)
SELECT 
  r.id as reservation_id,
  r.guest_id as guest_id,
  1 as folio_number,
  r.confirmation_number as guest_confirmation_number,
  true as is_primary
FROM public.reservations r
WHERE r.guest_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 10. Update existing ledger_accounts to link to reservation_guests
UPDATE public.ledger_accounts la
SET reservation_guest_id = rg.id
FROM public.reservation_guests rg
WHERE la.reservation_id = rg.reservation_id
AND rg.is_primary = true
AND la.ledger_type = 'guest'
AND la.reservation_guest_id IS NULL;

-- 11. Update existing payment_cards to link to reservation_guests
UPDATE public.payment_cards pc
SET reservation_guest_id = rg.id
FROM public.reservation_guests rg
WHERE pc.reservation_id = rg.reservation_id
AND rg.is_primary = true
AND pc.reservation_guest_id IS NULL;