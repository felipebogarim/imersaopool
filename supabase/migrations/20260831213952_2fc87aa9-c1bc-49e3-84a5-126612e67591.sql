CREATE TABLE public.price_mapa_dados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia text NOT NULL UNIQUE,
  anchors jsonb NOT NULL DEFAULT '[]'::jsonb,
  competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_mapa_dados TO authenticated;
GRANT ALL ON public.price_mapa_dados TO service_role;

ALTER TABLE public.price_mapa_dados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem dados do mapa"
  ON public.price_mapa_dados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gravam dados do mapa"
  ON public.price_mapa_dados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam dados do mapa"
  ON public.price_mapa_dados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados excluem dados do mapa"
  ON public.price_mapa_dados FOR DELETE TO authenticated USING (true);

CREATE TRIGGER price_mapa_dados_touch
  BEFORE UPDATE ON public.price_mapa_dados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();