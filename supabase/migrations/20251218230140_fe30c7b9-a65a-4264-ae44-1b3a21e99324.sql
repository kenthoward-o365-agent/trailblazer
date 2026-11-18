-- Phase 3: Fix overly permissive write policies

-- Fix api_logs - should only allow service role or system to insert
DROP POLICY IF EXISTS "Service can insert API logs" ON public.api_logs;

-- Create a more restrictive policy - only allow inserts from users who have property access
CREATE POLICY "Staff can insert API logs for their properties" 
ON public.api_logs FOR INSERT TO authenticated
WITH CHECK (
  property_id IS NULL OR user_has_property_access(property_id)
);

-- Fix login_attempts - this should be restricted
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;

-- Login attempts should only be insertable for the authenticated user's own attempts
CREATE POLICY "Users can insert their own login attempts" 
ON public.login_attempts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Also allow viewing own login attempts
DROP POLICY IF EXISTS "Users can view their own login attempts" ON public.login_attempts;
CREATE POLICY "Users can view their own login attempts" 
ON public.login_attempts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_super_admin());

-- Fix user_password_history if it exists with overly permissive policies
DROP POLICY IF EXISTS "Users can insert their own password history" ON public.user_password_history;
DROP POLICY IF EXISTS "Users can view their own password history" ON public.user_password_history;

-- Check if table exists and add proper policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_password_history') THEN
    EXECUTE 'CREATE POLICY "Users can insert their own password history" 
      ON public.user_password_history FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid())';
    
    EXECUTE 'CREATE POLICY "Users can view their own password history" 
      ON public.user_password_history FOR SELECT TO authenticated
      USING (user_id = auth.uid())';
  END IF;
END $$;