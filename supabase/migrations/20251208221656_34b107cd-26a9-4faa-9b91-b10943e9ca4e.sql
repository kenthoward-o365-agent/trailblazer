-- Enum for account types
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- Enum for ledger types
CREATE TYPE public.ledger_type AS ENUM ('advance_deposit', 'guest', 'city');

-- Enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('payment', 'charge', 'transfer', 'refund', 'adjustment');

-- Account Groups (e.g., Current Assets, Revenue, etc.)
CREATE TABLE public.account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type account_type NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chart of Accounts (Account Codes)
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  account_group_id uuid NOT NULL REFERENCES public.account_groups(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  normal_balance text NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, code)
);

-- Journal Entries (header)
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text,
  description text NOT NULL,
  is_posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Journal Entry Lines (debits and credits)
CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit_amount numeric(12,2) DEFAULT 0,
  credit_amount numeric(12,2) DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (debit_amount >= 0 AND credit_amount >= 0),
  CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0) OR (debit_amount = 0 AND credit_amount = 0))
);

-- Ledger Accounts (Advance Deposit, Guest, City)
CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  ledger_type ledger_type NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  company_name text, -- For city ledger direct billing
  contact_name text,
  contact_email text,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ledger Transactions
CREATE TABLE public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  transaction_type transaction_type NOT NULL,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  debit_amount numeric(12,2) DEFAULT 0,
  credit_amount numeric(12,2) DEFAULT 0,
  reference_number text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (debit_amount >= 0 AND credit_amount >= 0)
);

-- Enable RLS on all tables
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_groups
CREATE POLICY "Staff can view account groups" ON public.account_groups
  FOR SELECT USING (true);

CREATE POLICY "Admins and managers can manage account groups" ON public.account_groups
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for accounts
CREATE POLICY "Staff can view accounts" ON public.accounts
  FOR SELECT USING (true);

CREATE POLICY "Admins and managers can manage accounts" ON public.accounts
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for journal_entries
CREATE POLICY "Staff can view journal entries" ON public.journal_entries
  FOR SELECT USING (true);

CREATE POLICY "Staff can create journal entries" ON public.journal_entries
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

CREATE POLICY "Admins and managers can update journal entries" ON public.journal_entries
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for journal_entry_lines
CREATE POLICY "Staff can view journal entry lines" ON public.journal_entry_lines
  FOR SELECT USING (true);

CREATE POLICY "Staff can create journal entry lines" ON public.journal_entry_lines
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

CREATE POLICY "Admins and managers can manage journal entry lines" ON public.journal_entry_lines
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for ledger_accounts
CREATE POLICY "Staff can view ledger accounts" ON public.ledger_accounts
  FOR SELECT USING (true);

CREATE POLICY "Staff can create ledger accounts" ON public.ledger_accounts
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

CREATE POLICY "Staff can update ledger accounts" ON public.ledger_accounts
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

-- RLS Policies for ledger_transactions
CREATE POLICY "Staff can view ledger transactions" ON public.ledger_transactions
  FOR SELECT USING (true);

CREATE POLICY "Staff can create ledger transactions" ON public.ledger_transactions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

CREATE POLICY "Admins and managers can manage ledger transactions" ON public.ledger_transactions
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Indexes for performance
CREATE INDEX idx_accounts_group ON public.accounts(account_group_id);
CREATE INDEX idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_entry_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX idx_ledger_accounts_type ON public.ledger_accounts(ledger_type);
CREATE INDEX idx_ledger_accounts_reservation ON public.ledger_accounts(reservation_id);
CREATE INDEX idx_ledger_transactions_account ON public.ledger_transactions(ledger_account_id);
CREATE INDEX idx_ledger_transactions_date ON public.ledger_transactions(transaction_date);

-- Function to update ledger balance
CREATE OR REPLACE FUNCTION public.update_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ledger_accounts
  SET balance = balance + NEW.debit_amount - NEW.credit_amount,
      updated_at = now()
  WHERE id = NEW.ledger_account_id;
  RETURN NEW;
END;
$$;

-- Trigger to auto-update ledger balance on transaction
CREATE TRIGGER update_ledger_balance_trigger
  AFTER INSERT ON public.ledger_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ledger_balance();