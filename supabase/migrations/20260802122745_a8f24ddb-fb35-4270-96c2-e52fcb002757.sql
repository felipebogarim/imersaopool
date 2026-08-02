GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_nav_permissions TO authenticated;
GRANT ALL ON public.user_nav_permissions TO service_role;