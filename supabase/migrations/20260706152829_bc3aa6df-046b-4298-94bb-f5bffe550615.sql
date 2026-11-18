
-- POS Module Schema

-- Outlets
CREATE TABLE public.pos_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  default_revenue_ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  cash_ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  clearing_ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_outlets TO authenticated;
GRANT ALL ON public.pos_outlets TO service_role;
ALTER TABLE public.pos_outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outlets property access" ON public.pos_outlets FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE TRIGGER pos_outlets_updated BEFORE UPDATE ON public.pos_outlets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Categories
CREATE TABLE public.pos_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  revenue_ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  tax_profile_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_categories TO authenticated;
GRANT ALL ON public.pos_categories TO service_role;
ALTER TABLE public.pos_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories property access" ON public.pos_categories FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE TRIGGER pos_categories_updated BEFORE UPDATE ON public.pos_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Items
CREATE TABLE public.pos_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.pos_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  description text,
  image_url text,
  track_inventory boolean NOT NULL DEFAULT true,
  has_variants boolean NOT NULL DEFAULT false,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_items TO authenticated;
GRANT ALL ON public.pos_items TO service_role;
ALTER TABLE public.pos_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items property access" ON public.pos_items FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE TRIGGER pos_items_updated BEFORE UPDATE ON public.pos_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX pos_items_property_active_idx ON public.pos_items(property_id, is_active);

-- Variants
CREATE TABLE public.pos_item_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.pos_items(id) ON DELETE CASCADE,
  size text,
  color text,
  sku text,
  barcode text,
  price_override numeric(10,2),
  stock_qty numeric(12,2) NOT NULL DEFAULT 0,
  reorder_point numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_item_variants TO authenticated;
GRANT ALL ON public.pos_item_variants TO service_role;
ALTER TABLE public.pos_item_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants property access" ON public.pos_item_variants FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE UNIQUE INDEX pos_variants_barcode_unique ON public.pos_item_variants(property_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX pos_variants_item_idx ON public.pos_item_variants(item_id);
CREATE TRIGGER pos_variants_updated BEFORE UPDATE ON public.pos_item_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inventory movements
CREATE TABLE public.pos_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.pos_item_variants(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  change_qty numeric(12,2) NOT NULL,
  reason text NOT NULL,
  reference_id uuid,
  notes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_inventory_movements TO authenticated;
GRANT ALL ON public.pos_inventory_movements TO service_role;
ALTER TABLE public.pos_inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements property access" ON public.pos_inventory_movements FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

-- Orders
CREATE TABLE public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets(id),
  order_number text,
  status text NOT NULL DEFAULT 'open',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  tender_type text,
  amount_tendered numeric(10,2),
  change_due numeric(10,2),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  folio_posting_id uuid REFERENCES public.folio_postings(id) ON DELETE SET NULL,
  payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  cashier_user_id uuid,
  cashier_name text,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_orders TO authenticated;
GRANT ALL ON public.pos_orders TO service_role;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders property access" ON public.pos_orders FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE INDEX pos_orders_property_status_idx ON public.pos_orders(property_id, status, opened_at DESC);
CREATE TRIGGER pos_orders_updated BEFORE UPDATE ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order lines
CREATE TABLE public.pos_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.pos_item_variants(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  variant_label text,
  qty numeric(12,2) NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  line_total numeric(10,2) NOT NULL,
  revenue_ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_order_items TO authenticated;
GRANT ALL ON public.pos_order_items TO service_role;
ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items property access" ON public.pos_order_items FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE INDEX pos_order_items_order_idx ON public.pos_order_items(order_id);

-- Order number sequence per property
CREATE TABLE public.pos_order_sequences (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_order_sequences TO authenticated;
GRANT ALL ON public.pos_order_sequences TO service_role;
ALTER TABLE public.pos_order_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order sequences property access" ON public.pos_order_sequences FOR ALL TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE OR REPLACE FUNCTION public.generate_pos_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pos_order_sequences (property_id, last_number)
  VALUES (NEW.property_id, 0)
  ON CONFLICT (property_id) DO NOTHING;
  UPDATE public.pos_order_sequences
     SET last_number = last_number + 1
   WHERE property_id = NEW.property_id
  RETURNING last_number INTO next_num;
  NEW.order_number := 'POS-' || LPAD(next_num::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_orders_order_number
  BEFORE INSERT ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_pos_order_number();
