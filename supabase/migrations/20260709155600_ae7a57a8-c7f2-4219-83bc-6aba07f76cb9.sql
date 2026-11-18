
-- =========================================================
-- Phase G: Denormalize property_id for RLS performance
-- =========================================================

-- ---------- reservation_guests ----------
ALTER TABLE public.reservation_guests
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE;

UPDATE public.reservation_guests rg
   SET property_id = r.property_id
  FROM public.reservations r
 WHERE r.id = rg.reservation_id
   AND rg.property_id IS NULL;

ALTER TABLE public.reservation_guests
  ALTER COLUMN property_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_guests_property
  ON public.reservation_guests(property_id);

CREATE OR REPLACE FUNCTION public.set_reservation_guest_property_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id
      FROM public.reservations WHERE id = NEW.reservation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_guests_set_property_id ON public.reservation_guests;
CREATE TRIGGER trg_reservation_guests_set_property_id
  BEFORE INSERT ON public.reservation_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_reservation_guest_property_id();

DROP POLICY IF EXISTS "Staff can view reservation guests" ON public.reservation_guests;
DROP POLICY IF EXISTS "Staff can insert reservation guests" ON public.reservation_guests;
DROP POLICY IF EXISTS "Staff can update reservation guests" ON public.reservation_guests;
DROP POLICY IF EXISTS "Staff can delete reservation guests" ON public.reservation_guests;

CREATE POLICY "Staff can view reservation guests" ON public.reservation_guests
  FOR SELECT USING (public.user_has_property_access(property_id));
CREATE POLICY "Staff can insert reservation guests" ON public.reservation_guests
  FOR INSERT WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "Staff can update reservation guests" ON public.reservation_guests
  FOR UPDATE USING (public.user_has_property_access(property_id));
CREATE POLICY "Staff can delete reservation guests" ON public.reservation_guests
  FOR DELETE USING (public.user_has_property_access(property_id));

-- ---------- reservation_add_ons ----------
ALTER TABLE public.reservation_add_ons
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE;

UPDATE public.reservation_add_ons ra
   SET property_id = r.property_id
  FROM public.reservations r
 WHERE r.id = ra.reservation_id
   AND ra.property_id IS NULL;

ALTER TABLE public.reservation_add_ons
  ALTER COLUMN property_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_add_ons_property
  ON public.reservation_add_ons(property_id);

CREATE OR REPLACE FUNCTION public.set_reservation_add_on_property_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id
      FROM public.reservations WHERE id = NEW.reservation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_add_ons_set_property_id ON public.reservation_add_ons;
CREATE TRIGGER trg_reservation_add_ons_set_property_id
  BEFORE INSERT ON public.reservation_add_ons
  FOR EACH ROW EXECUTE FUNCTION public.set_reservation_add_on_property_id();

DROP POLICY IF EXISTS "Authenticated users can view reservation add-ons" ON public.reservation_add_ons;
DROP POLICY IF EXISTS "Authenticated users can add reservation add-ons" ON public.reservation_add_ons;

CREATE POLICY "Authenticated users can view reservation add-ons" ON public.reservation_add_ons
  FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));
CREATE POLICY "Authenticated users can add reservation add-ons" ON public.reservation_add_ons
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id));

-- ---------- rate_site_type_prices ----------
ALTER TABLE public.rate_site_type_prices
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE;

UPDATE public.rate_site_type_prices rsp
   SET property_id = r.property_id
  FROM public.rates r
 WHERE r.id = rsp.rate_id
   AND rsp.property_id IS NULL;

ALTER TABLE public.rate_site_type_prices
  ALTER COLUMN property_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_site_type_prices_property
  ON public.rate_site_type_prices(property_id);

CREATE OR REPLACE FUNCTION public.set_rate_site_type_price_property_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id
      FROM public.rates WHERE id = NEW.rate_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_site_type_prices_set_property_id ON public.rate_site_type_prices;
CREATE TRIGGER trg_rate_site_type_prices_set_property_id
  BEFORE INSERT ON public.rate_site_type_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_rate_site_type_price_property_id();

DROP POLICY IF EXISTS "Staff can view rate prices" ON public.rate_site_type_prices;
DROP POLICY IF EXISTS "Staff can manage rate prices scoped" ON public.rate_site_type_prices;

CREATE POLICY "Staff can view rate prices" ON public.rate_site_type_prices
  FOR SELECT
  USING (public.user_has_property_access(property_id));

CREATE POLICY "Staff can manage rate prices scoped" ON public.rate_site_type_prices
  FOR ALL TO authenticated
  USING (
    public.user_has_property_access(property_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    public.user_has_property_access(property_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );
