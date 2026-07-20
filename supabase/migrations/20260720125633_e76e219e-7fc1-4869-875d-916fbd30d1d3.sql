
-- ENUMS
CREATE TYPE public.kanban_member_role AS ENUM ('owner','admin','member','observer');
CREATE TYPE public.kanban_card_priority AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.kanban_activity_type AS ENUM (
  'card_created','card_moved','card_updated','card_archived','card_restored','card_deleted',
  'comment_added','comment_edited','comment_deleted',
  'checklist_added','checklist_item_toggled',
  'member_assigned','member_removed',
  'label_added','label_removed',
  'attachment_added','attachment_removed',
  'due_date_changed','automation_run'
);
CREATE TYPE public.kanban_automation_trigger AS ENUM (
  'card_created','card_moved_to_list','due_date_approaching','card_archived','checklist_completed'
);
CREATE TYPE public.kanban_automation_action AS ENUM (
  'move_to_list','assign_member','add_label','set_due_date','send_notification','archive_card'
);

CREATE TABLE public.kanban_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_workspaces TO authenticated;
GRANT ALL ON public.kanban_workspaces TO service_role;
ALTER TABLE public.kanban_workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.kanban_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role kanban_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX ON public.kanban_workspace_members(workspace_id);
CREATE INDEX ON public.kanban_workspace_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_workspace_members TO authenticated;
GRANT ALL ON public.kanban_workspace_members TO service_role;
ALTER TABLE public.kanban_workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.kanban_is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.kanban_workspace_role(_workspace_id UUID, _user_id UUID)
RETURNS kanban_member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.kanban_workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id LIMIT 1;
$$;

