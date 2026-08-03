DROP POLICY IF EXISTS "Authenticated can read bloco notes" ON public.bloco_notes;

CREATE POLICY "Same company can read bloco notes"
ON public.bloco_notes
FOR SELECT
TO authenticated
USING (
  auth.uid() = author_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles author ON author.id = bloco_notes.author_id
    WHERE me.id = auth.uid()
      AND me.company_id IS NOT NULL
      AND me.company_id = author.company_id
  )
);