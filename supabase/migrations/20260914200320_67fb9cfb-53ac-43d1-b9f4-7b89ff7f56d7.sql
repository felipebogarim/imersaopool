
-- ============ CENTROS DE CUSTO ============
CREATE TABLE public.trade_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_cost_centers TO authenticated;
GRANT ALL ON public.trade_cost_centers TO service_role;
ALTER TABLE public.trade_cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_cost_centers_company" ON public.trade_cost_centers FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- ============ CATEGORIAS DE INVESTIMENTO ============
CREATE TABLE public.trade_investment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  nome text NOT NULL,
  rateavel boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_investment_categories TO authenticated;
GRANT ALL ON public.trade_investment_categories TO service_role;
ALTER TABLE public.trade_investment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_investment_categories_company" ON public.trade_investment_categories FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- ============ VIAGENS ============
CREATE TABLE public.trade_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  titulo text NOT NULL,
  cidade text,
  data_inicio date NOT NULL,
  data_fim date,
  responsavel_id uuid,
  observacoes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_trips TO authenticated;
GRANT ALL ON public.trade_trips TO service_role;
ALTER TABLE public.trade_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_trips_company" ON public.trade_trips FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- ============ AÇÕES ============
CREATE TABLE public.trade_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  trip_id uuid REFERENCES public.trade_trips(id) ON DELETE SET NULL,
  tipo_acao text NOT NULL,
  tipo_acao_outro text,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date,
  horario text,
  cidade text,
  status text NOT NULL DEFAULT 'planejado',
  responsavel_id uuid,
  representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.trade_cost_centers(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_actions TO authenticated;
GRANT ALL ON public.trade_actions TO service_role;
ALTER TABLE public.trade_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_actions_company" ON public.trade_actions FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());
CREATE INDEX trade_actions_data_idx ON public.trade_actions (company_id, data_inicio);

-- ============ CLIENTES DA AÇÃO ============
CREATE TABLE public.trade_action_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  action_id uuid NOT NULL REFERENCES public.trade_actions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (action_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_action_clients TO authenticated;
GRANT ALL ON public.trade_action_clients TO service_role;
ALTER TABLE public.trade_action_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_action_clients_company" ON public.trade_action_clients FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- ============ INVESTIMENTOS ============
CREATE TABLE public.trade_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  action_id uuid REFERENCES public.trade_actions(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trade_trips(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  category_id uuid REFERENCES public.trade_investment_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.trade_cost_centers(id) ON DELETE SET NULL,
  data date,
  valor_planejado numeric(14,2) NOT NULL DEFAULT 0,
  valor_realizado numeric(14,2),
  status text NOT NULL DEFAULT 'planejado',
  observacao text,
  anexo_path text,
  rateado boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_investments_parent_chk CHECK (action_id IS NOT NULL OR trip_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_investments TO authenticated;
GRANT ALL ON public.trade_investments TO service_role;
ALTER TABLE public.trade_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_investments_company" ON public.trade_investments FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- ============ RATEIOS ============
CREATE TABLE public.trade_investment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  investment_id uuid NOT NULL REFERENCES public.trade_investments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  valor_planejado numeric(14,2) NOT NULL DEFAULT 0,
  valor_realizado numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investment_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_investment_allocations TO authenticated;
GRANT ALL ON public.trade_investment_allocations TO service_role;
ALTER TABLE public.trade_investment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_investment_allocations_company" ON public.trade_investment_allocations FOR ALL TO authenticated
  USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER trg_trade_cost_centers_upd BEFORE UPDATE ON public.trade_cost_centers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trade_inv_categories_upd BEFORE UPDATE ON public.trade_investment_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trade_trips_upd BEFORE UPDATE ON public.trade_trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trade_actions_upd BEFORE UPDATE ON public.trade_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trade_investments_upd BEFORE UPDATE ON public.trade_investments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEMENTES POR EMPRESA ============
INSERT INTO public.trade_cost_centers (company_id, nome)
SELECT c.id, n.nome
FROM public.companies c
CROSS JOIN (VALUES ('Trade Marketing'),('Comercial'),('Marketing'),('Eventos'),('Treinamentos'),('Relacionamento'),('Viagens'),('Showroom'),('PDV'),('Representantes')) AS n(nome);

INSERT INTO public.trade_investment_categories (company_id, nome, rateavel)
SELECT c.id, n.nome, n.rateavel
FROM public.companies c
CROSS JOIN (VALUES
  ('Material promocional', false),('Brindes', false),('Coffee break', false),('Alimentação', true),
  ('Locação de espaço', false),('Estrutura de evento', false),('Equipamentos', false),('Comunicação visual', false),
  ('Material de PDV', false),('Produtos para demonstração', false),('Amostras', false),('Premiação', false),
  ('Patrocínio', false),('Hospedagem', true),('Passagem aérea', true),('Deslocamento de automóvel', true),
  ('Táxi / aplicativo', true),('Pedágio', true),('Estacionamento', true),('Combustível', true),
  ('Transporte', true),('Outros', false)
) AS n(nome, rateavel);