CREATE TABLE public.kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.kanban_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  cover_image TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_template BOOLEAN NOT NULL DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'workspace',
  archived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_boards(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_boards TO authenticated;
GRANT ALL ON public.kanban_boards TO service_role;
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position NUMERIC NOT NULL DEFAULT 0,
  color TEXT,
  wip_limit INTEGER,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_lists(board_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_lists TO authenticated;
GRANT ALL ON public.kanban_lists TO service_role;
ALTER TABLE public.kanban_lists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_labels(board_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_labels TO authenticated;
GRANT ALL ON public.kanban_labels TO service_role;
ALTER TABLE public.kanban_labels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.kanban_lists(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position NUMERIC NOT NULL DEFAULT 0,
  priority kanban_card_priority NOT NULL DEFAULT 'media',
  due_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cover_color TEXT,
  cover_image TEXT,
  archived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_action_plan_id UUID REFERENCES public.action_plans(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_cards(list_id, position);
CREATE INDEX ON public.kanban_cards(board_id);
CREATE INDEX ON public.kanban_cards(due_date) WHERE due_date IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated;
GRANT ALL ON public.kanban_cards TO service_role;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_card_labels (
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.kanban_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_labels TO authenticated;
GRANT ALL ON public.kanban_card_labels TO service_role;
ALTER TABLE public.kanban_card_labels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_card_members (
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_members TO authenticated;
GRANT ALL ON public.kanban_card_members TO service_role;
ALTER TABLE public.kanban_card_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_checklists(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklists TO authenticated;
GRANT ALL ON public.kanban_checklists TO service_role;
ALTER TABLE public.kanban_checklists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.kanban_checklists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  assignee UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_checklist_items(checklist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklist_items TO authenticated;
GRANT ALL ON public.kanban_checklist_items TO service_role;
ALTER TABLE public.kanban_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] NOT NULL DEFAULT '{}'::uuid[],
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_comments(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_comments TO authenticated;
GRANT ALL ON public.kanban_comments TO service_role;
ALTER TABLE public.kanban_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_attachments(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_attachments TO authenticated;
GRANT ALL ON public.kanban_attachments TO service_role;
ALTER TABLE public.kanban_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type kanban_activity_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_activities(board_id, created_at DESC);
CREATE INDEX ON public.kanban_activities(card_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_activities TO authenticated;
GRANT ALL ON public.kanban_activities TO service_role;
ALTER TABLE public.kanban_activities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger kanban_automation_trigger NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action kanban_automation_action NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_automations(board_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_automations TO authenticated;
GRANT ALL ON public.kanban_automations TO service_role;
ALTER TABLE public.kanban_automations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kanban_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  board_id UUID REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kanban_notifications(user_id, read_at, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_notifications TO authenticated;
GRANT ALL ON public.kanban_notifications TO service_role;
ALTER TABLE public.kanban_notifications ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "kw_insert" ON public.kanban_workspaces FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "kw_select" ON public.kanban_workspaces FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.kanban_is_workspace_member(id, auth.uid()));
CREATE POLICY "kw_update" ON public.kanban_workspaces FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.kanban_workspace_role(id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "kw_delete" ON public.kanban_workspaces FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.kanban_workspace_role(id, auth.uid()) = 'owner');

CREATE POLICY "kwm_select" ON public.kanban_workspace_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.kanban_is_workspace_member(workspace_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid())
  );
CREATE POLICY "kwm_insert" ON public.kanban_workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid())
    OR public.kanban_workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
  );
CREATE POLICY "kwm_update" ON public.kanban_workspace_members FOR UPDATE TO authenticated
  USING (public.kanban_workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "kwm_delete" ON public.kanban_workspace_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.kanban_workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
  );

CREATE POLICY "kb_select" ON public.kanban_boards FOR SELECT TO authenticated
  USING (public.kanban_is_workspace_member(workspace_id, auth.uid())
         OR EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid()));
CREATE POLICY "kb_insert" ON public.kanban_boards FOR INSERT TO authenticated
  WITH CHECK (public.kanban_is_workspace_member(workspace_id, auth.uid())
              OR EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid()));
CREATE POLICY "kb_update" ON public.kanban_boards FOR UPDATE TO authenticated
  USING (public.kanban_is_workspace_member(workspace_id, auth.uid())
         OR EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid()));
CREATE POLICY "kb_delete" ON public.kanban_boards FOR DELETE TO authenticated
  USING (created_by = auth.uid()
         OR public.kanban_workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));

CREATE OR REPLACE FUNCTION public.kanban_can_access_board(_board_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = _board_id
      AND (
        public.kanban_is_workspace_member(b.workspace_id, _user_id)
        OR EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = b.workspace_id AND w.created_by = _user_id)
      )
  );
$$;

CREATE POLICY "kl_all" ON public.kanban_lists FOR ALL TO authenticated
  USING (public.kanban_can_access_board(board_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_board(board_id, auth.uid()));

CREATE POLICY "klab_all" ON public.kanban_labels FOR ALL TO authenticated
  USING (public.kanban_can_access_board(board_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_board(board_id, auth.uid()));

CREATE POLICY "kc_all" ON public.kanban_cards FOR ALL TO authenticated
  USING (public.kanban_can_access_board(board_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_board(board_id, auth.uid()));

CREATE POLICY "kcl_all" ON public.kanban_card_labels FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())));

CREATE POLICY "kcm_all" ON public.kanban_card_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())));

CREATE POLICY "kchk_all" ON public.kanban_checklists FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())));

CREATE POLICY "kchki_all" ON public.kanban_checklist_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_checklists ck
    JOIN public.kanban_cards c ON c.id = ck.card_id
    WHERE ck.id = checklist_id AND public.kanban_can_access_board(c.board_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_checklists ck
    JOIN public.kanban_cards c ON c.id = ck.card_id
    WHERE ck.id = checklist_id AND public.kanban_can_access_board(c.board_id, auth.uid())
  ));

CREATE POLICY "kcom_select" ON public.kanban_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())));
CREATE POLICY "kcom_insert" ON public.kanban_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())));
CREATE POLICY "kcom_update" ON public.kanban_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "kcom_delete" ON public.kanban_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "katt_all" ON public.kanban_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = card_id AND public.kanban_can_access_board(c.board_id, auth.uid())));

CREATE POLICY "kact_select" ON public.kanban_activities FOR SELECT TO authenticated
  USING (public.kanban_can_access_board(board_id, auth.uid()));
CREATE POLICY "kact_insert" ON public.kanban_activities FOR INSERT TO authenticated
  WITH CHECK (public.kanban_can_access_board(board_id, auth.uid()));

CREATE POLICY "kaut_all" ON public.kanban_automations FOR ALL TO authenticated
  USING (public.kanban_can_access_board(board_id, auth.uid()))
  WITH CHECK (public.kanban_can_access_board(board_id, auth.uid()));

