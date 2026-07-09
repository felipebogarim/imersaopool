
CREATE TABLE public.session_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('interview','immersion')),
  entity_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX session_notes_entity_idx ON public.session_notes(entity_type, entity_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_notes TO authenticated;
GRANT ALL ON public.session_notes TO service_role;

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read session notes"
  ON public.session_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Author can insert own notes"
  ON public.session_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author can update own notes"
  ON public.session_notes FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author or admin can delete notes"
  ON public.session_notes FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_session_notes_updated
  BEFORE UPDATE ON public.session_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
