-- ============ ENUMS ============
CREATE TYPE public.price_equivalence_level AS ENUM ('direto','aproximado','alternativo','incompativel','insuficiente');
CREATE TYPE public.price_equivalence_status AS ENUM ('em_analise','validado','incompativel');
CREATE TYPE public.price_confidence AS ENUM (
  'catalogo','tabela_precos','ficha_tecnica','fornecedor','excel','pdf','ocr',
  'herdado','estimado','manual','nao_informado','pendente'
);
CREATE TYPE public.price_import_status AS ENUM ('pendente','processando','processado','erro');
CREATE TYPE public.price_review_status AS ENUM ('pendente','aprovado','corrigido','rejeitado','ignorado');

-- ============ PRODUCTS ============
CREATE TABLE public.price_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  competitor_id uuid REFERENCES public.price_competitors(id) ON DELETE SET NULL,
  marca text NOT NULL,
  is_base boolean NOT NULL DEFAULT false,
  familia text NOT NULL DEFAULT 'Fitas e Fontes',
  categoria text NOT NULL DEFAULT 'Fitas LED',
  tipo text,
  sku text,
  referencia text,
  nome text NOT NULL,
  descricao text,
  imagem_url text,
  status text NOT NULL DEFAULT 'ativo',
  source_file text,
  source_page int,
  source_date date,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_products_company_idx ON public.price_products(company_id, familia, categoria);
CREATE INDEX price_products_marca_idx ON public.price_products(company_id, marca);
CREATE UNIQUE INDEX price_products_unique_sku ON public.price_products(company_id, marca, coalesce(sku,''), coalesce(referencia,'')) WHERE is_deleted = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_products TO authenticated;
GRANT ALL ON public.price_products TO service_role;
ALTER TABLE public.price_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_products_read" ON public.price_products FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_products_write" ON public.price_products FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

