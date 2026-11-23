-- Permissão para a nova área "Kanbam - Ações" no menu (abaixo de Imersões).
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'kanban-acoes', CASE WHEN r.role = 'comercial' THEN false ELSE true END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;
