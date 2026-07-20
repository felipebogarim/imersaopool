
-- Fase 3: Proteção de Dados e Segurança de Arquivos

-- Classificação de dados por tabela/domínio
CREATE TABLE public.data_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio text NOT NULL,
  descricao text,
  tabelas text[] NOT NULL DEFAULT '{}',
  sensibilidade text NOT NULL DEFAULT 'interno' CHECK (sensibilidade IN ('publico','interno','confidencial','restrito','sensivel_lgpd')),
  base_legal text,
  retencao_dias int,
  criptografia text DEFAULT 'em_transito_e_repouso',
  responsavel text,
  observacoes text,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_classifications TO authenticated;
GRANT ALL ON public.data_classifications TO service_role;
ALTER TABLE public.data_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage data_classifications" ON public.data_classifications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_data_classifications_updated BEFORE UPDATE ON public.data_classifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Eventos de segurança em arquivos
CREATE TABLE public.file_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  path text NOT NULL,
  evento text NOT NULL CHECK (evento IN ('upload','download','delete','share_link','acesso_negado','anomalia')),
  usuario_id uuid,
  usuario_email text,
  tamanho_bytes bigint,
  mimetype text,
  metadata jsonb DEFAULT '{}'::jsonb,
  nivel_risco text DEFAULT 'info' CHECK (nivel_risco IN ('info','baixo','medio','alto','critico')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_security_events TO authenticated;
GRANT ALL ON public.file_security_events TO service_role;
ALTER TABLE public.file_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage file_security_events" ON public.file_security_events
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_file_sec_events_created ON public.file_security_events(created_at DESC);
CREATE INDEX idx_file_sec_events_bucket ON public.file_security_events(bucket);

-- Seeds iniciais de classificação (baseado nas tabelas atuais)
INSERT INTO public.data_classifications (dominio, descricao, tabelas, sensibilidade, base_legal, retencao_dias, responsavel) VALUES
('Perfis e Autenticação','Dados de identificação de usuários da plataforma',ARRAY['profiles','user_roles'],'sensivel_lgpd','Execução de contrato / Consentimento',1825,'Encarregado LGPD'),
('Clientes','Base de clientes e informações comerciais',ARRAY['clients'],'confidencial','Legítimo interesse comercial',2555,'Comercial'),
('Representantes','Dados de representantes comerciais',ARRAY['representatives','representative_inputs','rep_bi_uploads','rep_performance_uploads','rep_performance_rows'],'confidencial','Execução de contrato',2555,'Comercial'),
('BI e Performance','Dados brutos e agregados de vendas',ARRAY['client_bi_uploads','rep_bi_uploads','rep_performance_rows','gerador_performance_salvos'],'restrito','Legítimo interesse',1825,'Comercial'),
('Imersões e Insights','Registros de imersões, entrevistas e perspectivas estratégicas',ARRAY['immersions','interviews','perspectivas','sessao_capitulos','sessao_capitulo_itens','ai_compilations'],'confidencial','Legítimo interesse',3650,'Estratégia'),
('Gestão de Tarefas','Boards kanban, cards, comentários',ARRAY['kanban_workspaces','kanban_boards','kanban_lists','kanban_cards','kanban_comments','kanban_attachments'],'interno','Execução de contrato',1095,'Operações'),
('Formulários e Respostas','Respostas coletadas em formulários públicos',ARRAY['forms','form_responses'],'confidencial','Consentimento',1825,'Encarregado LGPD'),
('Segurança','Eventos, riscos, incidentes e auditorias',ARRAY['security_events','security_risks','security_incidents','security_audits','security_audit_checks','file_security_events'],'restrito','Obrigação legal / LGPD',3650,'Encarregado LGPD');
