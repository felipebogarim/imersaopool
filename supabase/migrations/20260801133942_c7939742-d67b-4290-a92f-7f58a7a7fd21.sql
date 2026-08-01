CREATE TABLE public.user_nav_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nav_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nav_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_nav_permissions TO authenticated;
GRANT ALL ON public.user_nav_permissions TO service_role;

ALTER TABLE public.user_nav_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own nav permissions"
  ON public.user_nav_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage nav permissions"
  ON public.user_nav_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_nav_permissions_updated_at
  BEFORE UPDATE ON public.user_nav_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();