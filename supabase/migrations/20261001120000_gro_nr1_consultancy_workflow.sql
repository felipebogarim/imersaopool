-- GRO NR1: fluxo longitudinal da consultoria, sem substituir dados existentes.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultoria_operador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'empresa_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'empresa_usuario';

CREATE OR REPLACE FUNCTION public.gro_is_consultant(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'gestor', 'agente', 'consultoria_operador')
  )
$$;

CREATE OR REPLACE FUNCTION public.gro_is_company_user(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('empresa_admin', 'empresa_usuario')
  )
$$;

CREATE OR REPLACE FUNCTION public.gro_can_access_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.gro_is_consultant(auth.uid())
      THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = _company_id
    )
  END
$$;

CREATE TABLE public.gro_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','closed')),
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  technical_method text,
  closed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gro_period_dates CHECK (ends_on >= starts_on),
  UNIQUE (company_id, name)
);

CREATE TABLE public.gro_consultancy_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  UNIQUE (period_id, step_key)
);

CREATE TABLE public.gro_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.gro_periods(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('administrative','medical_certificates','cat','pgr','aet','technical_other','existing_practices')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','analyzed','reviewed')),
  storage_path text,
  file_name text,
  mime_type text,
  is_published boolean NOT NULL DEFAULT false,
  aggregate_count integer,
  absence_days integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_good_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE CASCADE,
  topic text NOT NULL,
  applies boolean,
  details text,
  audio_path text,
  transcript text,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, topic)
);

CREATE TABLE public.gro_questionnaire_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  version text NOT NULL,
  question_count integer NOT NULL DEFAULT 0,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_parameters_ready boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE public.gro_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.gro_questionnaire_templates(id) ON DELETE RESTRICT,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','open','closed','consolidated')),
  application_modes text[] NOT NULL DEFAULT ARRAY['link']::text[],
  public_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  eligible_total integer NOT NULL DEFAULT 0,
  invitations_total integer NOT NULL DEFAULT 0,
  exclusions_total integer NOT NULL DEFAULT 0,
  exclusion_reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  closes_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.gro_questionnaires(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'link' CHECK (source IN ('link','qr','print','manual','physical_upload')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  physical_storage_path text,
  extraction_status text CHECK (extraction_status IS NULL OR extraction_status IN ('pending','assisted','reviewed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.gro_field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE CASCADE,
  visited_on date NOT NULL,
  professional_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  notes text,
  audio_path text,
  transcript text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','included','archived')),
  include_in_report boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_final_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','technical_review','validated','published','delivered')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  technical_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  published_at timestamptz,
  delivered_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, version)
);

CREATE TABLE public.gro_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE RESTRICT,
  report_id uuid REFERENCES public.gro_final_reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  classification text,
  technical_reading text,
  considered_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  origin_period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE RESTRICT,
  risk_id uuid REFERENCES public.gro_risks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  technical_origin text,
  source text NOT NULL DEFAULT 'consultancy' CHECK (source IN ('consultancy','company')),
  is_published boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  owner_name text,
  owner_email text,
  area text,
  due_on date,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','awaiting_evidence','completed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  evidence_required boolean NOT NULL DEFAULT true,
  completion_justification text,
  completed_at timestamptz,
  status_at_period_close text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_action_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.gro_actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_action_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.gro_actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.gro_actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  evidence_type text NOT NULL DEFAULT 'text' CHECK (evidence_type IN ('file','photo','pdf','text','comment')),
  description text,
  storage_path text,
  file_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','rejected')),
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.gro_actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_value jsonb,
  to_value jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gro_culture_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.gro_periods(id) ON DELETE RESTRICT,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','published')),
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id)
);

