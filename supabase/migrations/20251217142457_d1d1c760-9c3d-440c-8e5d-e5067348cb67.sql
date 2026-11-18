-- Create city_ledger_invoices table for tracking transferred guest folios
CREATE TABLE public.city_ledger_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  source_folio_id UUID REFERENCES public.ledger_accounts(id),
  reservation_id UUID REFERENCES public.reservations(id),
  confirmation_number TEXT,
  guest_name TEXT,
  room_number TEXT,
  checkout_date DATE,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  original_amount NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid')),
  notes TEXT,
  property_id UUID NOT NULL REFERENCES public.properties(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create city_ledger_invoice_payments junction table
CREATE TABLE public.city_ledger_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.city_ledger_invoices(id) ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL REFERENCES public.ledger_transactions(id),
  applied_amount NUMERIC NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now(),
  applied_by_name TEXT
);

-- Create statement_sends table for tracking sent statements
CREATE TABLE public.statement_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  sent_to_email TEXT NOT NULL,
  statement_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by_name TEXT,
  is_mock BOOLEAN DEFAULT false,
  property_id UUID NOT NULL REFERENCES public.properties(id)
);

-- Extend ledger_accounts for enhanced city ledger
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS street_address_2 TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS zipcode TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Add city ledger linking to reservations
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS city_ledger_account_id UUID REFERENCES public.ledger_accounts(id);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS billing_instructions TEXT;

-- Add city ledger linking to group_blocks
ALTER TABLE public.group_blocks ADD COLUMN IF NOT EXISTS city_ledger_account_id UUID REFERENCES public.ledger_accounts(id);

-- Enable RLS on new tables
ALTER TABLE public.city_ledger_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_ledger_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_sends ENABLE ROW LEVEL SECURITY;

-- RLS policies for city_ledger_invoices
CREATE POLICY "Staff can view city ledger invoices" ON public.city_ledger_invoices
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can create city ledger invoices" ON public.city_ledger_invoices
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can update city ledger invoices" ON public.city_ledger_invoices
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

-- RLS policies for city_ledger_invoice_payments
CREATE POLICY "Staff can view invoice payments" ON public.city_ledger_invoice_payments
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can create invoice payments" ON public.city_ledger_invoice_payments
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

-- RLS policies for statement_sends
CREATE POLICY "Staff can view statement sends" ON public.statement_sends
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can create statement sends" ON public.statement_sends
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

-- Create trigger for updated_at on city_ledger_invoices
CREATE TRIGGER update_city_ledger_invoices_updated_at
  BEFORE UPDATE ON public.city_ledger_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_city_ledger_invoices_account ON public.city_ledger_invoices(city_ledger_account_id);
CREATE INDEX idx_city_ledger_invoices_property ON public.city_ledger_invoices(property_id);
CREATE INDEX idx_city_ledger_invoices_status ON public.city_ledger_invoices(status);
CREATE INDEX idx_city_ledger_invoice_payments_invoice ON public.city_ledger_invoice_payments(invoice_id);