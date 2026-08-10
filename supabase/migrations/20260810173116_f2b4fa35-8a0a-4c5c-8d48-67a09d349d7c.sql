
DROP POLICY IF EXISTS "Users can insert immersion reports" ON public.field_immersion_v2_reports;
CREATE POLICY "Users can insert immersion reports"
ON public.field_immersion_v2_reports FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "kwm_insert" ON public.kanban_workspace_members;
CREATE POLICY "kwm_insert"
ON public.kanban_workspace_members FOR INSERT TO authenticated
WITH CHECK (
  (public.kanban_workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner'::kanban_member_role,'admin'::kanban_member_role]))
  OR (
    user_id = auth.uid()
    AND role = 'owner'::kanban_member_role
    AND EXISTS (SELECT 1 FROM public.kanban_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "product_images_company_read" ON storage.objects;
CREATE POLICY "product_images_company_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    owner = auth.uid()
    OR public.is_admin_or_gestor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.own_products op
      JOIN public.profiles pr ON pr.active_company_id = op.company_id
      WHERE pr.id = auth.uid()
        AND op.imagem_url IS NOT NULL
        AND (op.imagem_url = objects.name OR op.imagem_url LIKE '%/' || objects.name)
    )
  )
);
