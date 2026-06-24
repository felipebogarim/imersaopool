
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'agente');
CREATE TYPE public.client_group AS ENUM ('G1', 'G2', 'G2+', 'Corporativo');
CREATE TYPE public.client_category AS ENUM ('Black', 'Gold', 'Silver');
CREATE TYPE public.client_status AS ENUM ('ativo', 'inativo', 'prospect');
CREATE TYPE public.immersion_status AS ENUM ('planejada','antes_visita','visita_campo','em_diagnostico','diagnostico_gerado','plano_acao','concluida');
CREATE TYPE public.action_priority AS ENUM ('alta','media','baixa');
CREATE TYPE public.action_status AS ENUM ('pendente','em_andamento','concluida','cancelada');
CREATE TYPE public.equivalence_grade AS ENUM ('igual','similar','substituto');
CREATE TYPE public.ai_compilation_type AS ENUM ('representante','visita','price','diagnostico_final');

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  cargo TEXT,
  regiao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gestor'))
$$;

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agente');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profile policies
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- user_roles policies
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ===== REPRESENTATIVES =====
CREATE TABLE public.representatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  regiao TEXT,
  tempo_relacionamento TEXT,
  outras_marcas TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.representatives TO authenticated;
GRANT ALL ON public.representatives TO service_role;
ALTER TABLE public.representatives ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_reps_updated BEFORE UPDATE ON public.representatives FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "reps_all_auth" ON public.representatives FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== CLIENTS =====
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  documento TEXT,
  grupo client_group,
  categoria client_category,
  cidade TEXT,
  estado TEXT,
  regiao TEXT,
  endereco TEXT,
  nome_comprador TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  representative_id UUID REFERENCES public.representatives(id) ON DELETE SET NULL,
  agente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status client_status NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_clients_agente ON public.clients(agente_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE POLICY "clients_select_all" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert_auth" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "clients_update_owner_or_mgr" ON public.clients FOR UPDATE TO authenticated
  USING (agente_id = auth.uid() OR created_by = auth.uid() OR public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "clients_delete_mgr" ON public.clients FOR DELETE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()));

-- ===== IMMERSIONS =====
CREATE TABLE public.immersions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  representative_id UUID REFERENCES public.representatives(id) ON DELETE SET NULL,
  status immersion_status NOT NULL DEFAULT 'planejada',
  data_visita DATE,
  representative_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  representative_token_expires_at TIMESTAMPTZ DEFAULT (now() + interval '60 days'),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.immersions TO authenticated;
GRANT ALL ON public.immersions TO service_role;
ALTER TABLE public.immersions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_imm_updated BEFORE UPDATE ON public.immersions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_imm_client ON public.immersions(client_id);
CREATE INDEX idx_imm_status ON public.immersions(status);
CREATE POLICY "imm_select_all" ON public.immersions FOR SELECT TO authenticated USING (true);
CREATE POLICY "imm_insert" ON public.immersions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "imm_update" ON public.immersions FOR UPDATE TO authenticated
  USING (agente_id = auth.uid() OR created_by = auth.uid() OR public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "imm_delete" ON public.immersions FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- ===== ATTACHMENTS (generic, scoped by entity) =====
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_att_entity ON public.attachments(entity_type, entity_id);
CREATE POLICY "att_select" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "att_ins" ON public.attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "att_del" ON public.attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.is_admin_or_gestor(auth.uid()));

-- ===== REPRESENTATIVE INPUTS (public via token) =====
CREATE TABLE public.representative_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immersion_id UUID NOT NULL REFERENCES public.immersions(id) ON DELETE CASCADE,
  texto_livre TEXT,
  percepcao_marca TEXT,
  familias_mais_compradas TEXT,
  motivo_compra TEXT,
  potencial_aumento TEXT,
  marcas_concorrentes TEXT,
  oportunidades TEXT,
  ameacas TEXT,
  acoes_faturamento TEXT,
  cuidados TEXT,
  abordagem_diferente TEXT,
  perfil_comprador TEXT,
  negociacao TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.representative_inputs TO authenticated;
GRANT ALL ON public.representative_inputs TO service_role;
ALTER TABLE public.representative_inputs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_rep_in_updated BEFORE UPDATE ON public.representative_inputs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_rep_in_imm ON public.representative_inputs(immersion_id);
CREATE POLICY "rep_in_auth_all" ON public.representative_inputs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== FIELD VISIT INPUTS =====
CREATE TABLE public.field_visit_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immersion_id UUID NOT NULL REFERENCES public.immersions(id) ON DELETE CASCADE,
  texto TEXT,
  observacoes_comerciais TEXT,
  observacoes_exposicao TEXT,
  observacoes_concorrentes TEXT,
  observacoes_loja TEXT,
  oportunidades TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_visit_inputs TO authenticated;
