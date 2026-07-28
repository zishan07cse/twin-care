
REVOKE EXECUTE ON FUNCTION public.tg_patients_set_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_patients_timeline_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_patients_timeline_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
