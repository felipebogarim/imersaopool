CREATE TABLE public.executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  immersion_report_id uuid NOT NULL UNIQUE REFERENCES public.field_immersion_v2_reports(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  status text NOT NULL DEFAULT 'review',
  report_title text,
  source_filename text,
  source_schema text,
  client jsonb NOT NULL DEFAULT '{}'::jsonb,
  executive_reading text,
  brands_observed jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  do_not_prioritize jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  email jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.executive_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_report_id uuid NOT NULL REFERENCES public.executive_reports(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  closed_by uuid,
  closed_by_name text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (executive_report_id, version)
);

CREATE TABLE public.executive_report_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_report_id uuid NOT NULL REFERENCES public.executive_reports(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  external_id text NOT NULL,
  source_decision_id text,
  area text NOT NULL DEFAULT 'commercial',
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'suggested',
  owner text,
  due_date date,
  note text,
  reject_reason text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordem int NOT NULL DEFAULT 0,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (executive_report_id, external_id)
);

CREATE TABLE public.executive_report_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_report_id uuid NOT NULL REFERENCES public.executive_reports(id) ON DELETE CASCADE,
  executive_report_version_id uuid REFERENCES public.executive_report_versions(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id),
  sent_by uuid,
  sent_by_name text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text,
  attach_pdf boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_reports TO authenticated;
GRANT ALL ON public.executive_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_report_versions TO authenticated;
GRANT ALL ON public.executive_report_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_report_actions TO authenticated;
GRANT ALL ON public.executive_report_actions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_report_email_logs TO authenticated;
GRANT ALL ON public.executive_report_email_logs TO service_role;

ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_report_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_report_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exec_reports_all_company" ON public.executive_reports
  FOR ALL TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "exec_versions_all_company" ON public.executive_report_versions
  FOR ALL TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "exec_actions_all_company" ON public.executive_report_actions
  FOR ALL TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "exec_email_logs_all_company" ON public.executive_report_email_logs
  FOR ALL TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TRIGGER executive_reports_touch BEFORE UPDATE ON public.executive_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER executive_report_actions_touch BEFORE UPDATE ON public.executive_report_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_exec_actions_report ON public.executive_report_actions(executive_report_id);
CREATE INDEX idx_exec_versions_report ON public.executive_report_versions(executive_report_id);
CREATE INDEX idx_exec_email_logs_report ON public.executive_report_email_logs(executive_report_id);