
CREATE TABLE public.entity_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('cliente','representante','agente')),
  entity_id UUID NOT NULL,
  area TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_permissions TO authenticated;
GRANT ALL ON public.entity_permissions TO service_role;

ALTER TABLE public.entity_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/gestores gerenciam permissões"
ON public.entity_permissions FOR ALL
TO authenticated
USING (public.is_admin_or_gestor(auth.uid()))
WITH CHECK (public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER touch_entity_permissions BEFORE UPDATE ON public.entity_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
