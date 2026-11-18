-- Allow admin users to insert new properties
CREATE POLICY "Admins can create properties"
ON public.properties
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin users to delete properties (if needed)
CREATE POLICY "Admins can delete properties"
ON public.properties
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));