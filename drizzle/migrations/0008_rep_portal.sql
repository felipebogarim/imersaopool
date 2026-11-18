-- Portal do representante (Fase 2): vínculo usuário↔representante, pedidos de prorrogação e
-- blindagem do banco para usuários EXTERNOS (representantes com login).
--
-- Segurança: o representante só acessa dados pelas server functions do portal (service role,
-- sempre escopadas ao representante vinculado). Como ele também é um usuário "authenticated" do
-- Supabase, uma policy RESTRICTIVE em todas as tabelas impede qualquer leitura/escrita direta
-- feita com o token dele — mesmo onde existam policies permissivas para "authenticated".

ALTER TABLE public.representatives
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS representatives_user_id_key
  ON public.representatives(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_external_rep(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.representatives r WHERE r.user_id = _user_id);
$$;
REVOKE ALL ON FUNCTION public.is_external_rep(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_external_rep(UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.kanban_action_extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  current_due DATE,
  requested_due DATE NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kanban_ext_card ON public.kanban_action_extension_requests(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kanban_ext_status ON public.kanban_action_extension_requests(status);

GRANT SELECT, UPDATE ON public.kanban_action_extension_requests TO authenticated;
GRANT ALL ON public.kanban_action_extension_requests TO service_role;
ALTER TABLE public.kanban_action_extension_requests ENABLE ROW LEVEL SECURITY;

-- Equipe interna enxerga/decide as prorrogações dos cards que já pode acessar.
CREATE POLICY "kaer_internal_select" ON public.kanban_action_extension_requests FOR SELECT TO authenticated
  USING (public.kanban_can_access_card(card_id, auth.uid()));
CREATE POLICY "kaer_internal_update" ON public.kanban_action_extension_requests FOR UPDATE TO authenticated
  USING (public.kanban_can_access_card(card_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_card(card_id, auth.uid()));

-- Blindagem: usuário externo (representante) não acessa nenhuma tabela pelo token dele.
-- user_roles fica de fora (a policy própria já limita à linha do próprio usuário e o app precisa
-- lê-la para encaminhar o representante ao portal).
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND c.relname <> 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS block_external_rep ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY block_external_rep ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT NOT public.is_external_rep(auth.uid()))) '
      'WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())))',
      t.relname
    );
  END LOOP;
END $$;

-- Idem para os arquivos do Storage (o portal entrega arquivos por URL assinada gerada no servidor).
DROP POLICY IF EXISTS block_external_rep ON storage.objects;
CREATE POLICY block_external_rep ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT NOT public.is_external_rep(auth.uid())))
  WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())));

NOTIFY pgrst, 'reload schema';
