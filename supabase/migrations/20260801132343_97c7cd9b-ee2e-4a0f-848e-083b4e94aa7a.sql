CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  nav_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, nav_key)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role permissions"
ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role permissions"
ON public.role_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER role_permissions_set_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, k.nav_key,
  CASE
    WHEN r.role = 'comercial' THEN k.nav_key IN ('ferramentas', 'ferramentas.gerador-performance')
    WHEN r.role = 'agente' THEN k.nav_key NOT LIKE 'admin%'
    ELSE true
  END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
CROSS JOIN (VALUES
  ('bi'),
  ('inputs'), ('inputs.imersoes'), ('inputs.fontes'), ('inputs.entrevistas'), ('inputs.forms'),
  ('analises'), ('analises.sintese-tipos'), ('analises.visao-rep'), ('analises.visao-rep-2'), ('analises.perspectivas'), ('analises.compilacoes'),
  ('price'), ('price.competidores'), ('price.tabelas'), ('price.comparativos'),
  ('representantes'), ('representantes.lista'), ('representantes.performance'),
  ('clientes'), ('clientes.lista'), ('clientes.projecao'), ('clientes.novo-corp'),
  ('bases'), ('bases.produtos'), ('bases.familias'), ('bases.roteiros'),
  ('ferramentas'), ('ferramentas.gerador-performance'), ('ferramentas.tarefas'),
  ('admin'), ('admin.usuarios'), ('admin.agentes'), ('admin.permissoes'), ('admin.conformidade'),
  ('admin.mfa'), ('admin.mfa-politica'), ('admin.mfa-recuperacao'), ('admin.auditoria-seguranca'),
  ('admin.lgpd'), ('admin.criterios-seguranca'), ('admin.backup')
) AS k(nav_key);