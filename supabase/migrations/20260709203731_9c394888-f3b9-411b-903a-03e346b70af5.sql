
-- =========================================================
-- RENTAL ITEMS (catalog)
-- =========================================================
CREATE TABLE public.rental_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('golf_cart','bicycle','kayak','paddleboard','tube','boat','other')),
  tracking_mode TEXT NOT NULL DEFAULT 'quantity' CHECK (tracking_mode IN ('quantity','individual')),
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  hourly_rate NUMERIC(10,2),
  daily_rate NUMERIC(10,2),
  stay_rate NUMERIC(10,2),
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenue_account_id UUID REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  messaging_offerable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rental_items_property ON public.rental_items(property_id);
CREATE UNIQUE INDEX rental_items_property_code_unique ON public.rental_items(property_id, code) WHERE code IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_items TO authenticated;
GRANT ALL ON public.rental_items TO service_role;

ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Property access can view rental items" ON public.rental_items FOR SELECT TO authenticated USING (public.user_has_property_access(property_id));
CREATE POLICY "Property access can insert rental items" ON public.rental_items FOR INSERT TO authenticated WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Property access can update rental items" ON public.rental_items FOR UPDATE TO authenticated USING (public.user_has_property_access(property_id)) WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Property access can delete rental items" ON public.rental_items FOR DELETE TO authenticated USING (public.user_has_property_access(property_id));

CREATE TRIGGER rental_items_updated_at BEFORE UPDATE ON public.rental_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RENTAL UNITS (individual assets)
-- =========================================================
CREATE TABLE public.rental_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_item_id UUID NOT NULL REFERENCES public.rental_items(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_label TEXT NOT NULL,
  asset_tag TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','retired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rental_units_item ON public.rental_units(rental_item_id);
CREATE INDEX idx_rental_units_property ON public.rental_units(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_units TO authenticated;
GRANT ALL ON public.rental_units TO service_role;

ALTER TABLE public.rental_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Property access can view rental units" ON public.rental_units FOR SELECT TO authenticated USING (public.user_has_property_access(property_id));
CREATE POLICY "Property access can insert rental units" ON public.rental_units FOR INSERT TO authenticated WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Property access can update rental units" ON public.rental_units FOR UPDATE TO authenticated USING (public.user_has_property_access(property_id)) WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Property access can delete rental units" ON public.rental_units FOR DELETE TO authenticated USING (public.user_has_property_access(property_id));

CREATE TRIGGER rental_units_updated_at BEFORE UPDATE ON public.rental_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill property_id from rental item
CREATE OR REPLACE FUNCTION public.set_rental_unit_property_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id FROM public.rental_items WHERE id = NEW.rental_item_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rental_units_set_property BEFORE INSERT ON public.rental_units FOR EACH ROW EXECUTE FUNCTION public.set_rental_unit_property_id();

-- =========================================================
-- RENTAL RESERVATIONS
-- =========================================================
CREATE TABLE public.rental_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rental_item_id UUID NOT NULL REFERENCES public.rental_items(id) ON DELETE RESTRICT,
  rental_unit_id UUID REFERENCES public.rental_units(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  pricing_mode TEXT NOT NULL DEFAULT 'daily' CHECK (pricing_mode IN ('hourly','daily','stay')),
  rate_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_charged NUMERIC(10,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','add_on','package','messaging_ai')),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','checked_out','returned','cancelled')),
  folio_posting_id UUID REFERENCES public.folio_postings(id) ON DELETE SET NULL,
  notes TEXT,
  checked_out_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX idx_rental_res_property ON public.rental_reservations(property_id);
CREATE INDEX idx_rental_res_item ON public.rental_reservations(rental_item_id);
CREATE INDEX idx_rental_res_reservation ON public.rental_reservations(reservation_id);
CREATE INDEX idx_rental_res_dates ON public.rental_reservations(rental_item_id, start_at, end_at) WHERE status IN ('reserved','checked_out');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_reservations TO authenticated;
GRANT ALL ON public.rental_reservations TO service_role;

ALTER TABLE public.rental_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Property access can view rental reservations" ON public.rental_reservations FOR SELECT TO authenticated USING (public.user_has_property_access(property_id));
CREATE POLICY "Property access can insert rental reservations" ON public.rental_reservations FOR INSERT TO authenticated WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Property access can update rental reservations" ON public.rental_reservations FOR UPDATE TO authenticated USING (public.user_has_property_access(property_id)) WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Property access can delete rental reservations" ON public.rental_reservations FOR DELETE TO authenticated USING (public.user_has_property_access(property_id));

CREATE TRIGGER rental_reservations_updated_at BEFORE UPDATE ON public.rental_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill property_id from rental item
CREATE OR REPLACE FUNCTION public.set_rental_reservation_property_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id FROM public.rental_items WHERE id = NEW.rental_item_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rental_reservations_set_property BEFORE INSERT ON public.rental_reservations FOR EACH ROW EXECUTE FUNCTION public.set_rental_reservation_property_id();

-- =========================================================
-- AVAILABILITY FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_rental_availability(
  _item_id UUID,
  _start TIMESTAMPTZ,
  _end TIMESTAMPTZ,
  _exclude_reservation_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total INTEGER;
  booked INTEGER;
  mode TEXT;
BEGIN
  SELECT total_quantity, tracking_mode INTO total, mode
  FROM public.rental_items WHERE id = _item_id;

  IF mode = 'individual' THEN
    SELECT COUNT(*) INTO total
    FROM public.rental_units
    WHERE rental_item_id = _item_id AND status IN ('available','in_use');
  END IF;

  SELECT COALESCE(SUM(quantity),0) INTO booked
  FROM public.rental_reservations
  WHERE rental_item_id = _item_id
    AND status IN ('reserved','checked_out')
    AND (_exclude_reservation_id IS NULL OR id <> _exclude_reservation_id)
    AND tstzrange(start_at, end_at, '[)') && tstzrange(_start, _end, '[)');

  RETURN GREATEST(total - booked, 0);
END; $$;

-- =========================================================
-- OVERBOOKING GUARD
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_rental_availability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  avail INTEGER;
BEGIN
  IF NEW.status NOT IN ('reserved','checked_out') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.rental_item_id::text));

  avail := public.get_rental_availability(NEW.rental_item_id, NEW.start_at, NEW.end_at, NEW.id);
  IF avail < NEW.quantity THEN
    RAISE EXCEPTION 'Not enough inventory for rental item %; requested %, available %',
      NEW.rental_item_id, NEW.quantity, avail;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rental_reservations_enforce_availability
  BEFORE INSERT OR UPDATE OF quantity, start_at, end_at, status, rental_item_id
  ON public.rental_reservations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rental_availability();

-- =========================================================
-- LINK ADD-ONS & PACKAGE ITEMS TO RENTAL INVENTORY
-- =========================================================
ALTER TABLE public.add_ons ADD COLUMN IF NOT EXISTS rental_item_id UUID REFERENCES public.rental_items(id) ON DELETE SET NULL;
ALTER TABLE public.package_items ADD COLUMN IF NOT EXISTS rental_item_id UUID REFERENCES public.rental_items(id) ON DELETE SET NULL;
