
-- 1. CLIENTS: restrict SELECT
DROP POLICY IF EXISTS clients_select_all ON public.clients;
CREATE POLICY clients_select_scoped ON public.clients
  FOR SELECT TO authenticated
  USING (
    agente_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_admin_or_gestor(auth.uid())
  );

-- 2. PROFILES: restrict SELECT
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_self_or_mgr ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin_or_gestor(auth.uid())
  );

-- 3. REPRESENTATIVES: replace ALL/true with granular policies
DROP POLICY IF EXISTS reps_all_auth ON public.representatives;
CREATE POLICY reps_select_auth ON public.representatives
  FOR SELECT TO authenticated USING (true);
CREATE POLICY reps_insert_mgr ON public.representatives
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY reps_update_mgr ON public.representatives
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY reps_delete_mgr ON public.representatives
  FOR DELETE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()));

-- 4. STORAGE: restrict attachment reads to users tied to the immersion
DROP POLICY IF EXISTS imersoes_read ON storage.objects;
CREATE POLICY imersoes_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'imersoes-anexos'
    AND (
      public.is_admin_or_gestor(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.attachments a
        JOIN public.immersions i ON i.id = a.entity_id
        WHERE a.storage_path = storage.objects.name
          AND a.entity_type = 'immersion'
          AND (i.agente_id = auth.uid() OR i.created_by = auth.uid())
      )
    )
  );

-- 5. SECURITY DEFINER helpers: revoke public execute on internal helpers.
--    Keep the token-based representative endpoints callable by anon (their purpose).
REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
