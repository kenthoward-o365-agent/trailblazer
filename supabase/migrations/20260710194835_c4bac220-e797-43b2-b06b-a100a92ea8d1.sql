
-- Prevent unauthenticated (anon) execution of SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pci_retention_sweep() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_booking_holds() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_rental_availability(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_property_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_property(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_guest(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_mfa() FROM PUBLIC, anon;
