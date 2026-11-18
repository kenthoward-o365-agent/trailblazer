-- Add explicit INSERT, UPDATE, DELETE policies for add_ons table
DROP POLICY IF EXISTS "Admins and managers can manage add-ons" ON public.add_ons;

CREATE POLICY "Staff can insert add-ons" ON public.add_ons
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role)
);

CREATE POLICY "Staff can update add-ons" ON public.add_ons
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role)
);

CREATE POLICY "Staff can delete add-ons" ON public.add_ons
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role)
);