-- ============ SPECS ============
CREATE TABLE public.price_product_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  product_id uuid NOT NULL REFERENCES public.price_products(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  attribute_name text,
  original_value text,
  normalized_value text,
  value_numeric numeric,
  value_text text,
  original_unit text,
  normalized_unit text,
  source_type text,
  source_file text,
  source_page int,
  extraction_method text,
  confidence_level public.price_confidence NOT NULL DEFAULT 'nao_informado',
  manually_reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, attribute_key)
);
CREATE INDEX price_specs_product_idx ON public.price_product_specs(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_product_specs TO authenticated;
GRANT ALL ON public.price_product_specs TO service_role;
ALTER TABLE public.price_product_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_specs_read" ON public.price_product_specs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_specs_write" ON public.price_product_specs FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

-- ============ PRICES ============
CREATE TABLE public.price_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  product_id uuid NOT NULL REFERENCES public.price_products(id) ON DELETE CASCADE,
  price numeric,
  price_with_tax numeric,
  price_without_tax numeric,
  price_unit text,
  price_per_meter numeric,
  price_per_watt numeric,
  price_per_1000_lumens numeric,
  price_availability text NOT NULL DEFAULT 'informado',
  state text,
  region text,
  currency text NOT NULL DEFAULT 'BRL',
  price_list_name text,
  effective_date date,
  expiration_date date,
  source_file text,
  source_page int,
  confidence_level public.price_confidence NOT NULL DEFAULT 'nao_informado',
  status text NOT NULL DEFAULT 'atual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_prices_product_idx ON public.price_product_prices(product_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_product_prices TO authenticated;
GRANT ALL ON public.price_product_prices TO service_role;
ALTER TABLE public.price_product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_prices_read" ON public.price_product_prices FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_prices_write" ON public.price_product_prices FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

-- ============ RULES ============
CREATE TABLE public.price_comparison_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  familia text NOT NULL,
  categoria text NOT NULL,
  tipo text,
  attribute_key text NOT NULL,
  attribute_name text NOT NULL,
  weight numeric NOT NULL DEFAULT 0,
  tolerance_direct numeric NOT NULL DEFAULT 5,
  tolerance_approximate numeric NOT NULL DEFAULT 15,
  is_critical boolean NOT NULL DEFAULT false,
  is_eliminatory boolean NOT NULL DEFAULT false,
  missing_data_penalty numeric NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX price_rules_unique ON public.price_comparison_rules(coalesce(company_id,'00000000-0000-0000-0000-000000000000'::uuid), familia, categoria, attribute_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_comparison_rules TO authenticated;
GRANT ALL ON public.price_comparison_rules TO service_role;
ALTER TABLE public.price_comparison_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_rules_read" ON public.price_comparison_rules FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.current_company_id());
CREATE POLICY "price_rules_write" ON public.price_comparison_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.price_comparison_rules (familia, categoria, attribute_key, attribute_name, weight, tolerance_direct, tolerance_approximate, is_critical, is_eliminatory) VALUES
 ('Fitas e Fontes','Fitas LED','tecnologia','Tecnologia',15,0,0,true,true),
 ('Fitas e Fontes','Fitas LED','tensao','Tensão',15,0,0,true,true),
 ('Fitas e Fontes','Fitas LED','potencia_m','Potência / m',10,5,15,false,false),
 ('Fitas e Fontes','Fitas LED','fluxo_m','Fluxo luminoso / m',15,5,15,true,false),
 ('Fitas e Fontes','Fitas LED','irc','IRC',10,5,15,false,false),
 ('Fitas e Fontes','Fitas LED','cct','CCT',10,0,10,true,true),
 ('Fitas e Fontes','Fitas LED','ip','IP',8,0,0,true,false),
 ('Fitas e Fontes','Fitas LED','eficiencia','Eficiência',5,5,15,false,false),
 ('Fitas e Fontes','Fitas LED','leds_m','LEDs por metro',4,10,25,false,false),
 ('Fitas e Fontes','Fitas LED','largura','Largura',3,10,25,false,false),
 ('Fitas e Fontes','Fitas LED','cut_size','Corte',2,10,30,false,false),
 ('Fitas e Fontes','Fitas LED','sdcm','SDCM',1,0,50,false,false),
 ('Fitas e Fontes','Fitas LED','bobina','Bobina',1,10,50,false,false),
 ('Fitas e Fontes','Fitas LED','vida_util','Vida útil',1,10,30,false,false),
 ('Fitas e Fontes','Fontes e Drivers','tipo_saida','Tipo de saída',15,0,0,true,true),
 ('Fitas e Fontes','Fontes e Drivers','tensao_saida','Tensão de saída',15,0,0,true,true),
 ('Fitas e Fontes','Fontes e Drivers','potencia_utilizavel','Potência utilizável',15,5,15,true,false),
 ('Fitas e Fontes','Fontes e Drivers','corrente_saida','Corrente de saída',10,5,15,false,false),
 ('Fitas e Fontes','Fontes e Drivers','dimerizacao','Dimerização',10,0,0,true,false),
 ('Fitas e Fontes','Fontes e Drivers','ip','IP',8,0,0,true,false),
 ('Fitas e Fontes','Fontes e Drivers','tensao_entrada','Tensão de entrada',5,0,10,false,false),
 ('Fitas e Fontes','Fontes e Drivers','fator_potencia','Fator de potência',5,5,15,false,false),
 ('Fitas e Fontes','Fontes e Drivers','eficiencia','Eficiência',5,5,15,false,false),
 ('Fitas e Fontes','Fontes e Drivers','ripple','Ripple',4,10,30,false,false),
 ('Fitas e Fontes','Fontes e Drivers','protecoes','Proteções',3,0,0,false,false),
 ('Fitas e Fontes','Fontes e Drivers','dimensoes','Dimensões',2,10,30,false,false),
 ('Fitas e Fontes','Fontes e Drivers','vida_util','Vida útil',2,10,30,false,false),
 ('Fitas e Fontes','Fontes e Drivers','garantia','Garantia',1,10,50,false,false);

-- ============ EQUIVALENCES ============
CREATE TABLE public.price_equivalences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  base_product_id uuid NOT NULL REFERENCES public.price_products(id) ON DELETE CASCADE,
  compared_product_id uuid NOT NULL REFERENCES public.price_products(id) ON DELETE CASCADE,
  technical_score numeric,
  price_score numeric,
  cost_benefit_score numeric,
  equivalence_level public.price_equivalence_level NOT NULL DEFAULT 'insuficiente',
  status public.price_equivalence_status NOT NULL DEFAULT 'em_analise',
  technical_differences_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_similarities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_notes text,
  validated_at timestamptz,
  validated_by uuid,
  incompatibility_reason text,
  manually_edited boolean NOT NULL DEFAULT false,
  last_manual_edit_at timestamptz,
  last_manual_edit_by uuid,
  calculation_version text NOT NULL DEFAULT 'v1',
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_product_id, compared_product_id)
);
CREATE INDEX price_equiv_base_idx ON public.price_equivalences(base_product_id, is_deleted);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_equivalences TO authenticated;
GRANT ALL ON public.price_equivalences TO service_role;
ALTER TABLE public.price_equivalences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_equiv_read" ON public.price_equivalences FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_equiv_write" ON public.price_equivalences FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