CREATE POLICY "kn_select" ON public.kanban_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "kn_update" ON public.kanban_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "kn_delete" ON public.kanban_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "kn_insert" ON public.kanban_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- TRIGGERS
CREATE TRIGGER trg_kw_upd BEFORE UPDATE ON public.kanban_workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kb_upd BEFORE UPDATE ON public.kanban_boards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kl_upd BEFORE UPDATE ON public.kanban_lists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kc_upd BEFORE UPDATE ON public.kanban_cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_kaut_upd BEFORE UPDATE ON public.kanban_automations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.kanban_add_workspace_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.kanban_workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_kw_owner AFTER INSERT ON public.kanban_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.kanban_add_workspace_owner();

CREATE OR REPLACE FUNCTION public.kanban_seed_new_board()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.kanban_lists (board_id, name, position) VALUES
    (NEW.id, 'A Fazer', 1000),
    (NEW.id, 'Em Andamento', 2000),
    (NEW.id, 'Concluído', 3000);
  INSERT INTO public.kanban_labels (board_id, name, color) VALUES
    (NEW.id, 'Urgente', '#EF4444'),
    (NEW.id, 'Importante', '#F59E0B'),
    (NEW.id, 'Melhoria', '#10B981'),
    (NEW.id, 'Bug', '#8B5CF6');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_kb_seed AFTER INSERT ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.kanban_seed_new_board();

-- Storage policies para bucket kanban-attachments
CREATE POLICY "kanban_att_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kanban-attachments');
CREATE POLICY "kanban_att_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kanban-attachments' AND owner = auth.uid());
CREATE POLICY "kanban_att_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kanban-attachments' AND owner = auth.uid());

-- Migração action_plans -> kanban_cards
DO $$
DECLARE
  _company RECORD;
  _ws_id UUID;
  _board_id UUID;
  _list_pend UUID; _list_and UUID; _list_conc UUID;
  _creator UUID;
  _plan RECORD;
  _target_list UUID;
BEGIN
  FOR _company IN SELECT DISTINCT company_id FROM public.action_plans WHERE company_id IS NOT NULL LOOP
    SELECT ur.user_id INTO _creator FROM public.user_roles ur LIMIT 1;
    IF _creator IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.kanban_workspaces (name, description, created_by, company_id)
    VALUES ('Planos de Ação Migrados', 'Workspace criado automaticamente na migração para Gestão de Tarefas.', _creator, _company.company_id)
    RETURNING id INTO _ws_id;

    INSERT INTO public.kanban_boards (workspace_id, name, description, created_by, position)
    VALUES (_ws_id, 'Planos de Ação', 'Board gerado da migração de action_plans', _creator, 0)
    RETURNING id INTO _board_id;

    SELECT id INTO _list_pend FROM public.kanban_lists WHERE board_id = _board_id AND name = 'A Fazer';
    SELECT id INTO _list_and  FROM public.kanban_lists WHERE board_id = _board_id AND name = 'Em Andamento';
    SELECT id INTO _list_conc FROM public.kanban_lists WHERE board_id = _board_id AND name = 'Concluído';

    FOR _plan IN SELECT * FROM public.action_plans WHERE company_id = _company.company_id LOOP
      _target_list := CASE
        WHEN _plan.status::text ILIKE 'conclu%' OR _plan.resolvido_em IS NOT NULL THEN _list_conc
        WHEN _plan.status::text ILIKE 'andam%' OR _plan.status::text ILIKE 'progress%' THEN _list_and
        ELSE _list_pend
      END;

      INSERT INTO public.kanban_cards (
        list_id, board_id, title, description, priority, due_date,
        completed_at, created_by, origin_action_plan_id, created_at
      ) VALUES (
        _target_list, _board_id,
        LEFT(_plan.acao, 200),
        COALESCE(_plan.observacoes, ''),
        CASE _plan.prioridade::text
          WHEN 'alta' THEN 'alta'::kanban_card_priority
          WHEN 'baixa' THEN 'baixa'::kanban_card_priority
          ELSE 'media'::kanban_card_priority
        END,
        CASE WHEN _plan.prazo IS NOT NULL THEN _plan.prazo::timestamptz ELSE NULL END,
        _plan.resolvido_em,
        COALESCE(_plan.responsavel, _creator),
        _plan.id,
        _plan.created_at
      );
    END LOOP;
  END LOOP;
END $$;
