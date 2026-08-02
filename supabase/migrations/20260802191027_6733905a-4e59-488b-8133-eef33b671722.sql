CREATE TABLE public.permission_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nav_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_presets TO authenticated;
GRANT ALL ON public.permission_presets TO service_role;

ALTER TABLE public.permission_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view presets"
ON public.permission_presets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestores can manage presets"
ON public.permission_presets FOR ALL TO authenticated
USING (public.is_admin_or_gestor(auth.uid()))
WITH CHECK (public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER permission_presets_updated_at
BEFORE UPDATE ON public.permission_presets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();