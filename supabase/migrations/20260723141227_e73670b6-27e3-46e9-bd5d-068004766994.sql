
-- 1) event_orders: bloquear escrita por anon/authenticated (writes vêm do webhook via service_role, que bypassa RLS)
REVOKE INSERT, UPDATE, DELETE ON public.event_orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_orders_test FROM anon, authenticated;

-- 2) Storage: kanban-attachments SELECT com verificação de acesso ao board
DROP POLICY IF EXISTS "kanban_att_select" ON storage.objects;
CREATE POLICY "kanban_att_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kanban-attachments'
    AND EXISTS (
      SELECT 1 FROM public.kanban_attachments a
      JOIN public.kanban_cards c ON c.id = a.card_id
      WHERE a.file_path = storage.objects.name
        AND public.kanban_can_access_board(c.board_id, auth.uid())
    )
  );

-- 3) Storage: price-tables — restringir por company_id da tabela dona do arquivo
DROP POLICY IF EXISTS "price-tables authenticated read"   ON storage.objects;
DROP POLICY IF EXISTS "price-tables authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "price-tables authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "price-tables authenticated delete" ON storage.objects;

CREATE POLICY "price-tables company read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'price-tables'
    AND EXISTS (
      SELECT 1 FROM public.price_tables pt
      WHERE pt.file_path = storage.objects.name
        AND pt.company_id = public.current_company_id()
    )
  );

CREATE POLICY "price-tables company insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'price-tables'
    AND public.current_company_id() IS NOT NULL
  );

CREATE POLICY "price-tables company update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'price-tables'
    AND EXISTS (
      SELECT 1 FROM public.price_tables pt
      WHERE pt.file_path = storage.objects.name
        AND pt.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    bucket_id = 'price-tables'
    AND EXISTS (
      SELECT 1 FROM public.price_tables pt
      WHERE pt.file_path = storage.objects.name
        AND pt.company_id = public.current_company_id()
    )
  );

CREATE POLICY "price-tables company delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'price-tables'
    AND EXISTS (
      SELECT 1 FROM public.price_tables pt
      WHERE pt.file_path = storage.objects.name
        AND pt.company_id = public.current_company_id()
    )
  );

-- 4) client_bi_uploads: policy explicitamente para authenticated (evita avaliação no role public)
DROP POLICY IF EXISTS "client_bi_uploads_company_scope" ON public.client_bi_uploads;
CREATE POLICY "client_bi_uploads_company_scope" ON public.client_bi_uploads
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- 5) kanban_notifications: kn_insert deve validar acesso
DROP POLICY IF EXISTS "kn_insert" ON public.kanban_notifications;
CREATE POLICY "kn_insert" ON public.kanban_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- pode criar notificação para si mesmo sem board
    (user_id = auth.uid() AND card_id IS NULL AND board_id IS NULL)
    -- ou notificação vinculada a board ao qual o autor tem acesso, para um destinatário que também tem acesso
    OR (
      board_id IS NOT NULL
      AND public.kanban_can_access_board(board_id, auth.uid())
      AND public.kanban_can_access_board(board_id, user_id)
    )
    OR (
      card_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.kanban_cards c
        WHERE c.id = card_id
          AND public.kanban_can_access_board(c.board_id, auth.uid())
          AND public.kanban_can_access_board(c.board_id, user_id)
      )
    )
  );

-- 6) Fixa search_path nas 4 funções pendentes
ALTER FUNCTION public.enqueue_email(text, jsonb)          SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint)          SET search_path = public, pgmq;
