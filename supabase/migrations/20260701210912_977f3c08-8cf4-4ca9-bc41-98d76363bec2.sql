
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'per_site',
  ADD COLUMN IF NOT EXISTS flat_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_pricing_model_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_pricing_model_check
  CHECK (pricing_model IN ('per_site','flat'));
