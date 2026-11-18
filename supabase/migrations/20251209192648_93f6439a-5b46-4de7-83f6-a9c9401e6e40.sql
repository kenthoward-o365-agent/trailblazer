-- Create payment cards table for storing masked card data
CREATE TABLE public.payment_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  ledger_account_id UUID REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  cardholder_name TEXT NOT NULL,
  card_brand TEXT NOT NULL, -- Visa, Mastercard, Amex, Discover
  last_four_digits TEXT NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_by_name TEXT,
  CONSTRAINT chk_last_four CHECK (LENGTH(last_four_digits) = 4),
  CONSTRAINT chk_expiry_month CHECK (expiry_month >= 1 AND expiry_month <= 12),
  CONSTRAINT chk_expiry_year CHECK (expiry_year >= 2024)
);

-- Enable RLS
ALTER TABLE public.payment_cards ENABLE ROW LEVEL SECURITY;

-- Staff can view payment cards
CREATE POLICY "Staff can view payment cards"
ON public.payment_cards
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- Staff can create payment cards
CREATE POLICY "Staff can create payment cards"
ON public.payment_cards
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- Staff can update payment cards
CREATE POLICY "Staff can update payment cards"
ON public.payment_cards
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'front_desk'::app_role)
);

-- Admins and managers can delete payment cards
CREATE POLICY "Admins and managers can delete payment cards"
ON public.payment_cards
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_payment_cards_updated_at
  BEFORE UPDATE ON public.payment_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for lookups
CREATE INDEX idx_payment_cards_reservation ON public.payment_cards(reservation_id);
CREATE INDEX idx_payment_cards_ledger_account ON public.payment_cards(ledger_account_id);