-- Módulo "Solicitações Internas" — Fase 5: permissões de menu.
--
-- useNavAccess() só libera uma nav_key pra um papel não-admin se existir uma
-- linha em role_permissions com allowed=true; papéis novos (gestor_comercial,
-- diretoria) partem de zero. Sem este seed, ninguém além de admin veria o
-- menu novo mesmo com as telas prontas. Espelha exatamente os papéis do
-- internal_ticket_module_role() (migration 20260923090100): comercial,
-- gestor_comercial, admin (automático via isAdmin), diretoria.
--
-- diretoria é só-leitura no módulo (RLS já bloqueia INSERT em internal_tickets
-- pra esse papel) — por isso não recebe "novo ticket" no menu.

INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, k.nav_key, true
FROM (VALUES ('comercial'::public.app_role), ('gestor_comercial'::public.app_role)) AS r(role)
CROSS JOIN (VALUES
  ('solicitacoes-internas'),
  ('solicitacoes-internas.lista'),
  ('solicitacoes-internas.novo')
) AS k(nav_key)
ON CONFLICT (role, nav_key) DO NOTHING;

INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT 'diretoria'::public.app_role, k.nav_key, true
FROM (VALUES ('solicitacoes-internas'), ('solicitacoes-internas.lista')) AS k(nav_key)
ON CONFLICT (role, nav_key) DO NOTHING;
