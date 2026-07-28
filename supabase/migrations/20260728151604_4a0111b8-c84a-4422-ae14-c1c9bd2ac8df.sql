CREATE TYPE public.insight_fonte_tipo AS ENUM ('entrevista','visita_campo','voz_loja','diretoria');
CREATE TYPE public.insight_lente AS ENUM ('marca_preco','mix','concorrencia','argumento','decisao','oportunidades','governanca','adicionais');
CREATE TYPE public.insight_fonte_status AS ENUM ('pendente','processada','incluida_na_sintese');

CREATE TABLE public.insight_fontes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  tipo public.insight_fonte_tipo NOT NULL DEFAULT 'entrevista',
  titulo text NOT NULL,
  pessoa text,
  regiao text,
  perfil_carteira text,
  data_coleta date,
  status_processamento public.insight_fonte_status NOT NULL DEFAULT 'pendente',
  arquivo_relatorio text,
  interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_fontes TO authenticated;
GRANT ALL ON public.insight_fontes TO service_role;
ALTER TABLE public.insight_fontes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insight_fontes_company" ON public.insight_fontes FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE TRIGGER insight_fontes_company_default BEFORE INSERT ON public.insight_fontes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER insight_fontes_touch BEFORE UPDATE ON public.insight_fontes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_insight_fontes_tipo ON public.insight_fontes(company_id, tipo);

CREATE TABLE public.insight_fonte_lentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_id uuid NOT NULL REFERENCES public.insight_fontes(id) ON DELETE CASCADE,
  company_id uuid,
  lente public.insight_lente NOT NULL,
  leitura_estrategica text,
  sintese_campos jsonb NOT NULL DEFAULT '{}'::jsonb,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fonte_id, lente)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_fonte_lentes TO authenticated;
GRANT ALL ON public.insight_fonte_lentes TO service_role;
ALTER TABLE public.insight_fonte_lentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insight_fonte_lentes_company" ON public.insight_fonte_lentes FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE OR REPLACE FUNCTION public.set_insight_lente_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.insight_fontes WHERE id = NEW.fonte_id;
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Fonte sem empresa vinculada.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_insight_lente_company() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER insight_fonte_lentes_company BEFORE INSERT ON public.insight_fonte_lentes
  FOR EACH ROW EXECUTE FUNCTION public.set_insight_lente_company();
CREATE TRIGGER insight_fonte_lentes_touch BEFORE UPDATE ON public.insight_fonte_lentes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.paineis_sintese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  tipos_incluidos public.insight_fonte_tipo[] NOT NULL,
  fontes_incluidas uuid[] NOT NULL DEFAULT '{}',
  corte_convergencia int NOT NULL DEFAULT 0,
  versao int NOT NULL DEFAULT 1,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paineis_sintese TO authenticated;
GRANT ALL ON public.paineis_sintese TO service_role;
ALTER TABLE public.paineis_sintese ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paineis_sintese_company" ON public.paineis_sintese FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE TRIGGER paineis_sintese_company_default BEFORE INSERT ON public.paineis_sintese
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER paineis_sintese_touch BEFORE UPDATE ON public.paineis_sintese
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_paineis_sintese_lookup ON public.paineis_sintese(company_id, gerado_em DESC);