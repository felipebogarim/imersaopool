-- role_permissions: users read only rows for roles they hold; admins/gestores read all
DROP POLICY IF EXISTS "Authenticated can read role permissions" ON public.role_permissions;
CREATE POLICY "Users read permissions of own roles" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), role) OR public.is_admin_or_gestor(auth.uid()));

-- permission_presets: only admins/gestores (already covered by the ALL policy)
DROP POLICY IF EXISTS "Authenticated can view presets" ON public.permission_presets;

-- mapa_familia_versoes: only users who hold an app role
DROP POLICY IF EXISTS "mapa_familias_read" ON public.mapa_familia_versoes;
CREATE POLICY "mapa_familias_read" ON public.mapa_familia_versoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- price_mapa_dados: only admins/gestores or users granted the price.mapa page
DROP POLICY IF EXISTS "Autenticados leem dados do mapa" ON public.price_mapa_dados;
DROP POLICY IF EXISTS "Autenticados gravam dados do mapa" ON public.price_mapa_dados;
DROP POLICY IF EXISTS "Autenticados atualizam dados do mapa" ON public.price_mapa_dados;
DROP POLICY IF EXISTS "Autenticados excluem dados do mapa" ON public.price_mapa_dados;

CREATE POLICY "price_mapa_dados_select" ON public.price_mapa_dados
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_nav_permissions unp
               WHERE unp.user_id = auth.uid() AND unp.nav_key = 'price.mapa' AND unp.allowed)
    OR EXISTS (SELECT 1 FROM public.role_permissions rp
               JOIN public.user_roles ur ON ur.role = rp.role
               WHERE ur.user_id = auth.uid() AND rp.nav_key = 'price.mapa' AND rp.allowed)
  );
CREATE POLICY "price_mapa_dados_insert" ON public.price_mapa_dados
  FOR INSERT TO authenticated
  WITH CHECK (
    updated_by = auth.uid() AND (
      public.is_admin_or_gestor(auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_nav_permissions unp
                 WHERE unp.user_id = auth.uid() AND unp.nav_key = 'price.mapa' AND unp.allowed)
      OR EXISTS (SELECT 1 FROM public.role_permissions rp
                 JOIN public.user_roles ur ON ur.role = rp.role
                 WHERE ur.user_id = auth.uid() AND rp.nav_key = 'price.mapa' AND rp.allowed)
    )
  );
CREATE POLICY "price_mapa_dados_update" ON public.price_mapa_dados
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_nav_permissions unp
               WHERE unp.user_id = auth.uid() AND unp.nav_key = 'price.mapa' AND unp.allowed)
    OR EXISTS (SELECT 1 FROM public.role_permissions rp
               JOIN public.user_roles ur ON ur.role = rp.role
               WHERE ur.user_id = auth.uid() AND rp.nav_key = 'price.mapa' AND rp.allowed)
  )
  WITH CHECK (
    updated_by = auth.uid() AND (
      public.is_admin_or_gestor(auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_nav_permissions unp
                 WHERE unp.user_id = auth.uid() AND unp.nav_key = 'price.mapa' AND unp.allowed)
      OR EXISTS (SELECT 1 FROM public.role_permissions rp
                 JOIN public.user_roles ur ON ur.role = rp.role
                 WHERE ur.user_id = auth.uid() AND rp.nav_key = 'price.mapa' AND rp.allowed)
    )
  );
CREATE POLICY "price_mapa_dados_delete" ON public.price_mapa_dados
  FOR DELETE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()));

-- trade-comprovantes: uploads bound to the caller; reads limited to own files
-- or files linked to a trade investment the caller can see (company-scoped RLS)
DROP POLICY IF EXISTS "trade_comprovantes_insert" ON storage.objects;
DROP POLICY IF EXISTS "trade_comprovantes_select" ON storage.objects;
CREATE POLICY "trade_comprovantes_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-comprovantes' AND owner_id = (SELECT auth.uid()::text));
CREATE POLICY "trade_comprovantes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trade-comprovantes' AND (
      owner_id = (SELECT auth.uid()::text)
      OR EXISTS (SELECT 1 FROM public.trade_investments ti WHERE ti.anexo_path = storage.objects.name)
    )
  );

-- email-anexos: uploads and reads bound to the uploader (recipients use signed links)
DROP POLICY IF EXISTS "email_anexos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "email_anexos_auth_select" ON storage.objects;
CREATE POLICY "email_anexos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-anexos' AND owner_id = (SELECT auth.uid()::text));
CREATE POLICY "email_anexos_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'email-anexos' AND owner_id = (SELECT auth.uid()::text));