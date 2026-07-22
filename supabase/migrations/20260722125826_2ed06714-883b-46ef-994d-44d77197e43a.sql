
REVOKE EXECUTE ON FUNCTION public.record_terms_acceptance(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_login_acknowledgement(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_terms_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_terms_conformidade() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_terms_acceptance(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_acknowledgement(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_terms_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_terms_conformidade() TO authenticated;
