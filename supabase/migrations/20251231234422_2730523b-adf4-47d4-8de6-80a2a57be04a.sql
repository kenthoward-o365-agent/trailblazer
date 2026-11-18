-- Create proper policies that require property access via reservation
CREATE POLICY "Staff can view recommendations" 
ON public.reservation_recommendations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.reservations r 
    WHERE r.id = reservation_id 
    AND user_has_property_access(r.property_id)
  )
);

CREATE POLICY "Staff can add recommendations" 
ON public.reservation_recommendations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reservations r 
    WHERE r.id = reservation_id 
    AND user_has_property_access(r.property_id)
  )
);