-- Phase 2.6c: Fix night audit, dayend, journal, and other tables RLS

-- Drop existing policies for custom_roles
DROP POLICY IF EXISTS "Staff can view custom roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Admins can manage custom roles" ON public.custom_roles;

-- Create properly scoped policies for custom_roles
CREATE POLICY "Staff can view property custom roles" 
ON public.custom_roles FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Admins can manage property custom roles" 
ON public.custom_roles FOR ALL TO authenticated
USING (
  user_has_property_access(property_id) AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_has_property_access(property_id) AND has_role(auth.uid(), 'admin')
);

-- Drop existing policies for night_audits
DROP POLICY IF EXISTS "Staff can view night audits" ON public.night_audits;
DROP POLICY IF EXISTS "Staff can manage night audits" ON public.night_audits;

-- Create properly scoped policies for night_audits
CREATE POLICY "Staff can view property night audits" 
ON public.night_audits FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can manage property night audits" 
ON public.night_audits FOR ALL TO authenticated
USING (user_has_property_access(property_id))
WITH CHECK (user_has_property_access(property_id));

-- Drop existing policies for night_audit_settings
DROP POLICY IF EXISTS "Staff can view night audit settings" ON public.night_audit_settings;
DROP POLICY IF EXISTS "Admins and managers can manage settings" ON public.night_audit_settings;

-- Create properly scoped policies for night_audit_settings
CREATE POLICY "Staff can view property night audit settings" 
ON public.night_audit_settings FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property night audit settings" 
ON public.night_audit_settings FOR ALL TO authenticated
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

-- Drop existing policies for dayend_closes
DROP POLICY IF EXISTS "Staff can view dayend closes" ON public.dayend_closes;
DROP POLICY IF EXISTS "Admins and managers can manage dayend closes" ON public.dayend_closes;

-- Create properly scoped policies for dayend_closes
CREATE POLICY "Staff can view property dayend closes" 
ON public.dayend_closes FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property dayend closes" 
ON public.dayend_closes FOR ALL TO authenticated
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

-- Drop existing policies for journal_entries
DROP POLICY IF EXISTS "Staff can view journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Staff can create journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Admins and managers can update journal entries" ON public.journal_entries;

-- Create properly scoped policies for journal_entries
CREATE POLICY "Staff can view property journal entries" 
ON public.journal_entries FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property journal entries" 
ON public.journal_entries FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Managers can update property journal entries" 
ON public.journal_entries FOR UPDATE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for journal_entry_lines
DROP POLICY IF EXISTS "Staff can view journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Staff can create journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Admins and managers can manage journal entry lines" ON public.journal_entry_lines;

-- Create properly scoped policies for journal_entry_lines (via journal_entries)
CREATE POLICY "Staff can view property journal entry lines" 
ON public.journal_entry_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND user_has_property_access(je.property_id)
  )
);

CREATE POLICY "Staff can create property journal entry lines" 
ON public.journal_entry_lines FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND user_has_property_access(je.property_id)
  )
);

CREATE POLICY "Managers can manage property journal entry lines" 
ON public.journal_entry_lines FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND user_has_property_access(je.property_id)
  ) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Managers can delete property journal entry lines" 
ON public.journal_entry_lines FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND user_has_property_access(je.property_id)
  ) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);