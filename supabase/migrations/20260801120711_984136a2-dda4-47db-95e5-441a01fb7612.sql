CREATE TABLE public.mapa_familia_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao integer NOT NULL DEFAULT 1,
  arquivo text,
  payload jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_familia_versoes TO authenticated;
GRANT ALL ON public.mapa_familia_versoes TO service_role;
ALTER TABLE public.mapa_familia_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem mapa de familias" ON public.mapa_familia_versoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam mapa de familias" ON public.mapa_familia_versoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_mapa_familia_ativo ON public.mapa_familia_versoes (ativo, created_at DESC);