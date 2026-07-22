
-- Categoria da tabela de preços
DO $$ BEGIN
  CREATE TYPE public.price_table_categoria AS ENUM ('normal','atacado','promocional','outra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  competitor_id uuid NOT NULL REFERENCES public.price_competitors(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  categoria public.price_table_categoria NOT NULL DEFAULT 'normal',
  categoria_outra text,
  data_referencia date NOT NULL DEFAULT (now()::date),
  observacoes text,
  file_path text,
  file_name text,
  file_size bigint,
  file_mime text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_tables TO authenticated;
GRANT ALL ON public.price_tables TO service_role;

ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_tables company members can read"
  ON public.price_tables FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "price_tables company members can insert"
  ON public.price_tables FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "price_tables company members can update"
  ON public.price_tables FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "price_tables company members can delete"
  ON public.price_tables FOR DELETE TO authenticated
  USING (company_id = public.current_company_id());

CREATE TRIGGER trg_price_tables_company
  BEFORE INSERT ON public.price_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();

CREATE TRIGGER trg_price_tables_updated
  BEFORE UPDATE ON public.price_tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_price_tables_competitor ON public.price_tables(competitor_id);
CREATE INDEX idx_price_tables_company ON public.price_tables(company_id);
