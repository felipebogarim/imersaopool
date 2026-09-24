CREATE TABLE public.director_rep_notes (
  representative_id UUID PRIMARY KEY REFERENCES public.representatives(id) ON DELETE CASCADE,
  company_id UUID NOT NULL DEFAULT public.current_company_id()
    REFERENCES public.companies(id) ON DELETE CASCADE,
  last_immersion DATE,
  general_perception TEXT,
  perceived_opportunities TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX director_rep_notes_company_idx
  ON public.director_rep_notes(company_id);

CREATE TRIGGER director_rep_notes_touch
  BEFORE UPDATE ON public.director_rep_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.director_rep_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.director_rep_notes TO authenticated;
GRANT ALL ON public.director_rep_notes TO service_role;

CREATE POLICY director_rep_notes_select_company
  ON public.director_rep_notes
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1
      FROM public.representatives representative
      WHERE representative.id = director_rep_notes.representative_id
        AND representative.company_id = public.current_company_id()
    )
  );

CREATE POLICY director_rep_notes_insert_master
  ON public.director_rep_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.representatives representative
      WHERE representative.id = director_rep_notes.representative_id
        AND representative.company_id = public.current_company_id()
    )
    AND lower(COALESCE(auth.jwt() ->> 'email', '')) = 'felipe@poolbranding.com.br'
  );

CREATE POLICY director_rep_notes_update_master
  ON public.director_rep_notes
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND lower(COALESCE(auth.jwt() ->> 'email', '')) = 'felipe@poolbranding.com.br'
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.representatives representative
      WHERE representative.id = director_rep_notes.representative_id
        AND representative.company_id = public.current_company_id()
    )
    AND lower(COALESCE(auth.jwt() ->> 'email', '')) = 'felipe@poolbranding.com.br'
  );
