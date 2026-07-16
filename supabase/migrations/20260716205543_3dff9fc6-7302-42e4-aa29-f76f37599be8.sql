-- =========================================================
-- FORMS: gerador de formulários por IA + URL pública
-- =========================================================

CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  prompt text,
  schema jsonb NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forms_company ON public.forms (company_id);
CREATE INDEX idx_forms_slug_active ON public.forms (slug) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forms_company_scope"
  ON public.forms
  FOR ALL
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE TRIGGER trg_forms_set_company
  BEFORE INSERT ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();

CREATE TRIGGER trg_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Respostas
-- =========================================================

CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_responses_form ON public.form_responses (form_id, submitted_at DESC);
CREATE INDEX idx_form_responses_company ON public.form_responses (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_responses TO authenticated;
GRANT ALL ON public.form_responses TO service_role;

ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_responses_company_scope"
  ON public.form_responses
  FOR ALL
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- =========================================================
-- Função pública: buscar form ativo pelo slug (sem expor prompt/empresa)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_active_form_by_slug(_slug text)
RETURNS TABLE (id uuid, title text, schema jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.title, f.schema
  FROM public.forms f
  WHERE f.slug = _slug AND f.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_form_by_slug(text) TO anon, authenticated;

-- =========================================================
-- Função pública: gravar resposta (valida ativo e injeta company_id)
-- =========================================================
CREATE OR REPLACE FUNCTION public.submit_form_response(
  _slug text,
  _answers jsonb,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _form_id uuid;
  _company_id uuid;
  _response_id uuid;
BEGIN
  SELECT id, company_id INTO _form_id, _company_id
  FROM public.forms
  WHERE slug = _slug AND is_active = true
  LIMIT 1;

  IF _form_id IS NULL THEN
    RAISE EXCEPTION 'Formulário não encontrado ou inativo';
  END IF;

  INSERT INTO public.form_responses (form_id, company_id, answers, user_agent)
  VALUES (_form_id, _company_id, COALESCE(_answers, '{}'::jsonb), _user_agent)
  RETURNING id INTO _response_id;

  RETURN _response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_form_response(text, jsonb, text) TO anon, authenticated;
