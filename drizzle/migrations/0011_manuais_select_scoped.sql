DROP POLICY IF EXISTS "Autenticados veem todos os manuais" ON public.manuais;

CREATE POLICY "Autenticados veem manuais publicados ou proprios"
  ON public.manuais FOR SELECT TO authenticated
  USING (
    publicado = true
    OR auth.uid() = created_by
    OR public.is_admin_or_gestor(auth.uid())
  );