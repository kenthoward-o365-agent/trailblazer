-- Phase 2.1: Fix accounting tables RLS - accounts, account_groups, account_taxes, add_ons

-- Drop existing policies for accounts
DROP POLICY IF EXISTS "Staff can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Staff can manage accounts" ON public.accounts;

-- Create properly scoped policies for accounts
CREATE POLICY "Staff can view property accounts" 
ON public.accounts FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage accounts" 
ON public.accounts FOR ALL TO authenticated
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

-- Drop existing policies for account_groups
DROP POLICY IF EXISTS "Staff can view account groups" ON public.account_groups;
DROP POLICY IF EXISTS "Staff can manage account groups" ON public.account_groups;

-- Create properly scoped policies for account_groups
CREATE POLICY "Staff can view property account groups" 
ON public.account_groups FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage account groups" 
ON public.account_groups FOR ALL TO authenticated
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

-- Drop existing policies for account_taxes
DROP POLICY IF EXISTS "Staff can view account taxes" ON public.account_taxes;
DROP POLICY IF EXISTS "Staff can manage account taxes" ON public.account_taxes;

-- Create properly scoped policies for account_taxes
CREATE POLICY "Staff can view property account taxes" 
ON public.account_taxes FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage account taxes" 
ON public.account_taxes FOR ALL TO authenticated
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

-- Drop existing policies for add_ons
DROP POLICY IF EXISTS "Staff can view add ons" ON public.add_ons;
DROP POLICY IF EXISTS "Staff can manage add ons" ON public.add_ons;

-- Create properly scoped policies for add_ons
CREATE POLICY "Staff can view property add ons" 
ON public.add_ons FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage add ons" 
ON public.add_ons FOR ALL TO authenticated
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