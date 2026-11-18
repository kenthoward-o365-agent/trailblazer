
-- 1) rate_seasons: replace public SELECT with auth-only access via property access check
DROP POLICY IF EXISTS "Staff can view rate seasons" ON public.rate_seasons;
CREATE POLICY "Authenticated staff can view rate seasons"
  ON public.rate_seasons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rates r
      WHERE r.id = rate_seasons.rate_id
        AND public.user_has_property_access(r.property_id)
    )
  );

-- 2) Lock down "always true" policies on system/audit tables to service_role only
DROP POLICY IF EXISTS "Service role can insert auto_run_logs" ON public.auto_run_logs;
CREATE POLICY "Service role can insert auto_run_logs"
  ON public.auto_run_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "System can insert audit logs"
  ON public.security_audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert lockouts" ON public.user_lockouts;
CREATE POLICY "System can insert lockouts"
  ON public.user_lockouts FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update lockouts" ON public.user_lockouts;
CREATE POLICY "System can update lockouts"
  ON public.user_lockouts FOR UPDATE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "System can manage password history" ON public.user_password_history;
CREATE POLICY "System can manage password history"
  ON public.user_password_history FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- reservation_add_ons: scope to authenticated users with property access
DROP POLICY IF EXISTS "Anyone can add reservation add-ons" ON public.reservation_add_ons;
CREATE POLICY "Authenticated users can add reservation add-ons"
  ON public.reservation_add_ons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_add_ons.reservation_id
        AND public.user_has_property_access(r.property_id)
    )
  );

DROP POLICY IF EXISTS "Anyone can view reservation add-ons" ON public.reservation_add_ons;
CREATE POLICY "Authenticated users can view reservation add-ons"
  ON public.reservation_add_ons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_add_ons.reservation_id
        AND public.user_has_property_access(r.property_id)
    )
  );

-- user_custom_roles: scope SELECT to authenticated
DROP POLICY IF EXISTS "Staff can view user custom roles" ON public.user_custom_roles;
CREATE POLICY "Authenticated staff can view user custom roles"
  ON public.user_custom_roles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3) Harden execute_readonly_query with stricter filtering and a hard row cap
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  ql text;
BEGIN
  IF query_text IS NULL OR length(query_text) > 4000 THEN
    RAISE EXCEPTION 'Query too long or empty';
  END IF;

  ql := lower(regexp_replace(trim(query_text), '\s+', ' ', 'g'));

  -- Must be a single SELECT
  IF ql !~ '^select\s' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- No statement chaining, comments, or escape characters
  IF query_text LIKE '%;%' OR query_text LIKE '%--%'
     OR query_text LIKE '%/*%' OR query_text LIKE '%*/%'
     OR query_text LIKE '%\%' THEN
    RAISE EXCEPTION 'Query contains forbidden characters';
  END IF;

  -- Forbid any DDL/DML keywords, role/privilege ops, and access to non-public schemas
  IF ql ~ '\m(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|merge|call|do|vacuum|analyze|reindex|cluster|listen|notify|lock|begin|commit|rollback|savepoint|set|reset|prepare|execute|deallocate|refresh|comment|security|definer|invoker|into|returning)\M' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  IF ql ~ '\m(pg_catalog|information_schema|pg_authid|pg_user|pg_shadow|pg_roles|auth\.|storage\.|vault\.|supabase_functions\.|realtime\.)\M' THEN
    RAISE EXCEPTION 'Query references restricted schema or object';
  END IF;

  -- Wrap and cap result rows
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM (' || query_text || ') _q LIMIT 1000) t'
    INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;

-- Restrict execute_readonly_query to authenticated callers only
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO authenticated, service_role;
