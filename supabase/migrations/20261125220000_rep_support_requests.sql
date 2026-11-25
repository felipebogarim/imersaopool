-- Portal do representante → SOLICITAÇÕES DE APOIO (materiais para eventos, ações de trade,
-- material de PDV/exposição, amostras e catálogos).
--
-- O representante cria e acompanha os pedidos pelo portal (server functions com service role,
-- sempre escopadas ao representante vinculado ao usuário). A equipe interna (admin/gestor da
-- empresa) lê e responde pelo próprio token (RLS). Usuário externo não acessa a tabela direto.

CREATE TABLE IF NOT EXISTS public.rep_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('material_evento', 'acao_trade', 'material_pdv', 'amostras')),
  titulo TEXT NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 3 AND 200),
  cliente TEXT,
  acao_trade_tipo TEXT,
  data_evento DATE,
  data_necessaria DATE,
  local TEXT,
  publico_estimado INTEGER CHECK (publico_estimado IS NULL OR publico_estimado >= 0),
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_analise', 'aprovada', 'recusada', 'concluida')),
  resposta TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_support_requests_rep
  ON public.rep_support_requests(representative_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_support_requests_company_status
  ON public.rep_support_requests(company_id, status, created_at DESC);

GRANT SELECT, UPDATE ON public.rep_support_requests TO authenticated;
GRANT ALL ON public.rep_support_requests TO service_role;
ALTER TABLE public.rep_support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rep_support_requests_staff_select ON public.rep_support_requests;
CREATE POLICY rep_support_requests_staff_select ON public.rep_support_requests
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

DROP POLICY IF EXISTS rep_support_requests_staff_update ON public.rep_support_requests;
CREATE POLICY rep_support_requests_staff_update ON public.rep_support_requests
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

-- Blindagem padrão: representante (usuário externo) não acessa pelo token dele.
DROP POLICY IF EXISTS block_external_rep ON public.rep_support_requests;
CREATE POLICY block_external_rep ON public.rep_support_requests AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT NOT public.is_external_rep(auth.uid())))
  WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())));

NOTIFY pgrst, 'reload schema';