CREATE INDEX gro_periods_company_dates_idx ON public.gro_periods(company_id, starts_on DESC);
CREATE INDEX gro_documents_period_idx ON public.gro_documents(period_id, category);
CREATE INDEX gro_questionnaires_period_idx ON public.gro_questionnaires(period_id);
CREATE INDEX gro_responses_questionnaire_idx ON public.gro_questionnaire_responses(questionnaire_id);
CREATE INDEX gro_actions_origin_idx ON public.gro_actions(origin_period_id, status);
CREATE INDEX gro_actions_company_due_idx ON public.gro_actions(company_id, due_on);
CREATE INDEX gro_evidences_action_idx ON public.gro_evidences(action_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['gro_periods','gro_documents','gro_questionnaires','gro_field_reports','gro_final_reports','gro_risks','gro_actions','gro_culture_reads'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gro_guard_action_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.gro_is_consultant(auth.uid()) THEN
    IF NEW.risk_id IS DISTINCT FROM OLD.risk_id
      OR NEW.technical_origin IS DISTINCT FROM OLD.technical_origin
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.is_published IS DISTINCT FROM OLD.is_published
      OR NEW.origin_period_id IS DISTINCT FROM OLD.origin_period_id
      OR NEW.priority IS DISTINCT FROM OLD.priority THEN
      RAISE EXCEPTION 'A empresa não pode alterar a origem ou o conteúdo técnico da ação';
    END IF;
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    IF NEW.evidence_required AND NOT EXISTS (SELECT 1 FROM public.gro_evidences e WHERE e.action_id = NEW.id)
       AND nullif(trim(NEW.completion_justification), '') IS NULL THEN
      RAISE EXCEPTION 'Inclua uma evidência ou justificativa antes de concluir';
    END IF;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.progress := 100;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gro_actions_guard BEFORE UPDATE ON public.gro_actions
FOR EACH ROW EXECUTE FUNCTION public.gro_guard_action_update();

CREATE OR REPLACE FUNCTION public.gro_audit_action_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.gro_action_history(action_id, company_id, event_type, from_value, to_value, actor_id)
  VALUES (NEW.id, NEW.company_id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER gro_actions_audit AFTER UPDATE ON public.gro_actions
FOR EACH ROW EXECUTE FUNCTION public.gro_audit_action_update();

CREATE OR REPLACE FUNCTION public.gro_guard_report_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.gro_is_consultant(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF NEW.status IN ('published','delivered') AND NEW.validated_at IS NULL THEN
    RAISE EXCEPTION 'O relatório precisa de validação humana antes da publicação';
  END IF;
  IF NEW.status = 'validated' AND OLD.status <> 'validated' THEN
    NEW.validated_at := COALESCE(NEW.validated_at, now());
    NEW.validated_by := COALESCE(NEW.validated_by, auth.uid());
  ELSIF NEW.status = 'published' AND OLD.status <> 'published' THEN
    NEW.published_at := COALESCE(NEW.published_at, now());
  ELSIF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gro_reports_guard BEFORE UPDATE ON public.gro_final_reports
FOR EACH ROW EXECUTE FUNCTION public.gro_guard_report_status();

CREATE OR REPLACE FUNCTION public.gro_publish_validated_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('published','delivered') AND OLD.status NOT IN ('published','delivered') THEN
    UPDATE public.gro_risks SET is_published = true WHERE report_id = NEW.id;
    UPDATE public.gro_actions SET is_published = true
      WHERE origin_period_id = NEW.period_id AND source = 'consultancy';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gro_reports_publish_content AFTER UPDATE ON public.gro_final_reports
FOR EACH ROW EXECUTE FUNCTION public.gro_publish_validated_content();

CREATE OR REPLACE FUNCTION public.gro_close_period(_period_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  IF NOT public.gro_is_consultant(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT company_id INTO v_company FROM public.gro_periods WHERE id = _period_id;
  IF v_company IS NULL OR NOT public.gro_can_access_company(v_company) THEN RAISE EXCEPTION 'Período não encontrado'; END IF;
  UPDATE public.gro_actions SET status_at_period_close = status
    WHERE origin_period_id = _period_id AND status_at_period_close IS NULL;
  UPDATE public.gro_periods SET status = 'closed', closed_at = now() WHERE id = _period_id;
END $$;

CREATE OR REPLACE FUNCTION public.gro_can_access_action(_action_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gro_actions a
    WHERE a.id = _action_id
      AND public.gro_can_access_company(a.company_id)
      AND (public.gro_is_consultant() OR a.is_published OR a.source = 'company')
  )
$$;

CREATE OR REPLACE FUNCTION public.gro_get_questionnaire_public(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', q.id,
    'name', q.name,
    'status', q.status,
    'starts_at', q.starts_at,
    'closes_at', q.closes_at,
    'template_name', t.name,
    'description', t.description,
    'questions', t.questions
  )
  FROM public.gro_questionnaires q
  LEFT JOIN public.gro_questionnaire_templates t ON t.id = q.template_id
  WHERE q.public_token = _token AND q.status = 'open'
    AND (q.starts_at IS NULL OR q.starts_at <= now())
    AND (q.closes_at IS NULL OR q.closes_at >= now())
$$;

CREATE OR REPLACE FUNCTION public.gro_submit_questionnaire(_token text, _answers jsonb, _source text DEFAULT 'link')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_questionnaire public.gro_questionnaires; v_id uuid;
BEGIN
  SELECT * INTO v_questionnaire FROM public.gro_questionnaires q
  WHERE q.public_token = _token AND q.status = 'open'
    AND (q.starts_at IS NULL OR q.starts_at <= now())
    AND (q.closes_at IS NULL OR q.closes_at >= now());
  IF v_questionnaire.id IS NULL THEN RAISE EXCEPTION 'Questionário indisponível'; END IF;
  INSERT INTO public.gro_questionnaire_responses(questionnaire_id, company_id, source, answers)
  VALUES (v_questionnaire.id, v_questionnaire.company_id, _source, COALESCE(_answers, '{}'::jsonb)) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.gro_is_consultant(uuid), public.gro_is_company_user(uuid), public.gro_can_access_company(uuid), public.gro_can_access_action(uuid), public.gro_close_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gro_get_questionnaire_public(text), public.gro_submit_questionnaire(text, jsonb, text) TO anon, authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gro_periods','gro_consultancy_steps','gro_documents','gro_good_practices',
    'gro_questionnaire_templates','gro_questionnaires','gro_questionnaire_responses',
    'gro_field_reports','gro_final_reports','gro_risks','gro_actions',
    'gro_action_participants','gro_action_comments','gro_evidences','gro_action_history','gro_culture_reads'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gro_periods','gro_consultancy_steps','gro_documents','gro_good_practices',
    'gro_questionnaire_templates','gro_questionnaires','gro_questionnaire_responses',
    'gro_field_reports','gro_final_reports','gro_risks','gro_actions',
    'gro_action_participants','gro_action_comments','gro_evidences','gro_action_history','gro_culture_reads'
  ] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END LOOP;
END $$;

CREATE POLICY gro_periods_read ON public.gro_periods FOR SELECT TO authenticated USING (public.gro_can_access_company(company_id));
CREATE POLICY gro_periods_write ON public.gro_periods FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_steps_read ON public.gro_consultancy_steps FOR SELECT TO authenticated USING (public.gro_can_access_company(company_id));
CREATE POLICY gro_steps_write ON public.gro_consultancy_steps FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_documents_read ON public.gro_documents FOR SELECT TO authenticated USING (public.gro_can_access_company(company_id) AND (public.gro_is_consultant() OR is_published));
CREATE POLICY gro_documents_write ON public.gro_documents FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_practices_access ON public.gro_good_practices FOR ALL TO authenticated USING (public.gro_can_access_company(company_id)) WITH CHECK (public.gro_can_access_company(company_id));
CREATE POLICY gro_templates_consultancy ON public.gro_questionnaire_templates FOR ALL TO authenticated USING (public.gro_is_consultant()) WITH CHECK (public.gro_is_consultant());
CREATE POLICY gro_questionnaires_consultancy ON public.gro_questionnaires FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_responses_consultancy ON public.gro_questionnaire_responses FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_field_reports_consultancy ON public.gro_field_reports FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_reports_consultancy ON public.gro_final_reports FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_reports_company_read ON public.gro_final_reports FOR SELECT TO authenticated USING (public.gro_is_company_user() AND public.gro_can_access_company(company_id) AND status IN ('published','delivered'));
CREATE POLICY gro_risks_consultancy ON public.gro_risks FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_risks_company_read ON public.gro_risks FOR SELECT TO authenticated USING (public.gro_is_company_user() AND public.gro_can_access_company(company_id) AND is_published);
CREATE POLICY gro_actions_access ON public.gro_actions FOR SELECT TO authenticated USING (
  public.gro_can_access_company(company_id)
  AND (public.gro_is_consultant() OR is_published OR source = 'company')
);
CREATE POLICY gro_actions_insert ON public.gro_actions FOR INSERT TO authenticated WITH CHECK (public.gro_can_access_company(company_id) AND (public.gro_is_consultant() OR source = 'company'));
CREATE POLICY gro_actions_update ON public.gro_actions FOR UPDATE TO authenticated USING (public.gro_can_access_company(company_id)) WITH CHECK (public.gro_can_access_company(company_id));
CREATE POLICY gro_action_participants_access ON public.gro_action_participants FOR ALL TO authenticated USING (public.gro_can_access_action(action_id)) WITH CHECK (public.gro_can_access_action(action_id));
CREATE POLICY gro_action_comments_access ON public.gro_action_comments FOR ALL TO authenticated USING (public.gro_can_access_action(action_id)) WITH CHECK (public.gro_can_access_action(action_id));
CREATE POLICY gro_evidences_access ON public.gro_evidences FOR SELECT TO authenticated USING (public.gro_can_access_action(action_id));
CREATE POLICY gro_evidences_insert ON public.gro_evidences FOR INSERT TO authenticated WITH CHECK (public.gro_can_access_action(action_id));
CREATE POLICY gro_evidences_consultancy_update ON public.gro_evidences FOR UPDATE TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_history_read ON public.gro_action_history FOR SELECT TO authenticated USING (public.gro_can_access_action(action_id));
CREATE POLICY gro_culture_consultancy ON public.gro_culture_reads FOR ALL TO authenticated USING (public.gro_is_consultant() AND public.gro_can_access_company(company_id)) WITH CHECK (public.gro_is_consultant() AND public.gro_can_access_company(company_id));
CREATE POLICY gro_culture_company_read ON public.gro_culture_reads FOR SELECT TO authenticated USING (public.gro_is_company_user() AND public.gro_can_access_company(company_id) AND status = 'published');

CREATE POLICY companies_gro_consultancy_select ON public.companies FOR SELECT TO authenticated
USING (public.gro_is_consultant());

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gro-nr1', 'gro-nr1', false, 20971520)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY gro_storage_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'gro-nr1'
  AND public.gro_can_access_company((storage.foldername(name))[1]::uuid)
  AND (public.gro_is_consultant() OR (storage.foldername(name))[2] IN ('evidence','public'))
);
CREATE POLICY gro_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'gro-nr1'
  AND public.gro_can_access_company((storage.foldername(name))[1]::uuid)
  AND (public.gro_is_consultant() OR (storage.foldername(name))[2] IN ('evidence','practices'))
);
CREATE POLICY gro_storage_update ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'gro-nr1' AND public.gro_is_consultant()
  AND public.gro_can_access_company((storage.foldername(name))[1]::uuid)
);
CREATE POLICY gro_storage_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'gro-nr1' AND public.gro_is_consultant()
  AND public.gro_can_access_company((storage.foldername(name))[1]::uuid)
);

INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r::public.app_role, 'gro-nr1', true
FROM unnest(ARRAY['admin','gestor','agente']) AS r
ON CONFLICT (role, nav_key) DO UPDATE SET allowed = EXCLUDED.allowed;
