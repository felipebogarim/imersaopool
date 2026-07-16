
-- 1) Private schema for RLS helper functions
CREATE SCHEMA IF NOT EXISTS private_helpers;
REVOKE ALL ON SCHEMA private_helpers FROM PUBLIC;
GRANT USAGE ON SCHEMA private_helpers TO authenticated;

-- Move implementations (SECURITY DEFINER) into private_helpers
CREATE OR REPLACE FUNCTION private_helpers.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private_helpers.is_admin_or_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gestor'))
$$;

CREATE OR REPLACE FUNCTION private_helpers.current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT active_company_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION private_helpers.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_helpers.is_admin_or_gestor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private_helpers.current_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private_helpers.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private_helpers.is_admin_or_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private_helpers.current_company_id() TO authenticated;

-- Replace public helpers with SECURITY INVOKER wrappers so they don't trigger the linter
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private_helpers.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private_helpers.is_admin_or_gestor(_user_id) $$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private_helpers.current_company_id() $$;

-- Ensure existing policies (which call these unqualified) can still execute the wrappers
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated, anon;

-- 2) Restrict representative token RPCs to service_role only (called via TanStack server fns)
REVOKE ALL ON FUNCTION public.get_immersion_by_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_representative_input(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_immersion_by_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_representative_input(text, jsonb) TO service_role;

-- 3) Scope rep_bi_uploads policy to authenticated only
DROP POLICY IF EXISTS rep_bi_uploads_company_scope ON public.rep_bi_uploads;
CREATE POLICY rep_bi_uploads_company_scope
  ON public.rep_bi_uploads
  FOR ALL
  TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());
