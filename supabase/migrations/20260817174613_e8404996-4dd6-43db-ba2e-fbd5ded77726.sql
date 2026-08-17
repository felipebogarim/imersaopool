-- Grant explicit home access to all roles to prevent "Acesso não liberado" error
INSERT INTO public.role_permissions (role, nav_key, allowed)
VALUES 
  ('admin', 'home', true),
  ('gestor', 'home', true),
  ('agente', 'home', true),
  ('comercial', 'home', true)
ON CONFLICT (role, nav_key) DO UPDATE SET allowed = true;
