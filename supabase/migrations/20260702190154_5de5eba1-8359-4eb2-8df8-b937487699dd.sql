
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entrevistador_nome TEXT NOT NULL,
  entrevistador_cargo TEXT,
  entrevistador_email TEXT,
  entrevistado_nome TEXT NOT NULL,
  entrevistado_classificacao TEXT NOT NULL,
  entrevistado_classificacao_outro TEXT,
  empresa_nome TEXT,
  empresa_tipo TEXT,
  empresa_tipo_outro TEXT,
  cidade TEXT,
  estado TEXT,
  data_entrevista DATE,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view interviews"
  ON public.interviews FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "Authenticated users can insert their interviews"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners or gestor can update interviews"
  ON public.interviews FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "Owners or gestor can delete interviews"
  ON public.interviews FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER trg_interviews_updated
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
