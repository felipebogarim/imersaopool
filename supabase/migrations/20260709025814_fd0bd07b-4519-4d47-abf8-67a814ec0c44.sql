
-- =========================================================================
-- FASE 0 — Estrutura aditiva
-- =========================================================================

-- ENUMS ------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.familia_nivel AS ENUM ('familia','sub_familia','linha','portfolio','sub_portfolio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.perspectiva_lente AS ENUM (
    'percepcao_marca','mix','concorrencia','argumento','decisao',
    'familias','promo_comercial','oportunidade','ameaca','cuidado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.perspectiva_escopo AS ENUM ('cliente','familia','competidor','empresa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.perspectiva_status AS ENUM ('ia_sugerida','em_revisao','aprovada','descartada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.capitulo_status_revisao AS ENUM ('pendente','em_revisao','revisado','descartado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 1. familias_produto
-- =========================================================================
CREATE TABLE public.familias_produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL,
  nivel public.familia_nivel NOT NULL,
  parent_id uuid REFERENCES public.familias_produto(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, parent_id, slug)
);
CREATE INDEX idx_familias_produto_company ON public.familias_produto(company_id);
CREATE INDEX idx_familias_produto_parent ON public.familias_produto(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.familias_produto TO authenticated;
GRANT ALL ON public.familias_produto TO service_role;
ALTER TABLE public.familias_produto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "familias_produto tenant read"
  ON public.familias_produto FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "familias_produto tenant write"
  ON public.familias_produto FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "familias_produto tenant update"
  ON public.familias_produto FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "familias_produto admin delete"
  ON public.familias_produto FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER trg_familias_produto_company BEFORE INSERT ON public.familias_produto
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER trg_familias_produto_updated BEFORE UPDATE ON public.familias_produto
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 2. roteiros
-- =========================================================================
CREATE TABLE public.roteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  perfil_alvo text,
  versao int NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roteiros_company ON public.roteiros(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiros TO authenticated;
GRANT ALL ON public.roteiros TO service_role;
ALTER TABLE public.roteiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roteiros tenant read" ON public.roteiros FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "roteiros admin write" ON public.roteiros FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "roteiros admin update" ON public.roteiros FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "roteiros admin delete" ON public.roteiros FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER trg_roteiros_company BEFORE INSERT ON public.roteiros
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER trg_roteiros_updated BEFORE UPDATE ON public.roteiros
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 3. capitulos
-- =========================================================================
CREATE TABLE public.capitulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id uuid NOT NULL REFERENCES public.roteiros(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  codigo text NOT NULL,
  titulo text NOT NULL,
  orientacao text,
  hipotese text,
  lente_default public.perspectiva_lente,
  campos_matriz jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roteiro_id, codigo),
  UNIQUE (roteiro_id, ordem)
);
CREATE INDEX idx_capitulos_roteiro ON public.capitulos(roteiro_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capitulos TO authenticated;
GRANT ALL ON public.capitulos TO service_role;
ALTER TABLE public.capitulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capitulos tenant read" ON public.capitulos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roteiros r WHERE r.id = roteiro_id AND r.company_id = public.current_company_id()));
CREATE POLICY "capitulos admin write" ON public.capitulos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gestor(auth.uid())
    AND EXISTS (SELECT 1 FROM public.roteiros r WHERE r.id = roteiro_id AND r.company_id = public.current_company_id()));
CREATE POLICY "capitulos admin update" ON public.capitulos FOR UPDATE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid())
    AND EXISTS (SELECT 1 FROM public.roteiros r WHERE r.id = roteiro_id AND r.company_id = public.current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roteiros r WHERE r.id = roteiro_id AND r.company_id = public.current_company_id()));
CREATE POLICY "capitulos admin delete" ON public.capitulos FOR DELETE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid())
    AND EXISTS (SELECT 1 FROM public.roteiros r WHERE r.id = roteiro_id AND r.company_id = public.current_company_id()));

CREATE TRIGGER trg_capitulos_updated BEFORE UPDATE ON public.capitulos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 4. Additive columns em interviews
-- =========================================================================
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS roteiro_id uuid REFERENCES public.roteiros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modo_captura text,
  ADD COLUMN IF NOT EXISTS transcricao_bruta text,
  ADD COLUMN IF NOT EXISTS status_revisao public.capitulo_status_revisao NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS immersion_id uuid REFERENCES public.immersions(id) ON DELETE SET NULL;

