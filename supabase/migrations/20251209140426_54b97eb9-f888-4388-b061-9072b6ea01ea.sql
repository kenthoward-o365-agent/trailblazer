-- Add revenue_account_id to rates table to link rates to revenue accounts
ALTER TABLE public.rates 
ADD COLUMN revenue_account_id uuid REFERENCES public.accounts(id);

-- Create an index for better query performance
CREATE INDEX idx_rates_revenue_account_id ON public.rates(revenue_account_id);