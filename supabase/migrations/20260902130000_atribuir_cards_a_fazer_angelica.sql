DO $$
DECLARE
  v_board_id uuid;
  v_list_id uuid;
  v_user_id uuid;
BEGIN
  SELECT b.id INTO v_board_id
  FROM public.kanban_boards b
  WHERE lower(trim(b.name)) = 'comercial'
    AND lower(trim(coalesce(b.visibility, ''))) = 'vboard'
    AND b.archived_at IS NULL
  ORDER BY b.created_at
  LIMIT 1;

  IF v_board_id IS NULL THEN
    SELECT b.id INTO v_board_id
    FROM public.kanban_boards b
    WHERE lower(trim(b.name)) = 'comercial'
      AND b.archived_at IS NULL
    ORDER BY b.created_at
    LIMIT 1;
  END IF;

  SELECT l.id INTO v_list_id
  FROM public.kanban_lists l
  WHERE l.board_id = v_board_id
    AND lower(trim(l.name)) = 'a fazer'
    AND l.archived_at IS NULL
  ORDER BY l.position
  LIMIT 1;

  SELECT p.id INTO v_user_id
  FROM public.profiles p
  WHERE lower(trim(coalesce(p.full_name, ''))) IN ('angélica', 'angelica')
     OR lower(trim(split_part(coalesce(p.email, ''), '@', 1))) IN ('angélica', 'angelica')
  ORDER BY p.full_name
  LIMIT 1;

  IF v_board_id IS NULL OR v_list_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'Board, lista ou usuária Angélica não encontrados; nenhuma alteração aplicada.';
    RETURN;
  END IF;

  UPDATE public.kanban_cards c
  SET metadata = jsonb_set(
    jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{responsible_id}', to_jsonb(v_user_id::text), true),
    '{responsible_name}', to_jsonb('Angélica'::text), true
  )
  WHERE c.board_id = v_board_id
    AND c.list_id = v_list_id
    AND c.archived_at IS NULL;

  INSERT INTO public.kanban_card_members (card_id, user_id)
  SELECT c.id, v_user_id
  FROM public.kanban_cards c
  WHERE c.board_id = v_board_id
    AND c.list_id = v_list_id
    AND c.archived_at IS NULL
  ON CONFLICT (card_id, user_id) DO NOTHING;
END $$;