-- =========================================================================
-- 5. sessao_capitulos (dado sensível — company_id direto + RLS)
-- =========================================================================
CREATE TABLE public.sessao_capitulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sessao_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  capitulo_id uuid NOT NULL REFERENCES public.capitulos(id) ON DELETE RESTRICT,
  resposta_texto text,
  origem text NOT NULL DEFAULT 'manual', -- manual | ia_alocacao | importacao
  status_revisao public.capitulo_status_revisao NOT NULL DEFAULT 'pendente',
  revisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sessao_id, capitulo_id)
);
CREATE INDEX idx_sessao_capitulos_company ON public.sessao_capitulos(company_id);
CREATE INDEX idx_sessao_capitulos_sessao ON public.sessao_capitulos(sessao_id);
CREATE INDEX idx_sessao_capitulos_capitulo ON public.sessao_capitulos(capitulo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessao_capitulos TO authenticated;
GRANT ALL ON public.sessao_capitulos TO service_role;
ALTER TABLE public.sessao_capitulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessao_capitulos tenant read" ON public.sessao_capitulos FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "sessao_capitulos tenant insert" ON public.sessao_capitulos FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "sessao_capitulos tenant update" ON public.sessao_capitulos FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "sessao_capitulos admin delete" ON public.sessao_capitulos FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

-- Preenche company_id a partir da sessão (interviews) se não vier no insert
CREATE OR REPLACE FUNCTION public.set_sessao_capitulo_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.interviews WHERE id = NEW.sessao_id;
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Sessão sem empresa vinculada.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sessao_capitulos_company BEFORE INSERT ON public.sessao_capitulos
  FOR EACH ROW EXECUTE FUNCTION public.set_sessao_capitulo_company();
CREATE TRIGGER trg_sessao_capitulos_updated BEFORE UPDATE ON public.sessao_capitulos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 6. perspectivas — jsonb estruturado validado pelos campos_matriz
-- =========================================================================
CREATE TABLE public.perspectivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sessao_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  sessao_capitulo_id uuid REFERENCES public.sessao_capitulos(id) ON DELETE SET NULL,
  capitulo_id uuid REFERENCES public.capitulos(id) ON DELETE SET NULL,
  lente public.perspectiva_lente NOT NULL,
  escopo_tipo public.perspectiva_escopo NOT NULL,
  escopo_ref_id uuid,
  item_ref_tipo text, -- 'familia_produto' | 'own_product' | 'competitor_product' | 'client' ...
  item_ref_id uuid,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT 'ia_sugerida',
  status public.perspectiva_status NOT NULL DEFAULT 'ia_sugerida',
  aprovada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_perspectivas_company ON public.perspectivas(company_id);
CREATE INDEX idx_perspectivas_escopo ON public.perspectivas(escopo_tipo, escopo_ref_id);
CREATE INDEX idx_perspectivas_lente ON public.perspectivas(lente);
CREATE INDEX idx_perspectivas_sessao ON public.perspectivas(sessao_id);
CREATE INDEX idx_perspectivas_status ON public.perspectivas(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perspectivas TO authenticated;
GRANT ALL ON public.perspectivas TO service_role;
ALTER TABLE public.perspectivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perspectivas tenant read" ON public.perspectivas FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "perspectivas tenant insert" ON public.perspectivas FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "perspectivas tenant update" ON public.perspectivas FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "perspectivas admin delete" ON public.perspectivas FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

CREATE TRIGGER trg_perspectivas_company BEFORE INSERT ON public.perspectivas
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER trg_perspectivas_updated BEFORE UPDATE ON public.perspectivas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Validação do conteudo contra campos_matriz do capítulo
CREATE OR REPLACE FUNCTION public.validate_perspectiva_conteudo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _campos jsonb;
  _campo text;
BEGIN
  -- Só valida em status != 'ia_sugerida' (rascunho da IA pode chegar incompleto)
  IF NEW.status = 'ia_sugerida' OR NEW.capitulo_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT campos_matriz INTO _campos FROM public.capitulos WHERE id = NEW.capitulo_id;
  IF _campos IS NULL OR jsonb_array_length(_campos) = 0 THEN
    RETURN NEW;
  END IF;
  FOR _campo IN SELECT jsonb_array_elements_text(_campos) LOOP
    IF NOT (NEW.conteudo ? _campo) THEN
      RAISE EXCEPTION 'perspectiva.conteudo faltando chave obrigatória "%" para o capítulo', _campo;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_perspectivas_validate
  BEFORE INSERT OR UPDATE ON public.perspectivas
  FOR EACH ROW EXECUTE FUNCTION public.validate_perspectiva_conteudo();

-- =========================================================================
-- 7. Additive: own_products / competitor_products ganham familia_id
-- =========================================================================
ALTER TABLE public.own_products
  ADD COLUMN IF NOT EXISTS familia_id uuid REFERENCES public.familias_produto(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_own_products_familia ON public.own_products(familia_id);

ALTER TABLE public.competitor_products
  ADD COLUMN IF NOT EXISTS familia_id uuid REFERENCES public.familias_produto(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_competitor_products_familia ON public.competitor_products(familia_id);

-- =========================================================================
-- 8. Additive: ai_compilations (versão auto-incrementada por escopo)
-- =========================================================================
ALTER TABLE public.ai_compilations
  ADD COLUMN IF NOT EXISTS versao int,
  ADD COLUMN IF NOT EXISTS escopo_tipo public.perspectiva_escopo NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS escopo_ref_id uuid,
  ADD COLUMN IF NOT EXISTS perspectivas_incluidas uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE OR REPLACE FUNCTION public.set_ai_compilation_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.versao IS NULL THEN
    SELECT COALESCE(MAX(versao),0)+1 INTO NEW.versao
    FROM public.ai_compilations
    WHERE company_id = NEW.company_id
      AND escopo_tipo = NEW.escopo_tipo
      AND escopo_ref_id IS NOT DISTINCT FROM NEW.escopo_ref_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ai_compilations_versao BEFORE INSERT ON public.ai_compilations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_compilation_versao();

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_compilations_versao
  ON public.ai_compilations(company_id, escopo_tipo, escopo_ref_id, versao)
  WHERE escopo_ref_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_compilations_versao_null
  ON public.ai_compilations(company_id, escopo_tipo, versao)
  WHERE escopo_ref_id IS NULL;

-- =========================================================================
-- 9. Additive: action_plans (ligação com diagnóstico / perspectiva)
-- =========================================================================
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS diagnostico_id uuid REFERENCES public.ai_compilations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS perspectiva_origem_id uuid REFERENCES public.perspectivas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolvido_em timestamptz;

-- =========================================================================
-- 10. Seed do roteiro "Imersão em Campo v1" para cada empresa existente
-- =========================================================================
DO $seed$
DECLARE
  _company RECORD;
  _roteiro_id uuid;
BEGIN
  FOR _company IN SELECT id FROM public.companies LOOP
    INSERT INTO public.roteiros (company_id, nome, descricao, perfil_alvo, versao, ativo)
    VALUES (_company.id, 'Imersão em Campo v1',
            'Roteiro base derivado do Framework Metodológico Imersão Newline.',
            'representante,lojista,projetista,vendedor,arquiteto', 1, true)
    RETURNING id INTO _roteiro_id;

    INSERT INTO public.capitulos (roteiro_id, ordem, codigo, titulo, orientacao, hipotese, lente_default, campos_matriz) VALUES
      (_roteiro_id, 1, 'percepcao_marca', 'Percepção de marca e preço',
       'Top of mind espontâneo/estimulado e percepção de preço vs. concorrentes, antes de mostrar tabela.',
       'H1', 'percepcao_marca',
       '["top_of_mind","percepcao_preco","checou_tabela","evidencia"]'::jsonb),
      (_roteiro_id, 2, 'mix_e_esforco', 'Mix ofertado e esforço de venda',
       'Linhas ativas vs. engavetadas; SKUs adormecidos com histórico de compra.',
       'H2/H7', 'mix',
       '["o_que_funciona","o_que_nao_funciona","skus_adormecidos","motivo","evidencia"]'::jsonb),
      (_roteiro_id, 3, 'concorrencia', 'Concorrência e conflito de interesse',
       'Concorrentes fortes por categoria e sinais de reprodução de discurso do concorrente.',
       'H3', 'concorrencia',
       '["concorrente","categorias_onde_ganha","sinal_de_conflito","evidencia"]'::jsonb),
      (_roteiro_id, 4, 'argumento_tecnico', 'Argumento técnico no ponto de venda',
       'Qualidade do argumento para defender preço e diagnosticar produto difícil.',
       'H4', 'argumento',
       '["produto","objecao","argumento_usado","qualidade_argumento","evidencia"]'::jsonb),
      (_roteiro_id, 5, 'decisao_cliente', 'Critério de decisão do cliente',
       'Critério declarado vs. revelado; valor defensável em produtos mais caros.',
       'H5/H6', 'decisao',
       '["criterio_declarado","criterio_revelado","valor_defensavel","evidencia"]'::jsonb),
      (_roteiro_id, 6, 'oportunidades_ameacas', 'Oportunidades, ameaças e cuidados',
       'Síntese acionável para o plano de ação.',
       '—', 'oportunidade',
       '["oportunidade","ameaca","cuidado","acao_sugerida","evidencia"]'::jsonb);
  END LOOP;
END $seed$;
