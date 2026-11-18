-- Add debit_amount and credit_amount columns to folio_postings
ALTER TABLE public.folio_postings
ADD COLUMN debit_amount numeric DEFAULT 0,
ADD COLUMN credit_amount numeric DEFAULT 0;

-- Migrate existing data: positive amounts are debits (charges), negative are credits (payments)
UPDATE public.folio_postings 
SET 
  debit_amount = CASE WHEN amount > 0 THEN amount ELSE 0 END,
  credit_amount = CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END;

-- Add comment for clarity
COMMENT ON COLUMN public.folio_postings.debit_amount IS 'Charges increase the guest balance (room charges, taxes, etc.)';
COMMENT ON COLUMN public.folio_postings.credit_amount IS 'Credits decrease the guest balance (payments, refunds, etc.)';