DROP POLICY IF EXISTS "kcom_update" ON public.kanban_comments;
CREATE POLICY "kcom_update"
ON public.kanban_comments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND public.kanban_can_access_board(c.board_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kanban_cards c
    WHERE c.id = kanban_comments.card_id
      AND public.kanban_can_access_board(c.board_id, auth.uid())
  )
);