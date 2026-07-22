
-- ============ TERMS VERSIONS ============
CREATE TABLE public.terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  summary_content text,
  published_at timestamptz NOT NULL DEFAULT now(),
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  change_summary text,
  requires_new_acceptance boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  published_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX terms_versions_only_one_active
  ON public.terms_versions ((true)) WHERE is_active;

GRANT SELECT ON public.terms_versions TO authenticated;
GRANT ALL ON public.terms_versions TO service_role;

ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read active terms"
  ON public.terms_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins manage terms versions"
  ON public.terms_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_terms_versions_touch
  BEFORE UPDATE ON public.terms_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TERMS ACCEPTANCES ============
CREATE TABLE public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version_id uuid NOT NULL REFERENCES public.terms_versions(id),
  acceptance_type text NOT NULL CHECK (acceptance_type IN ('full_terms_acceptance','login_confidentiality_acknowledgement')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  ip_address text,
  user_agent text,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_terms_acceptances_user ON public.terms_acceptances(user_id, acceptance_type, accepted_at DESC);
CREATE INDEX idx_terms_acceptances_version ON public.terms_acceptances(terms_version_id);

GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own acceptances"
  ON public.terms_acceptances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all acceptances"
  ON public.terms_acceptances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users insert own acceptances"
  ON public.terms_acceptances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Sem policies de UPDATE/DELETE: registros são imutáveis via interface comum.

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  _session_id text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _vid uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id INTO _vid FROM public.terms_versions WHERE is_active LIMIT 1;
  IF _vid IS NULL THEN RAISE EXCEPTION 'Nenhuma versão de termos ativa'; END IF;

  INSERT INTO public.terms_acceptances(user_id, terms_version_id, acceptance_type, session_id, user_agent)
  VALUES (_uid, _vid, 'full_terms_acceptance', _session_id, _user_agent)
  RETURNING id INTO _id;

  PERFORM public.log_security_event(
    'terms_acceptance', 'aceite_integral_termos', 'terms_versions',
    'sucesso', 'info',
    jsonb_build_object('terms_version_id', _vid, 'session_id', _session_id)
  );
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_login_acknowledgement(
  _session_id text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _vid uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id INTO _vid FROM public.terms_versions WHERE is_active LIMIT 1;
  IF _vid IS NULL THEN RAISE EXCEPTION 'Nenhuma versão de termos ativa'; END IF;

  INSERT INTO public.terms_acceptances(user_id, terms_version_id, acceptance_type, session_id, user_agent)
  VALUES (_uid, _vid, 'login_confidentiality_acknowledgement', _session_id, _user_agent)
  RETURNING id INTO _id;

  PERFORM public.log_security_event(
    'login_ack', 'ciencia_confidencialidade', 'terms_versions',
    'sucesso', 'info',
    jsonb_build_object('terms_version_id', _vid, 'session_id', _session_id)
  );
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_terms_status()
RETURNS TABLE(
  active_version_id uuid,
  active_version text,
  active_published_at timestamptz,
  active_effective_at timestamptz,
  status text,
  last_accepted_at timestamptz,
  last_accepted_version text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _active record;
  _last record;
BEGIN
  SELECT * INTO _active FROM public.terms_versions WHERE is_active LIMIT 1;
  IF _active.id IS NULL THEN
    RETURN;
  END IF;

  SELECT a.accepted_at, v.version, a.terms_version_id
    INTO _last
  FROM public.terms_acceptances a
  JOIN public.terms_versions v ON v.id = a.terms_version_id
  WHERE a.user_id = _uid
    AND a.acceptance_type = 'full_terms_acceptance'
    AND a.revoked_at IS NULL
  ORDER BY a.accepted_at DESC LIMIT 1;

  active_version_id := _active.id;
  active_version := _active.version;
  active_published_at := _active.published_at;
  active_effective_at := _active.effective_at;
  last_accepted_at := _last.accepted_at;
  last_accepted_version := _last.version;

  IF _last.terms_version_id IS NULL THEN
    status := 'aceite_pendente';
  ELSIF _last.terms_version_id = _active.id THEN
    status := 'aceito';
  ELSE
    status := 'nova_versao_disponivel';
  END IF;

  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_terms_conformidade()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  role app_role,
  active_version text,
  accepted_version text,
  accepted_at timestamptz,
  last_login_ack_at timestamptz,
  status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _active_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT id INTO _active_id FROM public.terms_versions WHERE is_active LIMIT 1;

  RETURN QUERY
  WITH last_full AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, a.terms_version_id, a.accepted_at, v.version
    FROM public.terms_acceptances a
    JOIN public.terms_versions v ON v.id = a.terms_version_id
    WHERE a.acceptance_type = 'full_terms_acceptance' AND a.revoked_at IS NULL
    ORDER BY a.user_id, a.accepted_at DESC
  ),
  last_ack AS (
    SELECT DISTINCT ON (user_id) user_id, accepted_at
    FROM public.terms_acceptances
    WHERE acceptance_type = 'login_confidentiality_acknowledgement'
    ORDER BY user_id, accepted_at DESC
  ),
  active AS (SELECT version FROM public.terms_versions WHERE id = _active_id)
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name')::text,
    ur.role,
    (SELECT version FROM active),
    lf.version,
    lf.accepted_at,
    la.accepted_at,
    CASE
      WHEN lf.terms_version_id IS NULL THEN 'aceite_pendente'
      WHEN lf.terms_version_id = _active_id THEN 'aceito'
      ELSE 'nova_versao_disponivel'
    END
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN last_full lf ON lf.user_id = u.id
  LEFT JOIN last_ack la ON la.user_id = u.id
  ORDER BY u.created_at DESC;
END $$;

-- ============ SEED v1.0 ============
INSERT INTO public.terms_versions(version, title, content, is_active, change_summary, requires_new_acceptance)
VALUES (
  '1.0',
  'Termos de Uso, Privacidade e Confidencialidade',
$TERMS$TERMOS DE USO, PRIVACIDADE E CONFIDENCIALIDADE

Versão: 1.0
Responsável pela plataforma: New Line Iluminação LTDA
CNPJ: 12.077.181/0001-33
Endereço: Rua Sonia, 101 — Jardim Aerodromo Internacional — Suzano/SP — CEP 08616-520
Canal de contato: nfegruponewline@newline.ind.br — Fone (11) 4751-6350
Inscrição Estadual: 672.000.173.110

1. Objeto
Estes Termos regulam o acesso e a utilização da plataforma Imersão Comercial, destinada à organização, análise e apresentação de informações comerciais, indicadores de desempenho, diagnósticos e conteúdos relacionados à gestão comercial.
A utilização da plataforma está condicionada à leitura, compreensão e aceitação destes Termos.
Ao acessar a plataforma, o usuário declara que possui autorização para utilizar as informações disponibilizadas e que se compromete a respeitar as regras de segurança, privacidade e confidencialidade.

2. Usuários abrangidos
Estes Termos aplicam-se a todos os usuários internos e externos, incluindo funcionários, gestores, diretores, administradores, consultores, fornecedores, prestadores de serviços, representantes comerciais próprios, contratados ou autônomos, parceiros autorizados e demais pessoas que recebam acesso à plataforma.
O vínculo profissional, comercial, contratual ou institucional não concede acesso irrestrito às informações.

3. Natureza confidencial das informações
A plataforma contém informações estratégicas, comerciais, operacionais, gerenciais e técnicas de caráter reservado.
São consideradas confidenciais todas as informações relacionadas a vendas, faturamento, metas, preços, custos, margens, volumes, comissões, clientes, fornecedores, representantes comerciais, carteiras, produtos, canais, regiões, relatórios, indicadores, projeções, comparativos, metodologias, processos, configurações, regras de negócio, credenciais e estruturas técnicas.
A obrigação de confidencialidade permanecerá válida após o encerramento do acesso ou da relação profissional, contratual ou comercial.

4. Utilização de faixas percentuais
A plataforma adota como princípio a não exposição de valores empresariais absolutos.
Sempre que aplicável, os indicadores deverão ser apresentados por meio de faixas percentuais, classificações, índices relativos, status e informações agregadas.
A apresentação por faixas não autoriza o usuário a tentar identificar, deduzir, calcular ou reconstruir os valores absolutos utilizados na formação dos indicadores.

5. Tratamento de dados empresariais diretos
Quando valores diretos forem tecnicamente necessários para o processamento, eles deverão ser tratados exclusivamente pelos componentes autorizados da plataforma.
Esses dados não deverão ser exibidos nas telas, relatórios, exportações, painéis administrativos funcionais, mensagens de erro, URLs, registros acessíveis aos usuários, ferramentas externas não autorizadas ou recursos de inteligência artificial.

6. Acesso administrativo
Os dados protegidos não são disponibilizados nos painéis administrativos funcionais e seu acesso é limitado aos componentes técnicos estritamente necessários ao processamento autorizado.
Os painéis administrativos permitem somente gestão de usuários, permissões, organizações, configurações autorizadas, consulta de registros de conformidade e consulta de registros de segurança sanitizados.
Atividades de desenvolvimento, teste, manutenção e suporte deverão utilizar dados sintéticos, mascarados ou descaracterizados sempre que possível.

7. Obrigações do usuário
O usuário compromete-se a utilizar a plataforma somente para finalidades profissionais autorizadas; manter suas credenciais em sigilo; não permitir que terceiros utilizem sua conta; respeitar os níveis de acesso concedidos; preservar a confidencialidade das informações; comunicar imediatamente qualquer suspeita de acesso indevido; utilizar somente meios autorizados para consulta e compartilhamento; encerrar ou bloquear a sessão quando se afastar do dispositivo; manter seus dispositivos adequadamente protegidos; e não inserir dados confidenciais em campos inadequados.

8. Condutas proibidas
É proibido fotografar, gravar, copiar ou reproduzir telas sem autorização; compartilhar informações com pessoas não autorizadas; publicar conteúdos em redes sociais, mensagens ou serviços externos; inserir valores diretos em comentários ou campos não autorizados; tentar reconstruir valores absolutos; combinar informações com fontes externas para identificar dados protegidos; utilizar ferramentas automatizadas para extração; contornar controles de acesso; compartilhar credenciais ou sessões; explorar falhas ou vulnerabilidades; consultar clientes, carteiras ou regiões não autorizadas; exportar bases brutas; e utilizar informações para concorrência ou prospecção própria.

9. Fornecedores, prestadores e representantes comerciais
Fornecedores, prestadores de serviços e representantes comerciais somente poderão acessar informações quando isso for necessário ao desempenho de suas atividades autorizadas.
Representantes comerciais deverão acessar somente as informações relacionadas à sua carteira, região ou responsabilidade comercial.
Fornecedores e prestadores deverão acessar somente os recursos relacionados ao serviço contratado.
É proibida a utilização dos dados para publicidade própria, prospecção não autorizada, enriquecimento de bases, formação de listas comerciais, treinamento de inteligência artificial, compartilhamento com terceiros ou qualquer finalidade diferente daquela que justificou o acesso.

10. Registro e auditoria
A plataforma poderá registrar acessos e ações realizadas para segurança, prevenção de fraudes, investigação de incidentes, auditoria e cumprimento de obrigações legais e contratuais.
Os registros de auditoria não deverão armazenar valores empresariais diretos, senhas, tokens ou conteúdos integrais das planilhas processadas.

11. Proteção de dados pessoais
O tratamento de dados pessoais deverá observar a legislação aplicável e limitar-se às finalidades necessárias para autenticação, controle de acesso, segurança, suporte, auditoria, execução dos serviços e cumprimento de obrigações legais e contratuais.
Solicitações relacionadas a dados pessoais deverão ser encaminhadas ao canal oficial indicado nestes Termos.

12. Comunicação de incidentes
O usuário deverá comunicar imediatamente qualquer acesso não reconhecido, compartilhamento acidental, envio incorreto, perda de dispositivo, suspeita de captura de credenciais, vulnerabilidade, exposição indevida ou tentativa de acesso a dados não autorizados.
O usuário não deverá explorar, divulgar ou ampliar uma vulnerabilidade identificada.

13. Propriedade intelectual
A plataforma, sua estrutura, identidade visual, metodologia, textos, relatórios, códigos, modelos de análise, funcionalidades e regras de negócio são protegidos pela legislação aplicável.
O acesso não transfere ao usuário qualquer direito de propriedade, reprodução, distribuição, comercialização ou exploração.

14. Suspensão e bloqueio
O acesso poderá ser suspenso ou bloqueado quando houver descumprimento destes Termos, compartilhamento de credenciais, tentativa de acesso indevido, extração não autorizada, exposição de informações, uso incompatível com a finalidade da plataforma, encerramento do vínculo profissional ou comercial, ou risco à segurança da organização.

15. Responsabilização
O usuário será responsável pelos atos praticados com sua conta quando decorrentes de ação, omissão, negligência, compartilhamento de credenciais ou descumprimento das medidas de segurança.
A violação poderá resultar em suspensão ou cancelamento do acesso, comunicação à organização responsável, aplicação de medidas disciplinares ou contratuais, responsabilização por perdas e danos, e adoção de medidas administrativas, civis ou criminais cabíveis.

16. Disponibilidade e limitações
A organização responsável adotará medidas técnicas e administrativas para preservar a segurança, integridade e disponibilidade da plataforma.
A segurança depende da combinação entre arquitetura, controles de acesso, governança, monitoramento e conduta dos usuários.
A plataforma não deverá ser utilizada como única fonte para decisões que exijam validação contábil, fiscal, jurídica ou financeira formal.

17. Atualização dos Termos
Estes Termos poderão ser atualizados em razão de mudanças legais, técnicas, operacionais, contratuais, institucionais ou de segurança.
Quando houver nova versão relevante, o usuário deverá realizar novo aceite antes de continuar utilizando a plataforma.

18. Legislação e foro
Estes Termos serão interpretados de acordo com a legislação brasileira.
Fica eleito o foro da comarca de Suzano/SP, ressalvadas as hipóteses em que a legislação determinar competência diferente.

19. Declaração de aceite
Ao aceitar estes Termos, o usuário declara que leu e compreendeu seu conteúdo, reconhece a natureza confidencial das informações, compromete-se a não revelar ou reconstruir dados diretos, concorda com o registro de ações para segurança e auditoria, reconhece que seu acesso é pessoal e intransferível e está ciente das consequências do descumprimento.$TERMS$,
  true,
  'Publicação inicial dos Termos de Uso, Privacidade e Confidencialidade.',
  true
);