-- ============ IMPORTS ============
CREATE TABLE public.price_import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  file_name text NOT NULL,
  file_type text,
  document_type text,
  storage_url text,
  uploaded_by uuid DEFAULT auth.uid(),
  processing_status public.price_import_status NOT NULL DEFAULT 'pendente',
  extraction_method text,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_import_files TO authenticated;
GRANT ALL ON public.price_import_files TO service_role;
ALTER TABLE public.price_import_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_import_files_read" ON public.price_import_files FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_import_files_insert" ON public.price_import_files FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "price_import_files_admin" ON public.price_import_files FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "price_import_files_delete" ON public.price_import_files FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

CREATE TABLE public.price_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  import_file_id uuid NOT NULL REFERENCES public.price_import_files(id) ON DELETE CASCADE,
  page_number int,
  sheet_name text,
  row_number int,
  field_name text,
  original_value text,
  normalized_value text,
  confidence_level public.price_confidence NOT NULL DEFAULT 'excel',
  review_status public.price_review_status NOT NULL DEFAULT 'pendente',
  linked_product_id uuid REFERENCES public.price_products(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_import_rows_file_idx ON public.price_import_rows(import_file_id, review_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_import_rows TO authenticated;
GRANT ALL ON public.price_import_rows TO service_role;
ALTER TABLE public.price_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_import_rows_read" ON public.price_import_rows FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_import_rows_insert" ON public.price_import_rows FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "price_import_rows_admin" ON public.price_import_rows FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "price_import_rows_delete" ON public.price_import_rows FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

-- ============ AUDIT ============
CREATE TABLE public.price_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  equivalence_id uuid,
  product_id uuid,
  action text NOT NULL,
  field_name text,
  previous_value text,
  new_value text,
  changed_by uuid DEFAULT auth.uid(),
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_audit_equiv_idx ON public.price_audit_logs(equivalence_id, created_at DESC);
CREATE INDEX price_audit_prod_idx ON public.price_audit_logs(product_id, created_at DESC);
GRANT SELECT, INSERT ON public.price_audit_logs TO authenticated;
GRANT ALL ON public.price_audit_logs TO service_role;
ALTER TABLE public.price_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_audit_read" ON public.price_audit_logs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_audit_insert" ON public.price_audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());

-- ============ SHARES ============
CREATE TABLE public.price_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  base_product_id uuid REFERENCES public.price_products(id) ON DELETE SET NULL,
  shared_by uuid DEFAULT auth.uid(),
  share_channel text NOT NULL,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  company_name text,
  pdf_file_url text,
  pdf_version text,
  included_prices boolean NOT NULL DEFAULT true,
  included_products_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  delivery_status text NOT NULL DEFAULT 'gerado',
  shared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.price_shares TO authenticated;
GRANT ALL ON public.price_shares TO service_role;
ALTER TABLE public.price_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_shares_read" ON public.price_shares FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_shares_insert" ON public.price_shares FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "price_shares_update" ON public.price_shares FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

-- ============ TRIGGERS ============
CREATE TRIGGER price_products_updated BEFORE UPDATE ON public.price_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_specs_updated BEFORE UPDATE ON public.price_product_specs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_prices_updated BEFORE UPDATE ON public.price_product_prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_rules_updated BEFORE UPDATE ON public.price_comparison_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_equiv_updated BEFORE UPDATE ON public.price_equivalences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER price_products_company BEFORE INSERT ON public.price_products FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_specs_company BEFORE INSERT ON public.price_product_specs FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_prices_company BEFORE INSERT ON public.price_product_prices FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_equiv_company BEFORE INSERT ON public.price_equivalences FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_import_files_company BEFORE INSERT ON public.price_import_files FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_import_rows_company BEFORE INSERT ON public.price_import_rows FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_audit_company BEFORE INSERT ON public.price_audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER price_shares_company BEFORE INSERT ON public.price_shares FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();