-- Drop the overly permissive policies that still exist
DROP POLICY IF EXISTS "Anyone can view recommendations" ON public.reservation_recommendations;
DROP POLICY IF EXISTS "Anyone can add recommendations" ON public.reservation_recommendations;