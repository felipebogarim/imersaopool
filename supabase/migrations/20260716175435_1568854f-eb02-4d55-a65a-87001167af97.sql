
CREATE TABLE public.gerador_performance_salvos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  representante TEXT,
  periodo_label TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  familias JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  participacao JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gerador_performance_salvos TO authenticated;
GRANT ALL ON public.gerador_performance_salvos TO service_role;

ALTER TABLE public.gerador_performance_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas próprias planilhas salvas"
  ON public.gerador_performance_salvos
  FOR ALL
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE TRIGGER gerador_performance_salvos_touch
  BEFORE UPDATE ON public.gerador_performance_salvos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX gerador_performance_salvos_uploaded_by_idx
  ON public.gerador_performance_salvos (uploaded_by, created_at DESC);
