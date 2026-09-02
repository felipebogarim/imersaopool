DO $$
DECLARE
  v_board_id uuid;
  v_list_id uuid;
  v_user_id uuid;
BEGIN
  SELECT b.id INTO v_board_id
  FROM public.kanban_boards b
  WHERE lower(b.name) = 'comercial'
    AND lower(coalesce(b.visibility, '')) = 'vboard'
    AND b.archived_at IS NULL
  LIMIT 1;

  IF v_board_id IS NULL THEN
    SELECT b.id INTO v_board_id
    FROM public.kanban_boards b
    WHERE lower(b.name) = 'comercial'
      AND b.archived_at IS NULL
    LIMIT 1;
  END IF;

  SELECT l.id INTO v_list_id
  FROM public.kanban_lists l
  WHERE l.board_id = v_board_id
    AND lower(l.name) IN ('a fazer', 'a fazer')
    AND l.archived_at IS NULL
  LIMIT 1;

  SELECT p.id INTO v_user_id
  FROM public.profiles p
  WHERE lower(coalesce(p.full_name, '')) = 'angélica'
     OR lower(coalesce(p.full_name, '')) LIKE 'angélica %'
  LIMIT 1;

  IF v_board_id IS NULL OR v_list_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'Board, lista ou usuária Angélica não encontrados; nenhuma alteração aplicada.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_card_members (card_id, user_id)
  SELECT c.id, v_user_id
  FROM public.kanban_cards c
  WHERE c.board_id = v_board_id
    AND c.list_id = v_list_id
    AND c.archived_at IS NULL
  ON CONFLICT (card_id, user_id) DO NOTHING;
END $$;
