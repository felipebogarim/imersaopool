DO $$
DECLARE
  _board_id UUID;
  _list_id UUID;
  _user_id UUID;
BEGIN
  SELECT b.id
    INTO _board_id
  FROM public.kanban_boards b
  WHERE lower(trim(b.name)) = 'comercial'
    AND b.archived_at IS NULL
  ORDER BY b.created_at
  LIMIT 1;

  IF _board_id IS NULL THEN
    RAISE NOTICE 'Board Comercial não encontrado';
    RETURN;
  END IF;

  SELECT l.id
    INTO _list_id
  FROM public.kanban_lists l
  WHERE l.board_id = _board_id
    AND l.archived_at IS NULL
    AND lower(trim(l.name)) IN ('a fazer', 'a fazer ')
  ORDER BY l.position
  LIMIT 1;

  IF _list_id IS NULL THEN
    RAISE NOTICE 'Lista A Fazer não encontrada no board Comercial';
    RETURN;
  END IF;

  SELECT p.id
    INTO _user_id
  FROM public.profiles p
  WHERE lower(trim(coalesce(p.full_name, ''))) = 'angélica'
     OR lower(trim(coalesce(p.full_name, ''))) = 'angelica'
     OR lower(split_part(coalesce(p.email, ''), '@', 1)) IN ('angélica', 'angelica')
  ORDER BY p.full_name
  LIMIT 1;

  IF _user_id IS NULL THEN
    RAISE NOTICE 'Usuária Angélica não encontrada';
    RETURN;
  END IF;

  UPDATE public.kanban_cards c
  SET metadata = jsonb_set(
    jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{responsible_id}', to_jsonb(_user_id::text), true),
    '{responsible_name}',
    to_jsonb('Angélica'::text),
    true
  )
  WHERE c.board_id = _board_id
    AND c.list_id = _list_id
    AND c.archived_at IS NULL;

  INSERT INTO public.kanban_card_members (card_id, user_id)
  SELECT c.id, _user_id
  FROM public.kanban_cards c
  WHERE c.board_id = _board_id
    AND c.list_id = _list_id
    AND c.archived_at IS NULL
  ON CONFLICT (card_id, user_id) DO NOTHING;
END $$;
