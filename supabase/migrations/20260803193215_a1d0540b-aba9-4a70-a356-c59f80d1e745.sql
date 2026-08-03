CREATE TABLE public.manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  prompt text,
  tipo text NOT NULL DEFAULT 'ia',
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path text,
  publicado boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuais TO authenticated;
GRANT SELECT ON public.manuais TO anon;
GRANT ALL ON public.manuais TO service_role;

ALTER TABLE public.manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manuais publicados são públicos"
  ON public.manuais FOR SELECT TO anon
  USING (publicado = true);

CREATE POLICY "Autenticados veem todos os manuais"
  ON public.manuais FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Autenticados criam manuais"
  ON public.manuais FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Autor ou gestor edita manuais"
  ON public.manuais FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "Autor ou gestor remove manuais"
  ON public.manuais FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER manuais_updated_at BEFORE UPDATE ON public.manuais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();