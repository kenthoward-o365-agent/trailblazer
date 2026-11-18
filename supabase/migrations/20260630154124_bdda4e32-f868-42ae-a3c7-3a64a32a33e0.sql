
-- Lock down SECURITY DEFINER helpers exposed via PostgREST: revoke from anon/PUBLIC
REVOKE EXECUTE ON FUNCTION public.can_access_guest(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_property(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_property_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_site_limit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_confirmation_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_guest(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_property(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_property_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_site_limit() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_confirmation_number() TO authenticated, service_role;
