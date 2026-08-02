CREATE TABLE public.bloco_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_key text NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloco_notes TO authenticated;
GRANT ALL ON public.bloco_notes TO service_role;

ALTER TABLE public.bloco_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read bloco notes" ON public.bloco_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Author can insert own bloco notes" ON public.bloco_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author can update own bloco notes" ON public.bloco_notes
  FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author or admin can delete bloco notes" ON public.bloco_notes
  FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX bloco_notes_key_idx ON public.bloco_notes (bloco_key, created_at DESC);

CREATE TRIGGER bloco_notes_touch BEFORE UPDATE ON public.bloco_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();