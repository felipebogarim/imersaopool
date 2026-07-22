
-- FASE 1: sanitiza client_bi_uploads.data
UPDATE public.client_bi_uploads
SET data = jsonb_set(data, '{itens}', COALESCE((
  SELECT jsonb_agg(item - 'meta' - 'realizado')
  FROM jsonb_array_elements(data->'itens') item
), '[]'::jsonb))
WHERE kind = 'familias' AND data ? 'itens';

UPDATE public.client_bi_uploads
SET data = jsonb_set(data, '{familias}', COALESCE((
  SELECT jsonb_agg(item - 'meta' - 'realizado')
  FROM jsonb_array_elements(data->'familias') item
), '[]'::jsonb))
WHERE kind = 'bi' AND data ? 'familias';

CREATE OR REPLACE FUNCTION public.sanitize_client_bi_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _key text;
BEGIN
  IF NEW.data IS NULL THEN RETURN NEW; END IF;
  FOREACH _key IN ARRAY ARRAY['itens','familias'] LOOP
    IF NEW.data ? _key THEN
      NEW.data := jsonb_set(NEW.data, ARRAY[_key], COALESCE((
        SELECT jsonb_agg(it - 'meta' - 'realizado' - 'valor' - 'target' - 'amount')
        FROM jsonb_array_elements(NEW.data -> _key) it
      ), '[]'::jsonb));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_client_bi_sanitize ON public.client_bi_uploads;
CREATE TRIGGER trg_client_bi_sanitize
  BEFORE INSERT OR UPDATE ON public.client_bi_uploads
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_client_bi_data();

-- FASE 1: revoga acesso admin ao bucket backups
DROP POLICY IF EXISTS "admin read backups" ON storage.objects;
DROP POLICY IF EXISTS "admin delete backups" ON storage.objects;
DROP POLICY IF EXISTS "admin update backups" ON storage.objects;
DROP POLICY IF EXISTS "admin write backups" ON storage.objects;

-- FASE 1: Termos v1.1 (frase absoluta)
UPDATE public.terms_versions SET is_active = false WHERE is_active = true;

INSERT INTO public.terms_versions (version, title, content, summary_content, is_active, effective_at, requires_new_acceptance, change_summary)
VALUES (
  '1.1',
  'Termos de Uso, Privacidade e Confidencialidade — v1.1',
  E'# Termos de Uso, Privacidade e Confidencialidade\n\n**Versão 1.1 — vigente a partir de hoje**\n\nEste sistema é operado por **New Line Iluminação LTDA** (CNPJ 12.077.181/0001-33), doravante "Empresa", com sede na Rua Sonia, 101, Jardim Aeródromo Internacional, Suzano/SP, CEP 08616-520.\n\n## 1. Confidencialidade\n\nTodo o conteúdo, dados, planilhas, relatórios, análises, indicadores, textos, respostas de IA, ações sugeridas, informações de clientes, representantes, fornecedores, produtos, metas, resultados, entrevistas, imersões e demais materiais acessados neste ambiente são **estritamente confidenciais** e propriedade exclusiva da Empresa.\n\nÉ **expressamente proibido** ao usuário reproduzir, copiar, exportar, imprimir para uso externo, encaminhar, compartilhar por qualquer meio (WhatsApp, e-mail, redes sociais, mensageiros, drives externos, capturas de tela), divulgar publicamente ou usar em benefício próprio ou de terceiros qualquer conteúdo aqui existente, exceto nas hipóteses expressamente autorizadas por escrito pela Empresa.\n\n## 2. Proteção absoluta de valores monetários\n\n**Nenhum usuário humano deste sistema — em nenhuma hipótese, incluindo administradores, gestores, desenvolvedores e operadores — tem, teve ou terá acesso visual, exportável ou consultável a valores monetários brutos de metas ou vendas por cliente, produto ou família de produto.**\n\nToda operação sobre valores monetários é executada exclusivamente pelo backend automatizado, com dados isolados em schema privado inacessível a qualquer humano. Todas as saídas visíveis, exportáveis e reproduzíveis contêm apenas: percentuais de atingimento, participação relativa, faróis (Excelente, Ótimo, Próximo, Pode melhorar, Abaixo da meta, Sem compra), ranqueamentos e faixas comparativas. Nenhum relatório, tela, exportação (PDF, Excel, CSV), resposta de IA, log ou dump de banco disponível a usuários apresenta valores brutos em reais.\n\n## 3. Uso pessoal e intransferível\n\nO acesso ao sistema é pessoal, individual, rastreado e intransferível. É proibido compartilhar credenciais, ceder sessões ativas ou permitir o uso por terceiros. Todo acesso, ação, exportação e consulta é registrado com identificação do usuário, IP, horário e conteúdo consultado.\n\n## 4. Dados pessoais e LGPD\n\nA Empresa é controladora dos dados pessoais tratados neste ambiente (Lei 13.709/2018 — LGPD). O titular de dados pessoais pode exercer seus direitos (acesso, correção, portabilidade, anonimização, exclusão) enviando pedido para **nfegruponewline@newline.ind.br**. Solicitações são registradas, respondidas em até 15 dias úteis e mantidas em histórico imutável para fins de auditoria.\n\n## 5. Segurança e monitoramento\n\nO sistema aplica: criptografia em trânsito e em repouso, autenticação multifator obrigatória para acessos administrativos, marca d''água identificando o usuário em telas com dados sensíveis, isolamento de valores monetários em schema privado, registros imutáveis de auditoria e revisão periódica de acessos. Tentativas de burlar essas proteções (screenshots, cópia externa, engenharia reversa, extração automatizada) constituem violação contratual e serão apuradas.\n\n## 6. Consequências do descumprimento\n\nO descumprimento destes termos sujeita o infrator a responsabilização civil, criminal e trabalhista, incluindo rescisão contratual por justa causa, indenização por perdas e danos, e ações judiciais cabíveis. A Empresa poderá, a qualquer momento e sem aviso prévio: revogar sessões ativas, bloquear acessos, apagar cópias locais, anonimizar dados e comunicar autoridades competentes.\n\n## 7. Foro\n\nFica eleito o foro da Comarca de Suzano/SP para dirimir quaisquer questões oriundas destes termos, renunciando as partes a qualquer outro, por mais privilegiado que seja.\n\n## 8. Aceitação\n\nAo clicar em "Aceito", o usuário declara ter lido, compreendido integralmente e concordado com todos os termos acima, ciente de que o aceite é obrigatório, registrado e imutável, e condição sine qua non para uso do sistema.\n\n---\n\n**New Line Iluminação LTDA** — CNPJ 12.077.181/0001-33\nInscrição Estadual: 672.000.173.110\nRua Sonia, 101, Jardim Aeródromo Internacional — Suzano/SP — CEP 08616-520\nContato: nfegruponewline@newline.ind.br — (11) 4751-6350',
  'Nova versão v1.1: passa a garantir de forma absoluta que nenhum humano acessa valores monetários brutos. Inclui obrigatoriedade de MFA para administradores, marca d''água nas telas sensíveis e novos direitos LGPD com registro imutável.',
  true,
  now(),
  true,
  'v1.1 substitui a v1.0 com frase absoluta sobre acesso a valores monetários, obrigatoriedade de MFA para administradores, marca d''água em telas sensíveis e novos processos LGPD.'
);

