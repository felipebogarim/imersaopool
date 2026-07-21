
CREATE TABLE public.perf_acoes_sugeridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id uuid NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES public.rep_performance_uploads(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','upload_xlsx','upload_pdf')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','validada','excluida')),
  linked_card_id uuid REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  linked_board_id uuid REFERENCES public.kanban_boards(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perf_acoes_sugeridas TO authenticated;
GRANT ALL ON public.perf_acoes_sugeridas TO service_role;

ALTER TABLE public.perf_acoes_sugeridas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own suggested actions" ON public.perf_acoes_sugeridas
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_perf_acoes_rep ON public.perf_acoes_sugeridas(representative_id, status);

CREATE TRIGGER trg_perf_acoes_updated_at
  BEFORE UPDATE ON public.perf_acoes_sugeridas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
