CREATE OR REPLACE FUNCTION public.kanban_can_access_card(_card_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_cards c
    WHERE c.id = _card_id AND public.kanban_can_access_board(c.board_id, _user_id)
  );
$$;

CREATE TABLE public.kanban_action_tracking (
  card_id UUID PRIMARY KEY REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'nao_iniciado'
    CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_name TEXT
);

CREATE TABLE public.kanban_action_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('representante', 'interno')),
  author_name TEXT,
  status TEXT CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kanban_action_updates_card ON public.kanban_action_updates(card_id, created_at DESC);

CREATE TABLE public.kanban_action_update_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES public.kanban_action_updates(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kanban_action_files_card ON public.kanban_action_update_files(card_id);

CREATE TABLE public.kanban_action_pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  update_id UUID REFERENCES public.kanban_action_updates(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  assignee_user_id UUID REFERENCES auth.users(id),
  assignee_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_kanban_action_pend_card ON public.kanban_action_pendencias(card_id);

CREATE TABLE public.kanban_action_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  representative_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kanban_action_req_rep ON public.kanban_action_update_requests(representative_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.kanban_action_tracking, public.kanban_action_updates,
  public.kanban_action_update_files, public.kanban_action_pendencias TO authenticated;
GRANT ALL ON
  public.kanban_action_tracking, public.kanban_action_updates,
  public.kanban_action_update_files, public.kanban_action_pendencias,
  public.kanban_action_update_requests TO service_role;

ALTER TABLE public.kanban_action_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_action_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_action_update_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_action_pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_action_update_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kat_all" ON public.kanban_action_tracking FOR ALL TO authenticated
  USING (public.kanban_can_access_card(card_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_card(card_id, auth.uid()));
CREATE POLICY "kau_all" ON public.kanban_action_updates FOR ALL TO authenticated
  USING (public.kanban_can_access_card(card_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_card(card_id, auth.uid()));
CREATE POLICY "kauf_all" ON public.kanban_action_update_files FOR ALL TO authenticated
  USING (public.kanban_can_access_card(card_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_card(card_id, auth.uid()));
CREATE POLICY "kap_all" ON public.kanban_action_pendencias FOR ALL TO authenticated
  USING (public.kanban_can_access_card(card_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_card(card_id, auth.uid()));

CREATE POLICY "action_updates_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'action-updates'
    AND EXISTS (
      SELECT 1 FROM public.kanban_action_update_files f
      WHERE f.storage_path = storage.objects.name
        AND public.kanban_can_access_card(f.card_id, auth.uid())
    )
  );