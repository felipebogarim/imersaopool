-- 1) app_update_assets: leitura restrita ao dono do arquivo ou admin/gestor
DROP POLICY IF EXISTS "Allow authenticated users to read files" ON storage.objects;
CREATE POLICY "app_update_assets restricted read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'app_update_assets'
    AND (owner = auth.uid() OR public.is_admin_or_gestor(auth.uid()))
  );

-- 2) kanban_notifications: apenas auto-notificações via cliente; sistema usa função definer
DROP POLICY IF EXISTS "kn_insert" ON public.kanban_notifications;
CREATE POLICY "kn_insert" ON public.kanban_notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.kanban_notify(
  _user_id uuid,
  _board_id uuid,
  _card_id uuid,
  _type text,
  _title text,
  _body text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _resolved_board uuid := _board_id;
BEGIN
  IF _resolved_board IS NULL AND _card_id IS NOT NULL THEN
    SELECT c.board_id INTO _resolved_board FROM public.kanban_cards c WHERE c.id = _card_id;
  END IF;

  IF _resolved_board IS NULL THEN
    RAISE EXCEPTION 'board obrigatório';
  END IF;

  IF NOT public.kanban_can_access_board(_resolved_board, auth.uid()) THEN
    RAISE EXCEPTION 'sem acesso ao board';
  END IF;

  IF NOT public.kanban_can_access_board(_resolved_board, _user_id) THEN
    RAISE EXCEPTION 'destinatário sem acesso ao board';
  END IF;

  INSERT INTO public.kanban_notifications (user_id, board_id, card_id, type, title, body)
  VALUES (
    _user_id,
    _resolved_board,
    _card_id,
    coalesce(left(_type, 40), 'automation'),
    left(coalesce(_title, 'Notificação'), 200),
    left(coalesce(_body, ''), 1000)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.kanban_notify(uuid, uuid, uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.kanban_notify(uuid, uuid, uuid, text, text, text) TO authenticated;

-- 3) price-tables: upload apenas dentro da pasta da própria empresa
DROP POLICY IF EXISTS "price-tables company insert" ON storage.objects;
CREATE POLICY "price-tables company insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'price-tables'
    AND public.current_company_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

DROP POLICY IF EXISTS "price-tables company read" ON storage.objects;
CREATE POLICY "price-tables company read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'price-tables'
    AND public.current_company_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] = public.current_company_id()::text
      OR EXISTS (SELECT 1 FROM public.price_tables pt WHERE pt.file_path = name AND pt.company_id = public.current_company_id())
    )
  );

DROP POLICY IF EXISTS "price-tables company update" ON storage.objects;
CREATE POLICY "price-tables company update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'price-tables'
    AND public.current_company_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] = public.current_company_id()::text
      OR EXISTS (SELECT 1 FROM public.price_tables pt WHERE pt.file_path = name AND pt.company_id = public.current_company_id())
    )
  )
  WITH CHECK (
    bucket_id = 'price-tables'
    AND public.current_company_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

DROP POLICY IF EXISTS "price-tables company delete" ON storage.objects;
CREATE POLICY "price-tables company delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'price-tables'
    AND public.current_company_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] = public.current_company_id()::text
      OR EXISTS (SELECT 1 FROM public.price_tables pt WHERE pt.file_path = name AND pt.company_id = public.current_company_id())
    )
  );