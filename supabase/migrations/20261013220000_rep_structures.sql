-- Tabela de persistência do módulo Estrutura Rep (Imersões -> Estrutura Rep).
-- Guarda a radiografia operacional e estratégica da empresa de representação comercial.

CREATE TABLE IF NOT EXISTS public.rep_structures (
  representative_id UUID PRIMARY KEY REFERENCES public.representatives(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  empresa_representacao TEXT,
  cidade_base TEXT,
  estado_base TEXT,
  regiao_principal TEXT,
  modelo_atuacao TEXT DEFAULT 'equipe',
  estados_atendidos TEXT[] DEFAULT '{}'::TEXT[],
  detalhes_municipais JSONB DEFAULT '{}'::jsonb,
  marcas_representadas JSONB DEFAULT '[]'::jsonb,
  modelo_escritorio TEXT DEFAULT 'escritorio_fisico',
  recursos_operacionais JSONB DEFAULT '{}'::jsonb,
  equipe JSONB DEFAULT '[]'::jsonb,
  observacoes_gerais TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_structures_company_idx
  ON public.rep_structures(company_id);

CREATE TRIGGER trg_rep_structures_updated
  BEFORE UPDATE ON public.rep_structures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.rep_structures ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_structures TO authenticated;
GRANT ALL ON public.rep_structures TO service_role;

CREATE POLICY "rep_structures_authenticated_all"
  ON public.rep_structures
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
