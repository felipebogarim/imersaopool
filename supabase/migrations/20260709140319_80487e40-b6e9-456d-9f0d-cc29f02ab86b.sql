
CREATE TABLE public.sessao_capitulo_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  sessao_capitulo_id UUID NOT NULL REFERENCES public.sessao_capitulos(id) ON DELETE CASCADE,
  item_tipo TEXT CHECK (item_tipo IN ('familia','competidor','produto')),
  item_ref_id UUID,
  campos JSONB NOT NULL DEFAULT '{}'::jsonb,
  origem TEXT NOT NULL CHECK (origem IN ('digitado','audio_transcrito','extraido_ia')),
  confianca_ia NUMERIC,
  revisado_humano BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sci_sessao_capitulo ON public.sessao_capitulo_itens(sessao_capitulo_id);
CREATE INDEX idx_sci_company ON public.sessao_capitulo_itens(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessao_capitulo_itens TO authenticated;
GRANT ALL ON public.sessao_capitulo_itens TO service_role;

ALTER TABLE public.sessao_capitulo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sci_select_company" ON public.sessao_capitulo_itens
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "sci_insert_company" ON public.sessao_capitulo_itens
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() OR public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "sci_update_company" ON public.sessao_capitulo_itens
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() OR public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "sci_delete_company" ON public.sessao_capitulo_itens
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() OR public.is_admin_or_gestor(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_sci_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.sessao_capitulos WHERE id = NEW.sessao_capitulo_id;
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Item de capítulo sem empresa vinculada.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sci_set_company
  BEFORE INSERT ON public.sessao_capitulo_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_sci_company();

CREATE TRIGGER trg_sci_updated_at
  BEFORE UPDATE ON public.sessao_capitulo_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
