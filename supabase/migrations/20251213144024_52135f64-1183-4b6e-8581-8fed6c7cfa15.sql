-- Add payment gateway configuration to properties (per-property)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS payment_gateway_mode TEXT DEFAULT 'mock' 
  CHECK (payment_gateway_mode IN ('mock', 'test', 'live'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS adyen_merchant_account TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS adyen_client_key TEXT;

-- Extend payment_cards table for tokenization + multi-card support
ALTER TABLE payment_cards 
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id),
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id),
  ADD COLUMN IF NOT EXISTS card_sequence INTEGER DEFAULT 1 CHECK (card_sequence BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS adyen_shopper_reference TEXT,
  ADD COLUMN IF NOT EXISTS adyen_recurring_reference TEXT,
  ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'active' CHECK (token_status IN ('active', 'expired', 'failed')),
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT false;

-- Add unique constraint for card sequence per reservation (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_card_sequence_per_reservation'
  ) THEN
    ALTER TABLE payment_cards ADD CONSTRAINT unique_card_sequence_per_reservation 
      UNIQUE (reservation_id, card_sequence);
  END IF;
END $$;

-- Create payment_authorizations table for tracking pre-auths
CREATE TABLE IF NOT EXISTS payment_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) NOT NULL,
  ledger_account_id UUID REFERENCES ledger_accounts(id) NOT NULL,
  payment_card_id UUID REFERENCES payment_cards(id) NOT NULL,
  original_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) NOT NULL,
  captured_amount DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_captured', 'fully_captured', 'cancelled', 'expired')),
  adyen_psp_reference TEXT,
  adyen_auth_code TEXT,
  expires_at TIMESTAMPTZ,
  is_mock BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_by_name TEXT
);

-- Create payment_transactions table for complete audit trail
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) NOT NULL,
  reservation_id UUID REFERENCES reservations(id),
  ledger_account_id UUID REFERENCES ledger_accounts(id),
  payment_card_id UUID REFERENCES payment_cards(id),
  authorization_id UUID REFERENCES payment_authorizations(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'tokenization', 'authorization', 'incremental_auth', 
    'capture', 'partial_capture', 'sale', 'refund', 'void'
  )),
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  adyen_psp_reference TEXT,
  gateway_response JSONB,
  source TEXT NOT NULL DEFAULT 'pms' CHECK (source IN ('pms', 'booking_engine', 'ota')),
  is_mock BOOLEAN DEFAULT false,
  folio_posting_id UUID REFERENCES folio_postings(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_by_name TEXT
);

-- Enable RLS on new tables
ALTER TABLE payment_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_authorizations
CREATE POLICY "Staff can view payment authorizations" ON payment_authorizations
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can create payment authorizations" ON payment_authorizations
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can update payment authorizations" ON payment_authorizations
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

-- RLS policies for payment_transactions
CREATE POLICY "Staff can view payment transactions" ON payment_transactions
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

CREATE POLICY "Staff can create payment transactions" ON payment_transactions
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );

-- Create trigger to update updated_at on payment_authorizations
CREATE TRIGGER update_payment_authorizations_updated_at
  BEFORE UPDATE ON payment_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();