-- Phase 2.6d: Fix remaining tables RLS - guarantee_options, rates, city_ledger, ota_connections

-- Drop existing policies for guarantee_options
DROP POLICY IF EXISTS "Staff can view guarantee options" ON public.guarantee_options;
DROP POLICY IF EXISTS "Admins and managers can manage guarantee options" ON public.guarantee_options;

-- Create properly scoped policies for guarantee_options
CREATE POLICY "Staff can view property guarantee options" 
ON public.guarantee_options FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property guarantee options" 
ON public.guarantee_options FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for rates
DROP POLICY IF EXISTS "Staff can view rates" ON public.rates;
DROP POLICY IF EXISTS "Staff can manage rates" ON public.rates;

-- Create properly scoped policies for rates
CREATE POLICY "Staff can view property rates" 
ON public.rates FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property rates" 
ON public.rates FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for city_ledger_invoices
DROP POLICY IF EXISTS "Staff can view city ledger invoices" ON public.city_ledger_invoices;
DROP POLICY IF EXISTS "Staff can create city ledger invoices" ON public.city_ledger_invoices;
DROP POLICY IF EXISTS "Staff can update city ledger invoices" ON public.city_ledger_invoices;

-- Create properly scoped policies for city_ledger_invoices
CREATE POLICY "Staff can view property city ledger invoices" 
ON public.city_ledger_invoices FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property city ledger invoices" 
ON public.city_ledger_invoices FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Staff can update property city ledger invoices" 
ON public.city_ledger_invoices FOR UPDATE TO authenticated
USING (user_has_property_access(property_id));

-- Drop existing policies for city_ledger_invoice_payments
DROP POLICY IF EXISTS "Staff can view invoice payments" ON public.city_ledger_invoice_payments;
DROP POLICY IF EXISTS "Staff can create invoice payments" ON public.city_ledger_invoice_payments;

-- Create properly scoped policies for city_ledger_invoice_payments (via city_ledger_invoices)
CREATE POLICY "Staff can view property invoice payments" 
ON public.city_ledger_invoice_payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.city_ledger_invoices cli
    WHERE cli.id = city_ledger_invoice_payments.invoice_id
    AND user_has_property_access(cli.property_id)
  )
);

CREATE POLICY "Staff can create property invoice payments" 
ON public.city_ledger_invoice_payments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.city_ledger_invoices cli
    WHERE cli.id = city_ledger_invoice_payments.invoice_id
    AND user_has_property_access(cli.property_id)
  )
);

-- Drop existing policies for ota_connections
DROP POLICY IF EXISTS "Staff can view OTA connections" ON public.ota_connections;
DROP POLICY IF EXISTS "Admins can manage OTA connections" ON public.ota_connections;

-- Create properly scoped policies for ota_connections
CREATE POLICY "Staff can view property OTA connections" 
ON public.ota_connections FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Admins can manage property OTA connections" 
ON public.ota_connections FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_has_property_access(property_id) AND has_role(auth.uid(), 'admin')
);