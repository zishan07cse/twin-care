REVOKE ALL ON FUNCTION public.current_dealer_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_dealer_id() TO authenticated, service_role;