GRANT ALL ON public.field_visit_inputs TO service_role;
ALTER TABLE public.field_visit_inputs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fvi_imm ON public.field_visit_inputs(immersion_id);
CREATE POLICY "fvi_all" ON public.field_visit_inputs FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== PRICE: competitors, products, equivalences =====
CREATE TABLE public.price_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  regiao TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_competitors TO authenticated;
GRANT ALL ON public.price_competitors TO service_role;
ALTER TABLE public.price_competitors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pc_upd BEFORE UPDATE ON public.price_competitors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "pc_all" ON public.price_competitors FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.own_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno TEXT,
  nome TEXT NOT NULL,
  familia TEXT,
  categoria TEXT,
  preco_base NUMERIC(12,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.own_products TO authenticated;
GRANT ALL ON public.own_products TO service_role;
ALTER TABLE public.own_products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_op_upd BEFORE UPDATE ON public.own_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "op_all" ON public.own_products FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.competitor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.price_competitors(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  familia TEXT,
  categoria TEXT,
  preco_informado NUMERIC(12,2),
  data_tabela DATE,
  arquivo_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_products TO authenticated;
GRANT ALL ON public.competitor_products TO service_role;
ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cp_upd BEFORE UPDATE ON public.competitor_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "cp_all" ON public.competitor_products FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.product_equivalences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  own_product_id UUID NOT NULL REFERENCES public.own_products(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  grau equivalence_grade NOT NULL DEFAULT 'similar',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(own_product_id, competitor_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_equivalences TO authenticated;
GRANT ALL ON public.product_equivalences TO service_role;
ALTER TABLE public.product_equivalences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_all" ON public.product_equivalences FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== AI COMPILATIONS =====
CREATE TABLE public.ai_compilations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immersion_id UUID REFERENCES public.immersions(id) ON DELETE CASCADE,
  tipo ai_compilation_type NOT NULL,
  conteudo JSONB NOT NULL,
  modelo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_compilations TO authenticated;
GRANT ALL ON public.ai_compilations TO service_role;
ALTER TABLE public.ai_compilations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_aic_imm ON public.ai_compilations(immersion_id, tipo);
CREATE POLICY "aic_all" ON public.ai_compilations FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== ACTION PLANS =====
CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immersion_id UUID NOT NULL REFERENCES public.immersions(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  responsavel UUID REFERENCES auth.users(id),
  prioridade action_priority NOT NULL DEFAULT 'media',
  prazo DATE,
  status action_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ap_upd BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ap_imm ON public.action_plans(immersion_id);
CREATE POLICY "ap_all" ON public.action_plans FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Public token access for representative form =====
CREATE OR REPLACE FUNCTION public.get_immersion_by_token(_token TEXT)
RETURNS TABLE (
  immersion_id UUID, titulo TEXT, client_name TEXT, representative_name TEXT,
  expires_at TIMESTAMPTZ, already_submitted BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.titulo, c.nome_fantasia, r.nome,
         i.representative_token_expires_at,
         EXISTS(SELECT 1 FROM representative_inputs ri WHERE ri.immersion_id = i.id AND ri.submitted_at IS NOT NULL)
  FROM immersions i
  JOIN clients c ON c.id = i.client_id
  LEFT JOIN representatives r ON r.id = i.representative_id
  WHERE i.representative_token = _token
    AND (i.representative_token_expires_at IS NULL OR i.representative_token_expires_at > now());
$$;
GRANT EXECUTE ON FUNCTION public.get_immersion_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_representative_input(
  _token TEXT, _data JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _imm_id UUID; _input_id UUID;
BEGIN
  SELECT id INTO _imm_id FROM immersions
  WHERE representative_token = _token
    AND (representative_token_expires_at IS NULL OR representative_token_expires_at > now());
  IF _imm_id IS NULL THEN RAISE EXCEPTION 'Token inválido ou expirado'; END IF;

  INSERT INTO representative_inputs (
    immersion_id, texto_livre, percepcao_marca, familias_mais_compradas,
    motivo_compra, potencial_aumento, marcas_concorrentes, oportunidades, ameacas,
    acoes_faturamento, cuidados, abordagem_diferente, perfil_comprador, negociacao,
    submitted_at
  ) VALUES (
    _imm_id,
    _data->>'texto_livre', _data->>'percepcao_marca', _data->>'familias_mais_compradas',
    _data->>'motivo_compra', _data->>'potencial_aumento', _data->>'marcas_concorrentes',
    _data->>'oportunidades', _data->>'ameacas', _data->>'acoes_faturamento',
    _data->>'cuidados', _data->>'abordagem_diferente', _data->>'perfil_comprador',
    _data->>'negociacao', now()
  ) RETURNING id INTO _input_id;

  UPDATE immersions SET status = 'antes_visita' WHERE id = _imm_id AND status = 'planejada';
  RETURN _input_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_representative_input(TEXT, JSONB) TO anon, authenticated;
