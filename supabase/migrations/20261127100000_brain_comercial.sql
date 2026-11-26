-- Inteligência Comercial (Brain) — Fases 1 e 2.
-- Cria: configuração e capacidades por papel, conversas/mensagens/anexos (isolados por dono),
-- base de conhecimento com busca textual (pgvector fica para quando estiver disponível),
-- auditoria, expurgo por retenção e liberação do menu para gestores.
-- Segurança: nenhuma escrita direta por clientes (só o servidor, com service role e filtros
-- explícitos); leitura direta mínima e sempre do próprio dono; representantes externos
-- bloqueados por policy RESTRICTIVE. Idempotente.

-- ------------------------------------------------------------------ Configuração
CREATE TABLE IF NOT EXISTS public.brain_settings (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.brain_settings (chave, valor) VALUES
  ('portal_representante_habilitado', 'false'::jsonb),
  ('modelo_padrao', '"google/gemini-2.5-flash"'::jsonb),
  ('modelo_analise', '"google/gemini-2.5-pro"'::jsonb),
  ('retencao_conversas_dias', '365'::jsonb),
  ('retencao_anexos_dias', '90'::jsonb),
  ('limite_mensagens_dia', '200'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Capacidades configuráveis por papel (D2/D8). Papéis sem linha ficam bloqueados.
CREATE TABLE IF NOT EXISTS public.brain_role_capabilities (
  role public.app_role NOT NULL,
  capability text NOT NULL CHECK (capability IN ('chat', 'base_integral', 'conhecimento_cadastrar',
    'conhecimento_importar', 'conhecimento_aprovar', 'confidencialidade', 'modelos',
    'custos_limites', 'auditoria')),
  PRIMARY KEY (role, capability)
);
INSERT INTO public.brain_role_capabilities (role, capability)
SELECT 'admin'::public.app_role, c FROM unnest(ARRAY['chat', 'base_integral',
  'conhecimento_cadastrar', 'conhecimento_importar', 'conhecimento_aprovar', 'confidencialidade',
  'modelos', 'custos_limites', 'auditoria']) c
ON CONFLICT DO NOTHING;
INSERT INTO public.brain_role_capabilities (role, capability) VALUES
  ('gestor', 'chat'), ('gestor', 'base_integral'),
  ('gestor_comercial', 'chat'), ('gestor_comercial', 'base_integral'),
  ('representante', 'chat')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ Conversas
CREATE TABLE IF NOT EXISTS public.brain_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interface text NOT NULL CHECK (interface IN ('plataforma', 'portal')),
  titulo text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS brain_conversations_user_idx
  ON public.brain_conversations (user_id, interface, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.brain_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.brain_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  clientes_ref text[] NOT NULL DEFAULT '{}',   -- clientes citados (revalidação de escopo)
  modelo text,
  tokens_entrada int,
  tokens_saida int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brain_messages_conv_idx ON public.brain_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS brain_messages_user_day_idx ON public.brain_messages (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.brain_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.brain_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.brain_messages(id) ON DELETE CASCADE,
  nome text NOT NULL,
  mime text NOT NULL,
  tamanho bigint,
  texto_extraido text,
  expira_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brain_attachments_expira_idx ON public.brain_attachments (expira_em);

-- ------------------------------------------------------------------ Conhecimento (Brain 02/03)
CREATE TABLE IF NOT EXISTS public.brain_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL,
  camada text NOT NULL CHECK (camada IN ('memoria', 'institucional')),
  cliente_nome text,
  cliente_norm text,              -- vínculo com o cliente (permanece com troca de representante)
  representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  regiao text,
  portfolio text,
  fonte text,
  data_referencia date,
  confidencialidade text NOT NULL CHECK (confidencialidade IN ('representantes', 'gestao', 'restrito')),
  status text NOT NULL DEFAULT 'sugerido' CHECK (status IN ('sugerido', 'validado', 'rejeitado', 'inativo')),
  versao int NOT NULL DEFAULT 1,
  valido_ate date,
  autor_id uuid,
  aprovado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  busca tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese'::regconfig, coalesce(titulo, '') || ' ' || coalesce(conteudo, ''))
  ) STORED
);
CREATE INDEX IF NOT EXISTS brain_knowledge_busca_idx ON public.brain_knowledge USING gin (busca);
CREATE INDEX IF NOT EXISTS brain_knowledge_company_idx ON public.brain_knowledge (company_id, status);

-- Histórico de versões: cada alteração guarda a versão anterior.
CREATE TABLE IF NOT EXISTS public.brain_knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.brain_knowledge(id) ON DELETE CASCADE,
  versao int NOT NULL,
  dados jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.brain_knowledge_versionar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.brain_knowledge_versions (knowledge_id, versao, dados)
  VALUES (OLD.id, OLD.versao, to_jsonb(OLD) - 'busca');
  NEW.versao := OLD.versao + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS brain_knowledge_versionar ON public.brain_knowledge;
CREATE TRIGGER brain_knowledge_versionar BEFORE UPDATE ON public.brain_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.brain_knowledge_versionar();

-- ------------------------------------------------------------------ Auditoria
CREATE TABLE IF NOT EXISTS public.brain_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  interface text NOT NULL,
  escopo text NOT NULL,
  escopo_ref text,
  conversation_id uuid,
  ferramentas jsonb NOT NULL DEFAULT '[]'::jsonb,
  clientes text[] NOT NULL DEFAULT '{}',
  modelo text,
  tokens_entrada int,
  tokens_saida int,
  status text NOT NULL,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brain_audit_created_idx ON public.brain_audit (created_at DESC);

-- ------------------------------------------------------------------ Permissões e RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brain_settings', 'brain_role_capabilities', 'brain_conversations',
    'brain_messages', 'brain_attachments', 'brain_knowledge', 'brain_knowledge_versions',
    'brain_audit']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS block_external_rep ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_external_rep ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT NOT public.is_external_rep(auth.uid()))) '
      'WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())))', t);
  END LOOP;
END $$;

-- Leitura direta (opcional, sem escrita): só o próprio dono.
GRANT SELECT ON public.brain_conversations, public.brain_messages, public.brain_attachments TO authenticated;
DROP POLICY IF EXISTS brain_conversations_owner ON public.brain_conversations;
CREATE POLICY brain_conversations_owner ON public.brain_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS brain_messages_owner ON public.brain_messages;
CREATE POLICY brain_messages_owner ON public.brain_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS brain_attachments_owner ON public.brain_attachments;
CREATE POLICY brain_attachments_owner ON public.brain_attachments FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- ------------------------------------------------------------------ Retenção (D6)
CREATE OR REPLACE FUNCTION public.brain_purge_expired()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _dias int;
BEGIN
  DELETE FROM public.brain_attachments WHERE expira_em < now();
  SELECT (valor #>> '{}')::int INTO _dias FROM public.brain_settings WHERE chave = 'retencao_conversas_dias';
  DELETE FROM public.brain_conversations
  WHERE updated_at < now() - make_interval(days => COALESCE(_dias, 365))
     OR (deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days');
END $$;
REVOKE ALL ON FUNCTION public.brain_purge_expired() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'brain-purge-expired';
    PERFORM cron.schedule('brain-purge-expired', '30 3 * * *', 'SELECT public.brain_purge_expired()');
  END IF;
END $$;

-- ------------------------------------------------------------------ Menu
-- Admin vê tudo; gestores recebem o item "Inteligência Comercial".
INSERT INTO public.role_permissions (role, nav_key, allowed) VALUES
  ('gestor', 'inteligencia', true),
  ('gestor_comercial', 'inteligencia', true)
ON CONFLICT (role, nav_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
