-- Create group_blocks table
CREATE TABLE public.group_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL,
  description text,
  -- Address fields
  street_address text,
  city text,
  state text,
  zipcode text,
  country text DEFAULT 'US',
  -- Contact fields
  contact_first_name text,
  contact_last_name text,
  contact_email text,
  contact_phone text,
  -- Date range
  start_date date NOT NULL,
  end_date date NOT NULL,
  -- Settings
  allow_other_room_types boolean DEFAULT false,
  allow_overbooking boolean DEFAULT false,
  -- Master account
  has_master_account boolean DEFAULT false,
  master_contact_name text,
  master_contact_email text,
  master_contact_phone text,
  charge_routing text DEFAULT 'all_charges',
  master_ledger_account_id uuid REFERENCES public.ledger_accounts(id),
  -- Status
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, code)
);

-- Create group_block_room_allocations table (per-night flexibility)
CREATE TABLE public.group_block_room_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_block_id uuid NOT NULL REFERENCES public.group_blocks(id) ON DELETE CASCADE,
  allocation_date date NOT NULL,
  site_type_id uuid REFERENCES public.site_types(id),
  site_id uuid REFERENCES public.sites(id),
  rooms_blocked integer NOT NULL DEFAULT 1,
  rate_id uuid REFERENCES public.rates(id),
  override_rate numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT allocation_type CHECK (
    (site_type_id IS NOT NULL AND site_id IS NULL) OR
    (site_type_id IS NULL AND site_id IS NOT NULL)
  )
);

-- Create group_block_payment_cards table
CREATE TABLE public.group_block_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_block_id uuid NOT NULL REFERENCES public.group_blocks(id) ON DELETE CASCADE,
  payment_card_id uuid NOT NULL REFERENCES public.payment_cards(id),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add group_block_id to reservations
ALTER TABLE public.reservations ADD COLUMN group_block_id uuid REFERENCES public.group_blocks(id);

-- Enable RLS
ALTER TABLE public.group_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_block_room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_block_payment_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_blocks
CREATE POLICY "Staff can view group blocks"
ON public.group_blocks FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Staff can create group blocks"
ON public.group_blocks FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

CREATE POLICY "Staff can update group blocks"
ON public.group_blocks FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

CREATE POLICY "Staff can delete group blocks"
ON public.group_blocks FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- RLS Policies for group_block_room_allocations
CREATE POLICY "Staff can view group block allocations"
ON public.group_block_room_allocations FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Staff can manage group block allocations"
ON public.group_block_room_allocations FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- RLS Policies for group_block_payment_cards
CREATE POLICY "Staff can view group block payment cards"
ON public.group_block_payment_cards FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Staff can manage group block payment cards"
ON public.group_block_payment_cards FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- Create updated_at trigger for group_blocks
CREATE TRIGGER update_group_blocks_updated_at
BEFORE UPDATE ON public.group_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();