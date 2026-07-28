-- 1) Bloqueia auto-atribuição de empresa (privilege escalation)
CREATE OR REPLACE FUNCTION public.profiles_guard_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  -- chamadas internas (triggers do sistema / service_role) não têm auth.uid()
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_uid, 'admin') THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.company_id IS NOT NULL OR NEW.active_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Apenas administradores podem definir a empresa do perfil';
    END IF;
  ELSE
    IF NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.active_company_id IS DISTINCT FROM OLD.active_company_id THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a empresa do perfil';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_company_trg ON public.profiles;
CREATE TRIGGER profiles_guard_company_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_company();

REVOKE EXECUTE ON FUNCTION public.profiles_guard_company() FROM anon, authenticated;

-- 2) Revoga execução por anon de todas as SECURITY DEFINER exceto as públicas necessárias
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF r.proname NOT IN ('get_active_form_by_slug','submit_form_response','log_auth_failure',
                         'get_immersion_by_token','submit_representative_input') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    END IF;
  END LOOP;
END $$;

-- 3) Revoga execução por authenticated de funções internas (gatilhos, fila de e-mail, guardas)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname, p.prorettype
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF r.prorettype = 'trigger'::regtype
       OR r.proname IN ('email_queue_dispatch','email_queue_wake','enqueue_email','delete_email',
                        'move_to_dlq','read_email_batch','require_admin_aal2','assert_aal2') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon', r.sig);
    END IF;
  END LOOP;
END $$;