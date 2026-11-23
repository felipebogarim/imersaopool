-- Permissão para o novo grupo "Em revisão" no menu (posição final, após Admin).
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'em-revisao', CASE WHEN r.role = 'comercial' THEN false ELSE true END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;
