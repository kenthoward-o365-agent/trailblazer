
-- Enums
CREATE TYPE public.wo_status AS ENUM ('open', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.wo_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.wo_category AS ENUM ('plumbing', 'electrical', 'grounds', 'structural', 'site_specific', 'other');
CREATE TYPE public.wo_cost_type AS ENUM ('parts', 'labor', 'external_vendor', 'other');

-- Per-property WO number sequence
CREATE TABLE public.property_work_order_sequences (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE ON public.property_work_order_sequences TO authenticated;
GRANT ALL ON public.property_work_order_sequences TO service_role;
ALTER TABLE public.property_work_order_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sequence access via property"
  ON public.property_work_order_sequences
  FOR ALL
  TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

-- work_orders
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  wo_number text,
  title text NOT NULL,
  description text,
  category public.wo_category NOT NULL DEFAULT 'other',
  priority public.wo_priority NOT NULL DEFAULT 'normal',
  status public.wo_status NOT NULL DEFAULT 'open',
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  location_text text,
  reported_by_user_id uuid NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  assigned_to_user_id uuid,
  assigned_at timestamptz,
  due_date date,
  completed_at timestamptz,
  resolution_notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_orders_property ON public.work_orders(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_status ON public.work_orders(property_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_site ON public.work_orders(site_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_assignee ON public.work_orders(assigned_to_user_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WO select via property access"
  ON public.work_orders FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));
CREATE POLICY "WO insert via property access"
  ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id) AND reported_by_user_id = auth.uid());
CREATE POLICY "WO update via property access"
  ON public.work_orders FOR UPDATE TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "WO delete admin only"
  ON public.work_orders FOR DELETE TO authenticated
  USING (public.user_has_property_access(property_id) AND (public.is_super_admin() OR public.has_role(auth.uid(), 'admin')));

-- work_order_cost_items
CREATE TABLE public.work_order_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  cost_type public.wo_cost_type NOT NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  vendor_name text,
  incurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_cost_wo ON public.work_order_cost_items(work_order_id);
CREATE INDEX idx_wo_cost_property ON public.work_order_cost_items(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_cost_items TO authenticated;
GRANT ALL ON public.work_order_cost_items TO service_role;
ALTER TABLE public.work_order_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WO cost select"
  ON public.work_order_cost_items FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));
CREATE POLICY "WO cost insert"
  ON public.work_order_cost_items FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id) AND created_by_user_id = auth.uid());
CREATE POLICY "WO cost update"
  ON public.work_order_cost_items FOR UPDATE TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));
CREATE POLICY "WO cost delete"
  ON public.work_order_cost_items FOR DELETE TO authenticated
  USING (public.user_has_property_access(property_id));

-- work_order_attachments
CREATE TABLE public.work_order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  uploaded_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_att_wo ON public.work_order_attachments(work_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_attachments TO authenticated;
GRANT ALL ON public.work_order_attachments TO service_role;
ALTER TABLE public.work_order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WO attach select"
  ON public.work_order_attachments FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));
CREATE POLICY "WO attach insert"
  ON public.work_order_attachments FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id) AND uploaded_by_user_id = auth.uid());
CREATE POLICY "WO attach delete"
  ON public.work_order_attachments FOR DELETE TO authenticated
  USING (public.user_has_property_access(property_id));

-- work_order_comments
CREATE TABLE public.work_order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_com_wo ON public.work_order_comments(work_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_comments TO authenticated;
GRANT ALL ON public.work_order_comments TO service_role;
ALTER TABLE public.work_order_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WO com select"
  ON public.work_order_comments FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));
CREATE POLICY "WO com insert"
  ON public.work_order_comments FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id) AND user_id = auth.uid());
CREATE POLICY "WO com delete"
  ON public.work_order_comments FOR DELETE TO authenticated
  USING (public.user_has_property_access(property_id) AND (user_id = auth.uid() OR public.is_super_admin() OR public.has_role(auth.uid(), 'admin')));

-- Trigger: auto WO number
CREATE OR REPLACE FUNCTION public.generate_work_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.wo_number IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO public.property_work_order_sequences (property_id, last_number)
    VALUES (NEW.property_id, 0)
    ON CONFLICT (property_id) DO NOTHING;
  UPDATE public.property_work_order_sequences
     SET last_number = last_number + 1
   WHERE property_id = NEW.property_id
  RETURNING last_number INTO next_num;
  NEW.wo_number := 'WO-' || LPAD(next_num::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_orders_number
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_work_order_number();

-- Trigger: updated_at and auto-set completed_at + status log
CREATE OR REPLACE FUNCTION public.work_orders_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id AND NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_at IS NULL THEN
    NEW.assigned_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_orders_before_update
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.work_orders_before_update();

-- Trigger: auto property_id on cost items / attachments / comments
CREATE OR REPLACE FUNCTION public.set_wo_child_property_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id FROM public.work_orders WHERE id = NEW.work_order_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wo_cost_property BEFORE INSERT ON public.work_order_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.set_wo_child_property_id();
CREATE TRIGGER trg_wo_attach_property BEFORE INSERT ON public.work_order_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_wo_child_property_id();
CREATE TRIGGER trg_wo_com_property BEFORE INSERT ON public.work_order_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_wo_child_property_id();
