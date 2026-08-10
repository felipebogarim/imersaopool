-- 1) Kanban attachments: explicit, scoped UPDATE policy
DROP POLICY IF EXISTS kanban_att_update ON storage.objects;
CREATE POLICY kanban_att_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kanban-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.kanban_attachments a
    JOIN public.kanban_cards c ON c.id = a.card_id
    WHERE a.file_path = objects.name
      AND public.kanban_can_access_board(c.board_id, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'kanban-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.kanban_attachments a
    JOIN public.kanban_cards c ON c.id = a.card_id
    WHERE a.file_path = objects.name
      AND public.kanban_can_access_board(c.board_id, auth.uid())
  )
);

-- 2) Manuais: anon only sees public-facing columns
REVOKE SELECT ON public.manuais FROM anon;
GRANT SELECT (id, slug, titulo, descricao, tipo, conteudo, pdf_path, publicado, created_at, updated_at)
  ON public.manuais TO anon;