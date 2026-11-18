-- Create rates table for managing rate codes and date ranges
CREATE TABLE public.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  rate_code text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_base_rate boolean DEFAULT false,
  base_rate_id uuid REFERENCES rates(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, rate_code)
);

-- Create rate_site_type_prices table for pricing per site type
CREATE TABLE public.rate_site_type_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id uuid NOT NULL REFERENCES rates(id) ON DELETE CASCADE,
  site_type_id uuid NOT NULL REFERENCES site_types(id),
  price numeric NOT NULL,
  adjustment_type text DEFAULT 'base',
  adjustment_value numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rate_id, site_type_id)
);

-- Create rate_seasons table for seasonal adjustments
CREATE TABLE public.rate_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id uuid NOT NULL REFERENCES rates(id) ON DELETE CASCADE,
  season_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_site_type_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_seasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rates
CREATE POLICY "Staff can view rates"
  ON public.rates FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage rates"
  ON public.rates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for rate_site_type_prices
CREATE POLICY "Staff can view rate prices"
  ON public.rate_site_type_prices FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage rate prices"
  ON public.rate_site_type_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for rate_seasons
CREATE POLICY "Staff can view rate seasons"
  ON public.rate_seasons FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage rate seasons"
  ON public.rate_seasons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_rates_updated_at
  BEFORE UPDATE ON public.rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rate_seasons_updated_at
  BEFORE UPDATE ON public.rate_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();