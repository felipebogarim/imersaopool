-- Estrutura Rep: persistência 100% no banco (antes ficava só no localStorage do navegador).
-- Idempotente e autossuficiente: cria rep_structures se a migration 20261013220000 nunca foi
-- aplicada, adiciona as colunas que o app antes empacotava dentro de recursos_operacionais,
-- cria a biblioteca compartilhada de marcas e o bucket público das logomarcas.

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

ALTER TABLE public.rep_structures
  ADD COLUMN IF NOT EXISTS treinamentos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS frequencia_visitas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS frequencia_demais_clientes INTEGER,
  ADD COLUMN IF NOT EXISTS dias_campo_por_estado JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS performance_comparativo JSONB,
  ADD COLUMN IF NOT EXISTS ranking_clientes_comparativo JSONB,
  ADD COLUMN IF NOT EXISTS infographic_url TEXT,
  ADD COLUMN IF NOT EXISTS infographic_updated_at TIMESTAMPTZ;

-- Dados antigos que o app guardava dentro de recursos_operacionais passam para as colunas.
UPDATE public.rep_structures s SET
  treinamentos = COALESCE(NULLIF(s.recursos_operacionais->'treinamentos', 'null'::jsonb), s.treinamentos),
  frequencia_visitas = COALESCE(NULLIF(s.recursos_operacionais->'frequencia_visitas', 'null'::jsonb), s.frequencia_visitas),
  frequencia_demais_clientes = COALESCE(
    s.frequencia_demais_clientes,
    CASE WHEN jsonb_typeof(s.recursos_operacionais->'frequencia_demais_clientes') = 'number'
      THEN (s.recursos_operacionais->>'frequencia_demais_clientes')::int END),
  dias_campo_por_estado = COALESCE(NULLIF(s.recursos_operacionais->'dias_campo_por_estado', 'null'::jsonb), s.dias_campo_por_estado),
  performance_comparativo = COALESCE(s.performance_comparativo, NULLIF(s.recursos_operacionais->'performance_comparativo', 'null'::jsonb)),
  ranking_clientes_comparativo = COALESCE(s.ranking_clientes_comparativo, NULLIF(s.recursos_operacionais->'ranking_clientes_comparativo', 'null'::jsonb)),
  infographic_url = COALESCE(s.infographic_url, s.recursos_operacionais->>'infographic_url')
WHERE s.recursos_operacionais ?| ARRAY['treinamentos','frequencia_visitas','frequencia_demais_clientes',
  'dias_campo_por_estado','performance_comparativo','ranking_clientes_comparativo','infographic_url'];

CREATE INDEX IF NOT EXISTS rep_structures_company_idx ON public.rep_structures(company_id);

DROP TRIGGER IF EXISTS trg_rep_structures_updated ON public.rep_structures;
CREATE TRIGGER trg_rep_structures_updated
  BEFORE UPDATE ON public.rep_structures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.rep_structures ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_structures TO authenticated;
GRANT ALL ON public.rep_structures TO service_role;
DROP POLICY IF EXISTS "rep_structures_authenticated_all" ON public.rep_structures;
CREATE POLICY "rep_structures_authenticated_all" ON public.rep_structures
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Biblioteca compartilhada de marcas/logomarcas (antes só no localStorage de cada navegador).
CREATE TABLE IF NOT EXISTS public.rep_brand_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_key TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  logo_url TEXT,
  segmento TEXT,
  modelo_negocio TEXT,
  canais TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  abrangencia TEXT,
  origem TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_rep_brand_library_updated ON public.rep_brand_library;
CREATE TRIGGER trg_rep_brand_library_updated
  BEFORE UPDATE ON public.rep_brand_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.rep_brand_library ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_brand_library TO authenticated;
GRANT ALL ON public.rep_brand_library TO service_role;
DROP POLICY IF EXISTS "rep_brand_library_authenticated_all" ON public.rep_brand_library;
CREATE POLICY "rep_brand_library_authenticated_all" ON public.rep_brand_library
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket PÚBLICO de logomarcas: a URL é usada em <img>, no infográfico e no PDF; logomarcas
-- não são dado sensível. Escrita só para usuários autenticados.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rep-brand-logos', 'rep-brand-logos', true, 5242880,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

DROP POLICY IF EXISTS "rep_brand_logos_read" ON storage.objects;
CREATE POLICY "rep_brand_logos_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'rep-brand-logos');
DROP POLICY IF EXISTS "rep_brand_logos_insert" ON storage.objects;
CREATE POLICY "rep_brand_logos_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rep-brand-logos');
DROP POLICY IF EXISTS "rep_brand_logos_update" ON storage.objects;
CREATE POLICY "rep_brand_logos_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'rep-brand-logos' AND owner = auth.uid());
DROP POLICY IF EXISTS "rep_brand_logos_delete" ON storage.objects;
CREATE POLICY "rep_brand_logos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'rep-brand-logos' AND owner = auth.uid());

NOTIFY pgrst, 'reload schema';
