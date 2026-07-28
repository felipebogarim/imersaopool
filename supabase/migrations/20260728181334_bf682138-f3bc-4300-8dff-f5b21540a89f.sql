-- 1. event_orders / event_orders_test: service_role only
REVOKE ALL ON public.event_orders FROM anon, authenticated;
REVOKE ALL ON public.event_orders_test FROM anon, authenticated;
GRANT SELECT ON public.event_orders TO authenticated;
GRANT SELECT ON public.event_orders_test TO authenticated;
GRANT ALL ON public.event_orders TO service_role;
GRANT ALL ON public.event_orders_test TO service_role;

-- 2. admin_mfa_policy: admin-only read
DROP POLICY IF EXISTS "admin_mfa_policy_read_authenticated" ON public.admin_mfa_policy;
CREATE POLICY "admin_mfa_policy_read_admin" ON public.admin_mfa_policy
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, DELETE, TRUNCATE ON public.admin_mfa_policy FROM anon, authenticated;
REVOKE ALL ON public.admin_mfa_policy FROM anon;

-- 3. terms_versions: only active version readable by non-admins
DROP POLICY IF EXISTS "authenticated can read active terms" ON public.terms_versions;
CREATE POLICY "authenticated can read active terms" ON public.terms_versions
  FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.terms_versions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.terms_versions FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON public.terms_versions TO authenticated;

-- 4. kanban_workspace_members: prevent adding arbitrary users
DROP POLICY IF EXISTS "kwm_insert" ON public.kanban_workspace_members;
CREATE POLICY "kwm_insert" ON public.kanban_workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.kanban_workspace_role(workspace_id, auth.uid()) IN ('owner','admin')
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.kanban_workspaces w
        WHERE w.id = workspace_id AND w.created_by = auth.uid()
      )
    )
  );

-- 5. Internal SECURITY DEFINER helpers: not directly callable by clients
REVOKE ALL ON FUNCTION public.kanban_can_access_board(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kanban_is_workspace_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kanban_workspace_role(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_log_session_revocation(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_mfa_start_enforcement(integer) FROM PUBLIC, anon, authenticated;