-- FASE 4: registro imutável de expurgo LGPD
CREATE TABLE IF NOT EXISTS public.data_purge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('revoke_sessions','anonymize','delete')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  justificativa text NOT NULL CHECK (length(justificativa) >= 10),
  status text NOT NULL DEFAULT 'executado' CHECK (status IN ('executado','falhou')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.data_purge_requests TO authenticated;
GRANT ALL ON public.data_purge_requests TO service_role;
ALTER TABLE public.data_purge_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem historico completo" ON public.data_purge_requests;
CREATE POLICY "Admins veem historico completo"
  ON public.data_purge_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_log_purge_action(
  _target_user_id uuid,
  _request_type text,
  _justificativa text,
  _status text DEFAULT 'executado',
  _error text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid; _target_email text; _requester_email text; _uid uuid := auth.uid();
BEGIN
  IF NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF length(coalesce(_justificativa,'')) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;
  SELECT email INTO _target_email FROM auth.users WHERE id = _target_user_id;
  SELECT email INTO _requester_email FROM auth.users WHERE id = _uid;
  INSERT INTO public.data_purge_requests(
    target_user_id, target_email, request_type,
    requested_by, requester_email, justificativa,
    status, error_message, metadata
  ) VALUES (
    _target_user_id, COALESCE(_target_email,'desconhecido'), _request_type,
    _uid, COALESCE(_requester_email,'desconhecido'), _justificativa,
    _status, _error, COALESCE(_metadata,'{}'::jsonb)
  ) RETURNING id INTO _id;
  PERFORM log_security_event(
    'lgpd_purge', _request_type, _target_email, _status,
    CASE WHEN _request_type='delete' THEN 'alto' ELSE 'medio' END,
    jsonb_build_object('target_user_id', _target_user_id, 'purge_id', _id)
  );
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_log_purge_action(uuid,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_purge_action(uuid,text,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_anonymize_profile(_target_user_id uuid, _justificativa text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.profiles
    SET full_name = 'Usuário anonimizado',
        email = 'anon-' || substr(md5(id::text || now()::text), 1, 12) || '@anonimizado.local'
    WHERE id = _target_user_id;
  PERFORM admin_log_purge_action(_target_user_id, 'anonymize', _justificativa, 'executado', NULL, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_anonymize_profile(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_anonymize_profile(uuid,text) TO authenticated;
