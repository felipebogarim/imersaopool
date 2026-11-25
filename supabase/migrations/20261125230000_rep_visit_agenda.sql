-- Portal do representante → GUIA DE AGENDA: visitas planejadas pelo representante (ex.: a semana)
-- para gerar o guia de cada cliente (performance, lembretes da imersão e tela de metas).
--
-- O representante grava/lê pelas server functions do portal (service role escopado ao
-- representante vinculado). A gestão (admin/gestor da empresa) só lê, pelo próprio token (RLS).

CREATE TABLE IF NOT EXISTS public.rep_visit_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  row_id UUID REFERENCES public.rep_performance_rows(id) ON DELETE SET NULL,
  cliente_key TEXT NOT NULL,
  cliente TEXT NOT NULL,
  data_visita DATE NOT NULL,
  hora TEXT CHECK (hora IS NULL OR hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  objetivo TEXT CHECK (objetivo IS NULL OR char_length(objetivo) <= 1000),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_visit_agenda_rep_data
  ON public.rep_visit_agenda(representative_id, data_visita);
CREATE INDEX IF NOT EXISTS idx_rep_visit_agenda_company_data
  ON public.rep_visit_agenda(company_id, data_visita);

GRANT SELECT ON public.rep_visit_agenda TO authenticated;
GRANT ALL ON public.rep_visit_agenda TO service_role;
ALTER TABLE public.rep_visit_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rep_visit_agenda_staff_select ON public.rep_visit_agenda;
CREATE POLICY rep_visit_agenda_staff_select ON public.rep_visit_agenda
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

DROP POLICY IF EXISTS block_external_rep ON public.rep_visit_agenda;
CREATE POLICY block_external_rep ON public.rep_visit_agenda AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT NOT public.is_external_rep(auth.uid())))
  WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())));

NOTIFY pgrst, 'reload schema';
