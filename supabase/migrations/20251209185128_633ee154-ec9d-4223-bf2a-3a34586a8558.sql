-- Add columns to track who posted transactions and when (enhanced audit trail)
ALTER TABLE public.ledger_transactions
ADD COLUMN IF NOT EXISTS posted_by_name TEXT,
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS account_code TEXT,
ADD COLUMN IF NOT EXISTS running_balance NUMERIC DEFAULT 0;

-- Add adults/children to reservations
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS adults_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;

-- Create night audit table to track nightly revenue posting
CREATE TABLE public.night_audits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id),
    audit_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    started_by UUID,
    completed_by UUID,
    total_room_revenue NUMERIC DEFAULT 0,
    total_tax_revenue NUMERIC DEFAULT 0,
    total_other_revenue NUMERIC DEFAULT 0,
    total_payments NUMERIC DEFAULT 0,
    folios_processed INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(property_id, audit_date)
);

-- Create night audit settings for auto-run option
CREATE TABLE public.night_audit_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) UNIQUE,
    auto_run_enabled BOOLEAN DEFAULT false,
    auto_run_time TIME DEFAULT '02:00:00',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dayend close table to track daily closing process
CREATE TABLE public.dayend_closes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id),
    close_date DATE NOT NULL,
    night_audit_id UUID REFERENCES public.night_audits(id),
    status TEXT NOT NULL DEFAULT 'open', -- open, closed
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID,
    closed_by_name TEXT,
    -- Summary data
    total_revenue NUMERIC DEFAULT 0,
    total_taxes NUMERIC DEFAULT 0,
    total_payments NUMERIC DEFAULT 0,
    total_refunds NUMERIC DEFAULT 0,
    opening_ar_balance NUMERIC DEFAULT 0,
    closing_ar_balance NUMERIC DEFAULT 0,
    -- Report snapshot stored as JSON
    account_summary JSONB,
    ledger_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(property_id, close_date)
);

-- Create folio item postings table for detailed tracking per revenue account
CREATE TABLE public.folio_postings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ledger_transaction_id UUID REFERENCES public.ledger_transactions(id),
    ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
    account_id UUID REFERENCES public.accounts(id), -- Chart of accounts reference
    night_audit_id UUID REFERENCES public.night_audits(id),
    posting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    posting_type TEXT NOT NULL, -- revenue, tax, payment, adjustment, transfer
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    running_balance NUMERIC NOT NULL DEFAULT 0,
    posted_by UUID,
    posted_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.night_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.night_audit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dayend_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folio_postings ENABLE ROW LEVEL SECURITY;

-- RLS policies for night_audits
CREATE POLICY "Staff can view night audits"
ON public.night_audits FOR SELECT
USING (true);

CREATE POLICY "Staff can manage night audits"
ON public.night_audits FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

-- RLS policies for night_audit_settings
CREATE POLICY "Staff can view night audit settings"
ON public.night_audit_settings FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage settings"
ON public.night_audit_settings FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for dayend_closes
CREATE POLICY "Staff can view dayend closes"
ON public.dayend_closes FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage dayend closes"
ON public.dayend_closes FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for folio_postings
CREATE POLICY "Staff can view folio postings"
ON public.folio_postings FOR SELECT
USING (true);

CREATE POLICY "Staff can create folio postings"
ON public.folio_postings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'front_desk'));

-- Add triggers for updated_at
CREATE TRIGGER update_night_audits_updated_at
BEFORE UPDATE ON public.night_audits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_night_audit_settings_updated_at
BEFORE UPDATE ON public.night_audit_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dayend_closes_updated_at
BEFORE UPDATE ON public.dayend_closes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();