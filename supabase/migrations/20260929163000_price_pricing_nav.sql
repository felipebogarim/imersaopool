-- Acesso à nova área Pricing, paralela às telas legadas do módulo Price.
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT role, 'price.pricing', CASE WHEN role = 'comercial' THEN false ELSE true END
FROM (VALUES
  ('gestor'::public.app_role),
  ('agente'::public.app_role),
  ('comercial'::public.app_role)
) AS roles(role)
ON CONFLICT (role, nav_key) DO UPDATE SET allowed = EXCLUDED.allowed;
