-- Módulo "Solicitações Internas" — Fase 6: permissão do item de menu do dashboard.
-- Mesmo raciocínio da migration 20260923100000: comercial/gestor_comercial/
-- diretoria só veem uma nav_key nova se houver linha explícita em
-- role_permissions.

INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'solicitacoes-internas.dashboard', true
FROM (
  VALUES
    ('comercial'::public.app_role),
    ('gestor_comercial'::public.app_role),
    ('diretoria'::public.app_role)
) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;
