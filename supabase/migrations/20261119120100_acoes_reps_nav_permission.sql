-- Acesso ao item de menu Ferramentas > Ações Reps (mesmo padrão de ferramentas.evolucao-acoes).
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'ferramentas.acoes-reps', CASE WHEN r.role = 'comercial' THEN false ELSE true END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;
